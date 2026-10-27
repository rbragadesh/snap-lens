import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  ImageSegmenter,
  type FaceLandmarkerResult,
  type ImageSource,
} from '@mediapipe/tasks-vision';
import { OneEuro } from './math';

// Everything below loads from this app's own origin (see vite.config.ts); no CDN is used.
const WASM_BASE = new URL('./wasm', document.baseURI).href;
const MODEL = (name: string) => new URL(`./models/${name}`, document.baseURI).href;

export type SegKind = 'person' | 'hair';

export interface RawFace {
  /** Stable id while the face stays in view. */
  id: number;
  /** 478 landmarks * (x, y, z), normalised to the source image, smoothed. */
  lm: Float32Array;
  blend: Record<string, number>;
}

export interface RawHand {
  lm: Float32Array; // 21 * (x, y, z) normalised
  handedness: string;
}

export interface TrackResult {
  faces: RawFace[];
  hands: RawHand[];
  /** 256x256 RGBA mask: R = person, G = hair. Null if no segmentation was requested. */
  mask: Uint8Array | null;
  maskVersion: number;
}

export interface TrackNeeds {
  faces: number;
  seg?: SegKind;
  hands?: boolean;
}

type Delegate = 'GPU' | 'CPU';

interface Track {
  id: number;
  filter: OneEuro;
  center: [number, number];
  lastSeen: number;
}

export const MASK_SIZE = 256;

export class Tracker {
  private fileset!: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
  private face?: FaceLandmarker;
  private faceCount = 0;
  private person?: ImageSegmenter;
  private multi?: ImageSegmenter;
  private hands?: HandLandmarker;
  private loading = new Map<string, Promise<void>>();
  private lastTs = 0;
  private tracks: Track[] = [];
  private nextId = 1;
  private mask = new Uint8Array(MASK_SIZE * MASK_SIZE * 4);
  private maskVersion = 0;
  private handFilters: OneEuro[] = [new OneEuro(1.5, 10), new OneEuro(1.5, 10)];
  // The segmenter returns masks at the input's size, so it gets a small copy of the frame:
  // correct mask layout and ~20x less data to read back per frame.
  private segCanvas = Object.assign(document.createElement('canvas'), { width: MASK_SIZE, height: MASK_SIZE });
  private segCtx = this.segCanvas.getContext('2d')!;
  delegate: Delegate = 'GPU';

  constructor(preferCpu = false) {
    if (preferCpu) this.delegate = 'CPU';
  }

  async init(maxFaces: number) {
    this.fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    await this.createFace(maxFaces);
  }

  get ready() {
    return !!this.face;
  }

  private async withFallback<T>(make: (d: Delegate) => Promise<T>): Promise<T> {
    if (this.delegate === 'GPU') {
      try {
        return await make('GPU');
      } catch (err) {
        console.warn('GPU delegate failed, using CPU', err);
        this.delegate = 'CPU';
      }
    }
    return make('CPU');
  }

