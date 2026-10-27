import { art } from '../art';
import { lensById } from '../lenses';
import { LensCtx, type Lens, type LensRuntime } from '../lenses/types';
import { USER_BG } from '../lenses/world';
import { buildFace, buildHand, makeMap, type FrameMap } from './face';
import { Renderer } from './renderer';
import { emptyScene } from './scene';
import { Tracker, type TrackResult } from './tracker';

export type SourceKind = 'camera' | 'image' | 'video';
export type Facing = 'user' | 'environment';

interface Source {
  kind: SourceKind;
  el: HTMLVideoElement | HTMLCanvasElement | ImageBitmap;
  w: number;
  h: number;
  mirror: boolean;
}

export interface StudioStatus {
  message: string | null;
  loading: string | null;
  fps: number;
  faces: number;
}

export interface StudioOptions {
  maxFaces: number;
  maxRes: number;
  cpuOnly: boolean;
}

/** Owns the camera/media source, runs tracking and the active lens, and draws every frame. */
export class Studio {
  readonly renderer: Renderer;
  readonly tracker: Tracker;
  private scene = emptyScene();
  private ctx: LensCtx;
  lens: Lens = lensById('none');
  private runtime: LensRuntime = this.lens.create();
  variant = 0;
  filter = 'none';
  facing: Facing = 'user';
  private source: Source | null = null;
  private stream: MediaStream | null = null;
  private videoEl: HTMLVideoElement;
  private fileVideo: HTMLVideoElement | null = null;
  private lastVideoTime = -1;
  private imageFrames = 0;
  private sourceDirty = true;
  private last: TrackResult = { faces: [], hands: [], mask: null, maskVersion: 0 };
  private t0 = performance.now();
  private lastFrame = performance.now();
  private fpsAcc = 0;
  private fpsN = 0;
  private running = false;
  private map: FrameMap | null = null;
  private segReady = false;
  private handsReady = false;
  private userBgVersion = 0;
  private restarting = false;
  private lastRestart = 0;
  status: StudioStatus = { message: null, loading: null, fps: 0, faces: 0 };
  onFrame?: () => void;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private container: HTMLElement,
    private opts: StudioOptions,
  ) {
    this.renderer = new Renderer(canvas, art);
    this.tracker = new Tracker(opts.cpuOnly);
    this.ctx = new LensCtx(this.scene, (k) => this.renderer.aspect(k));
    this.videoEl = hiddenVideo();
  }

  async init() {
    await this.tracker.init(this.opts.maxFaces);
  }

  setOptions(o: Partial<StudioOptions>) {
    this.opts = { ...this.opts, ...o };
    void this.tracker.setMaxFaces(Math.max(this.opts.maxFaces, this.lens.faces ?? 1));
  }

  // ---------- sources ----------

  async startCamera(facing: Facing = this.facing) {
    this.stopCamera();
    this.facing = facing;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      // 4:3 matches iPad camera sensors, so less of the picture is cropped away in either orientation
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 30 } },
    });
    this.stream = stream;
    const v = this.videoEl;
    v.srcObject = stream;
    await v.play().catch(() => undefined);
    await waitFor(() => v.videoWidth > 0, 4000);
    this.clearFileVideo();
    this.source = { kind: 'camera', el: v, w: v.videoWidth, h: v.videoHeight, mirror: facing === 'user' };
    this.sourceDirty = true;
  }

  /** iPadOS can end the camera (calls, other apps, interruptions); bring it back quietly. */
  private healCamera() {
    if (this.restarting || document.hidden || performance.now() - this.lastRestart < 2000) return;
    this.restarting = true;
    this.lastRestart = performance.now();
    this.startCamera()
      .catch((e) => console.warn('camera restart failed', e))
      .finally(() => (this.restarting = false));
  }

  stopCamera() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.videoEl.srcObject = null;
  }

  cameraAlive() {
    return !!this.stream && this.stream.getVideoTracks().some((t) => t.readyState === 'live');
  }

  setImage(img: ImageBitmap | HTMLCanvasElement) {
    this.stopCamera();
    this.clearFileVideo();
    this.source = { kind: 'image', el: img, w: img.width, h: img.height, mirror: false };
    this.imageFrames = 0;
    this.sourceDirty = true;
  }

  async setVideoFile(url: string) {
    this.stopCamera();
    this.clearFileVideo();
    const v = hiddenVideo();
    v.loop = true;
    v.muted = true;
    v.src = url;
    this.fileVideo = v;
    await v.play().catch(() => undefined);
    await waitFor(() => v.videoWidth > 0, 8000);
    this.source = { kind: 'video', el: v, w: v.videoWidth, h: v.videoHeight, mirror: false };
    this.sourceDirty = true;
    return v;
  }

  private clearFileVideo() {
    if (this.fileVideo) {
      this.fileVideo.pause();
      URL.revokeObjectURL(this.fileVideo.src);
      this.fileVideo.remove();
      this.fileVideo = null;
    }
  }

  get sourceKind(): SourceKind | null {
    return this.source?.kind ?? null;
  }

  get video(): HTMLVideoElement | null {
    return this.fileVideo;
  }

  get mirrored() {
    return !!this.source?.mirror;
  }

  // ---------- lens ----------

  setLens(id: string, variant = 0) {
    const lens = lensById(id);
    if (lens !== this.lens) {
      this.lens = lens;
      this.runtime = lens.create();
      this.segReady = false;
      this.handsReady = false;
      void this.tracker.setMaxFaces(Math.max(this.opts.maxFaces, lens.faces ?? 1));
    }
    this.variant = variant;
    if (lens.seg) {
      if (this.tracker.isLoaded(lens.seg)) this.segReady = true;
      else {
        this.status.loading = 'Getting the magic ready…';
        this.tracker.ensure(lens.seg).then(
          () => {
            if (this.lens === lens) this.segReady = true;
            this.status.loading = null;
          },
          (e) => {
            console.error(e);
            this.status.loading = null;
          },
        );
      }
    }
    if (lens.hands) {
      if (this.tracker.isLoaded('hands')) this.handsReady = true;
      else {
        this.status.loading = 'Getting the magic ready…';
        this.tracker.ensure('hands').then(
          () => {
            if (this.lens === lens) this.handsReady = true;
            this.status.loading = null;
          },
          (e) => {
            console.error(e);
            this.status.loading = null;
          },
        );
      }
    }
    if (this.source?.kind === 'image') this.imageFrames = 0;
  }

  setUserBackground(img: ImageBitmap | HTMLCanvasElement) {
    this.userBgVersion++;
    this.renderer.setTexture(USER_BG, img, this.userBgVersion);
  }

  get hasUserBackground() {
    return this.userBgVersion > 0;
  }

  /** Forward a tap on the canvas (CSS pixels relative to the canvas element). */
  tap(cssX: number, cssY: number) {
    if (!this.runtime.tap) return;
    const r = this.canvas.getBoundingClientRect();
    const { W, H } = this.renderer;
    const scale = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * scale) / 2;
    const oy = (r.height - H * scale) / 2;
    this.runtime.tap(this.ctx, (cssX - ox) / scale, (cssY - oy) / scale);
  }

  // ---------- loop ----------

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      try {
        this.frame();
      } catch (e) {
        console.error(e);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
  }

  private outputSize(src: Source): [number, number] {
    let aspect: number;
    if (src.kind === 'camera') {
      const r = this.container.getBoundingClientRect();
      aspect = r.width > 0 && r.height > 0 ? r.width / r.height : src.w / src.h;
    } else aspect = src.w / src.h;
    // crop the source to the output aspect, never upscale beyond the source resolution
    let w = src.w;
    let h = src.w / aspect;
    if (h > src.h) {
      h = src.h;
      w = h * aspect;
    }
    const k = Math.min(1, this.opts.maxRes / Math.max(w, h));
    return [Math.round(w * k), Math.round(h * k)];
  }

  /** Draw one frame now (also used right before taking a photo). */
  frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const t = (now - this.t0) / 1000;
    const src = this.source;
    if (!src) return;
    if (src.kind === 'camera' && !this.cameraAlive()) {
      this.healCamera();
      return;
    }

    if (src.el instanceof HTMLVideoElement) {
      const v = src.el;
      if (v.readyState < 2 || v.videoWidth === 0) return;
      if (v.videoWidth !== src.w || v.videoHeight !== src.h) {
        src.w = v.videoWidth;
        src.h = v.videoHeight;
      }
    }
    const [W, H] = this.outputSize(src);
    this.renderer.setSize(W, H);
    this.map = makeMap(W, H, src.w, src.h, src.mirror, src.kind === 'camera' ? 'cover' : 'contain');

    let fresh = false;
    if (src.el instanceof HTMLVideoElement) {
      const vt = src.el.currentTime;
      if (vt !== this.lastVideoTime || this.sourceDirty) {
        this.lastVideoTime = vt;
        fresh = true;
      }
    } else if (this.sourceDirty || this.imageFrames < 12) {
      fresh = true;
      this.imageFrames++;
    }

    const lens = this.lens;
    if (fresh) {
      this.renderer.uploadSource(src.el, src.w, src.h);
      this.sourceDirty = false;
      if (this.tracker.ready) {
        const t1 = performance.now();
        this.last = this.tracker.detect(src.el, {
          faces: lens.faces === 0 ? 0 : Math.max(1, lens.faces ?? 1),
          seg: this.segReady ? lens.seg : undefined,
          hands: this.handsReady && lens.hands,
        });
        this.trackMs = this.trackMs * 0.9 + (performance.now() - t1) * 0.1;
      }
      if (this.last.mask) this.renderer.uploadMask(this.last.mask, this.last.maskVersion);
    }

    const scene = this.scene;
    scene.warps.length = 0;
    scene.sprites.length = 0;
    scene.paints.length = 0;
    scene.swaps.length = 0;
    scene.bg = null;
    scene.hair = null;
    scene.grade = { tint: [1, 1, 1], amount: 0, sat: 1, bright: 1 };
    scene.hud = null;

    const ctx = this.ctx;
    ctx.t = t;
    ctx.dt = dt;
    ctx.W = W;
    ctx.H = H;
    ctx.variant = this.variant;
    ctx.still = src.kind === 'image';
    ctx.userBg = this.hasUserBackground;
    ctx.message = null;
    ctx.faces = lens.faces === 0 ? [] : this.last.faces.map((f, i) => buildFace(f, i, this.map!));
    ctx.hands = this.last.hands.map((h) => buildHand(h, this.map!));
    this.runtime.frame(ctx);

    const hasMask = !!lens.seg && this.segReady && this.last.mask !== null;
    this.renderer.render(scene, this.map, this.filter, t, hasMask);

    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 1) {
      this.status.fps = Math.round(this.fpsN / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    this.status.message = ctx.message;
    this.status.faces = ctx.faces.length;
    this.onFrame?.();
  }

  trackMs = 0;
}

function hiddenVideo() {
  const v = document.createElement('video');
  v.playsInline = true;
  v.muted = true;
  v.autoplay = true;
  v.setAttribute('playsinline', '');
  v.setAttribute('webkit-playsinline', '');
  // iOS only updates frames for videos that are in the document
  Object.assign(v.style, { position: 'fixed', width: '2px', height: '2px', opacity: '0.01', pointerEvents: 'none', left: '0', top: '0' });
  document.body.appendChild(v);
  return v;
}

function waitFor(cond: () => boolean, timeout: number) {
  return new Promise<void>((resolve, reject) => {
    const start = performance.now();
    const check = () => {
      if (cond()) resolve();
      else if (performance.now() - start > timeout) reject(new Error('Timed out waiting for video'));
      else setTimeout(check, 30);
    };
    check();
  });
}
