import { cross, dot, len, madd, norm, scale, sub, type Vec3 } from './math';
import type { RawFace, RawHand } from './tracker';

/** Maps normalised source-image coordinates to output (canvas) pixels. */
export interface FrameMap {
  W: number;
  H: number;
  sw: number;
  sh: number;
  /** output pixels per source pixel */
  k: number;
  mirror: boolean;
}

export function makeMap(W: number, H: number, sw: number, sh: number, mirror: boolean, fit: 'cover' | 'contain'): FrameMap {
  const k = fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
  return { W, H, sw, sh, k, mirror };
}

export function mapPoint(m: FrameMap, nx: number, ny: number, nz = 0): Vec3 {
  let x = (nx * m.sw - m.sw / 2) * m.k + m.W / 2;
  const y = (ny * m.sh - m.sh / 2) * m.k + m.H / 2;
  if (m.mirror) x = m.W - x;
  return [x, y, nz * m.sw * m.k];
}

/** Well-known landmark indices of the MediaPipe face mesh. */
export const LM = {
  noseTip: 1,
  noseBottom: 2,
  noseBridge: 6,
  betweenEyes: 168,
  foreheadTop: 10,
  foreheadMid: 151,
  chin: 152,
  sideA: 234,
  sideB: 454,
  upperLipIn: 13,
  lowerLipIn: 14,
  upperLipTop: 0,
  lowerLipBottom: 17,
  mouthCornerA: 61,
  mouthCornerB: 291,
  eyeAOuter: 33,
  eyeAInner: 133,
  eyeAUpper: 159,
  eyeALower: 145,
  eyeBOuter: 263,
  eyeBInner: 362,
  eyeBUpper: 386,
  eyeBLower: 374,
  irisA: 468,
  irisB: 473,
  cheekA: 50,
  cheekB: 280,
  browA: 105,
  browB: 334,
  templeA: 127,
  templeB: 356,
} as const;

export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

export interface FaceGeom {
  index: number;
  id: number;
  /** 478 landmarks in output pixels (x, y, depth). */
  pts: Float32Array;
  /** origin between the eyes */
  o: Vec3;
  /** unit axes: ux = screen-right across the face, uy = down the face, uz = out of the face towards the viewer */
  ux: Vec3;
  uy: Vec3;
  uz: Vec3;
  /** face width in output pixels */
  s: number;
  blend: Record<string, number>;
  mouthOpen: number;
  smile: number;
  browUp: number;
  blink: number;
  pucker: number;
  /** screen-left / screen-right eye centres */
  eyeL: Vec3;
  eyeR: Vec3;
  /** eye radius estimate in px */
  eyeSize: number;
  mouth: Vec3;
  /** roll angle (radians) of the face in the screen plane */
  roll: number;
  /** -1..1 rough left/right turn */
  yaw: number;
  p(i: number): Vec3;
  /** a point offset from landmark `at` in face units (multiples of face width) */
  at(at: number | Vec3, x: number, y: number, z?: number): Vec3;
}

const avg = (pts: Float32Array, ids: number[]): Vec3 => {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of ids) {
    x += pts[i * 3];
    y += pts[i * 3 + 1];
    z += pts[i * 3 + 2];
  }
  return [x / ids.length, y / ids.length, z / ids.length];
};

const EYE_A = [33, 133, 159, 145, 158, 153, 160, 144];
const EYE_B = [263, 362, 386, 374, 385, 380, 387, 373];