  private async createFace(maxFaces: number) {
    this.face?.close();
    this.face = await this.withFallback((delegate) =>
      FaceLandmarker.createFromOptions(this.fileset, {
        baseOptions: { modelAssetPath: MODEL('face_landmarker.task'), delegate },
        runningMode: 'VIDEO',
        numFaces: maxFaces,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    );
    this.faceCount = maxFaces;
  }

  async setMaxFaces(n: number) {
    if (n === this.faceCount || !this.face) return;
    await this.face.setOptions({ numFaces: n });
    this.faceCount = n;
  }

  /** Loads an optional model on first use. Resolves when it is ready. */
  ensure(kind: SegKind | 'hands'): Promise<void> {
    const have = kind === 'person' ? this.person : kind === 'hair' ? this.multi : this.hands;
    if (have) return Promise.resolve();
    let p = this.loading.get(kind);
    if (!p) {
      p = (async () => {
        if (kind === 'hands') {
          this.hands = await this.withFallback((delegate) =>
            HandLandmarker.createFromOptions(this.fileset, {
              baseOptions: { modelAssetPath: MODEL('hand_landmarker.task'), delegate },
              runningMode: 'VIDEO',
              numHands: 2,
            }),
          );
        } else {
          const seg = await this.withFallback((delegate) =>
            ImageSegmenter.createFromOptions(this.fileset, {
              baseOptions: {
                modelAssetPath: MODEL(kind === 'hair' ? 'selfie_multiclass_256x256.tflite' : 'selfie_segmenter.tflite'),
                delegate,
              },
              runningMode: 'VIDEO',
              outputConfidenceMasks: true,
              outputCategoryMask: false,
            }),
          );
          if (kind === 'hair') this.multi = seg;
          else this.person = seg;
        }
      })();
      p.finally(() => this.loading.delete(kind));
      this.loading.set(kind, p);
    }
    return p;
  }

  isLoaded(kind: SegKind | 'hands') {
    return !!(kind === 'person' ? this.person : kind === 'hair' ? this.multi : this.hands);
  }

  /** Runs the requested models on one frame. Must be called with increasing time. */
  detect(frame: ImageSource, needs: TrackNeeds): TrackResult {
    const now = performance.now();
    const ts = Math.max(now, this.lastTs + 1);
    const dt = Math.min(0.1, Math.max(0.001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;

    const out: TrackResult = { faces: [], hands: [], mask: null, maskVersion: this.maskVersion };
    if (!this.face) return out;

    if (needs.faces > 0) {
      const res = this.face.detectForVideo(frame, ts);
      out.faces = this.smoothFaces(res, dt, ts);
    } else {
      this.tracks = [];
    }

    if (needs.seg) {
      const seg = needs.seg === 'hair' ? this.multi : this.person;
      if (seg) {
        this.segCtx.drawImage(frame as CanvasImageSource, 0, 0, MASK_SIZE, MASK_SIZE);
        const r = seg.segmentForVideo(this.segCanvas, ts);
        const masks = r.confidenceMasks ?? [];
        try {
          if (masks.length) {
            this.writeMask(masks.map((m) => resample(m.getAsFloat32Array(), m.width, m.height)), needs.seg);
            out.mask = this.mask;
            out.maskVersion = this.maskVersion;
          }
        } finally {
          for (const m of masks) m.close();
        }
      }
    }

    if (needs.hands && this.hands) {
      const r = this.hands.detectForVideo(frame, ts);
      out.hands = r.landmarks.map((hand, i) => {
        const raw = new Float32Array(hand.length * 3);
        hand.forEach((p, j) => raw.set([p.x, p.y, p.z], j * 3));
        const f = this.handFilters[i] ?? new OneEuro(1.5, 10);
        return { lm: Float32Array.from(f.filter(raw, dt)), handedness: r.handedness[i]?.[0]?.categoryName ?? '' };
      });
      for (let i = r.landmarks.length; i < this.handFilters.length; i++) this.handFilters[i].reset();
    }
    return out;
  }

  private writeMask(masks: Float32Array[], kind: SegKind) {
    // selfie_segmenter: one mask = person. multiclass: [background, hair, body-skin, face-skin, clothes, others].
    const n = Math.min(MASK_SIZE * MASK_SIZE, masks[0].length);
    const multi = kind === 'hair' && masks.length > 2;
    // For the multiclass model "person" is everything that is not background.
    const src = multi ? masks[0] : masks.length >= 2 ? masks[1] : masks[0];
    const invert = multi;
    const hair = multi ? masks[1] : null;
    const m = this.mask;
    const keep = 0.35; // temporal smoothing against flicker
    for (let i = 0; i < n; i++) {
      const p = invert ? 1 - src[i] : src[i];
      const j = i * 4;
      m[j] = m[j] * keep + p * 255 * (1 - keep);
      m[j + 1] = hair ? m[j + 1] * keep + hair[i] * 255 * (1 - keep) : 0;
      m[j + 3] = 255;
    }
    this.maskVersion++;
  }

  private smoothFaces(res: FaceLandmarkerResult, dt: number, ts: number): RawFace[] {
    const faces: RawFace[] = [];
    const used = new Set<Track>();
    res.faceLandmarks.forEach((lms, i) => {
      const raw = new Float32Array(lms.length * 3);
      for (let j = 0; j < lms.length; j++) {
        raw[j * 3] = lms[j].x;
        raw[j * 3 + 1] = lms[j].y;
        raw[j * 3 + 2] = lms[j].z;
      }
      const cx = raw[1 * 3];
      const cy = raw[1 * 3 + 1];
      // Match to the closest existing track so each face keeps its own smoothing state.
      let best: Track | undefined;
      let bestD = 0.15;
      for (const t of this.tracks) {
        if (used.has(t)) continue;
        const d = Math.hypot(t.center[0] - cx, t.center[1] - cy);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
      if (!best) {
        best = { id: this.nextId++, filter: new OneEuro(), center: [cx, cy], lastSeen: ts };
        this.tracks.push(best);
      }
      used.add(best);
      best.center = [cx, cy];
      best.lastSeen = ts;
      const blend: Record<string, number> = {};
      for (const c of res.faceBlendshapes[i]?.categories ?? []) blend[c.categoryName] = c.score;
      faces.push({ id: best.id, lm: Float32Array.from(best.filter.filter(raw, dt)), blend });
    });
    this.tracks = this.tracks.filter((t) => used.has(t) || ts - t.lastSeen < 500);
    return faces;
  }
}

/** Nearest-neighbour resize to MASK_SIZE x MASK_SIZE (normally a no-op). */
function resample(a: Float32Array, w: number, h: number): Float32Array {
  if (w === MASK_SIZE && h === MASK_SIZE) return a;
  const out = new Float32Array(MASK_SIZE * MASK_SIZE);
  for (let y = 0; y < MASK_SIZE; y++) {
    const sy = Math.min(h - 1, Math.floor(((y + 0.5) * h) / MASK_SIZE));
    for (let x = 0; x < MASK_SIZE; x++) {
      out[y * MASK_SIZE + x] = a[sy * w + Math.min(w - 1, Math.floor(((x + 0.5) * w) / MASK_SIZE))];
    }
  }
  return out;
}