export function buildFace(raw: RawFace, index: number, m: FrameMap): FaceGeom {
  const n = raw.lm.length / 3;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const q = mapPoint(m, raw.lm[i * 3], raw.lm[i * 3 + 1], raw.lm[i * 3 + 2]);
    pts[i * 3] = q[0];
    pts[i * 3 + 1] = q[1];
    pts[i * 3 + 2] = q[2];
  }
  const p = (i: number): Vec3 => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]];

  let ux = norm(sub(p(LM.eyeBOuter), p(LM.eyeAOuter)));
  if (m.mirror) ux = scale(ux, -1);
  // If the face is upside down relative to the screen this still follows the face.
  const down = sub(p(LM.chin), p(LM.foreheadTop));
  const uy = norm(madd(down, ux, -dot(down, ux)));
  const uz = scale(cross(ux, uy), -1);
  const s = len(sub(p(LM.sideB), p(LM.sideA)));
  const o = p(LM.betweenEyes);

  const eA = avg(pts, EYE_A);
  const eB = avg(pts, EYE_B);
  const [eyeL, eyeR] = dot(eA, ux) < dot(eB, ux) ? [eA, eB] : [eB, eA];
  const eyeSize = len(sub(p(LM.eyeAOuter), p(LM.eyeAInner))) * 0.55;

  const b = raw.blend;
  // A toothy grin parts the lips too, so the lip gap only counts once it is clearly an open mouth.
  const lipGap = len(sub(p(LM.lowerLipIn), p(LM.upperLipIn))) / s;
  const mouthOpen = Math.max(b.jawOpen ?? 0, Math.min(1, Math.max(0, (lipGap - 0.09) * 5)));
  const smile = ((b.mouthSmileLeft ?? 0) + (b.mouthSmileRight ?? 0)) / 2;
  const browUp = Math.max(b.browInnerUp ?? 0, ((b.browOuterUpLeft ?? 0) + (b.browOuterUpRight ?? 0)) / 2);
  const blink = Math.min(b.eyeBlinkLeft ?? 0, b.eyeBlinkRight ?? 0);

  const face: FaceGeom = {
    index,
    id: raw.id,
    pts,
    o,
    ux,
    uy,
    uz,
    s,
    blend: b,
    mouthOpen,
    smile,
    browUp,
    blink,
    pucker: b.mouthPucker ?? 0,
    eyeL,
    eyeR,
    eyeSize,
    mouth: avg(pts, [LM.upperLipIn, LM.lowerLipIn, LM.mouthCornerA, LM.mouthCornerB]),
    roll: Math.atan2(ux[1], ux[0]),
    yaw: ux[2],
    p,
    at(anchor, x, y, z = 0) {
      const a = typeof anchor === 'number' ? p(anchor) : anchor;
      return [
        a[0] + (ux[0] * x + uy[0] * y + uz[0] * z) * s,
        a[1] + (ux[1] * x + uy[1] * y + uz[1] * z) * s,
        a[2] + (ux[2] * x + uy[2] * y + uz[2] * z) * s,
      ];
    },
  };
  return face;
}

export interface HandGeom {
  pts: Float32Array; // 21 * 3 output px
  p(i: number): Vec3;
  size: number;
  /** 0 = fist .. 1 = open palm */
  open: number;
  pinch: number;
}

export function buildHand(raw: RawHand, m: FrameMap): HandGeom {
  const pts = new Float32Array(raw.lm.length);
  for (let i = 0; i < raw.lm.length / 3; i++) {
    const q = mapPoint(m, raw.lm[i * 3], raw.lm[i * 3 + 1], raw.lm[i * 3 + 2]);
    pts.set(q, i * 3);
  }
  const p = (i: number): Vec3 => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]];
  const size = Math.hypot(pts[9 * 3] - pts[0], pts[9 * 3 + 1] - pts[1]) || 1;
  const tips = [8, 12, 16, 20];
  const spread = tips.reduce((acc, t) => acc + Math.hypot(pts[t * 3] - pts[0], pts[t * 3 + 1] - pts[1]), 0) / 4 / size;
  return {
    pts,
    p,
    size,
    open: Math.max(0, Math.min(1, (spread - 1.1) / 0.8)),
    pinch: Math.hypot(pts[4 * 3] - pts[8 * 3], pts[4 * 3 + 1] - pts[8 * 3 + 1]) / size,
  };
}
