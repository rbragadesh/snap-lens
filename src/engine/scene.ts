import type { Vec3 } from './math';
import type { FaceGeom } from './face';

export type RGB = [number, number, number];

/** A local magnify/shrink ('bulge', k>0 grows, k<0 shrinks) or a push ('shift') of the image. */
export interface Warp {
  type: 'bulge' | 'shift';
  x: number;
  y: number;
  r: number;
  k?: number;
  vx?: number;
  vy?: number;
}

export interface SpriteCmd {
  tex: string;
  /** corners TL, TR, BR, BL in output pixels */
  q: Float32Array;
  alpha: number;
  additive: boolean;
  layer: number;
  tint: RGB;
  /** sub-rectangle of the texture (u0, v0, u1, v1) */
  uv?: [number, number, number, number];
}

export type PaintMode = 'normal' | 'multiply' | 'shade';

export interface PaintCmd {
  pts: Float32Array;
  tex: string;
  mode: PaintMode;
  opacity: number;
}

export interface SwapCmd {
  dst: Float32Array;
  src: Float32Array;
  opacity: number;
}

export type Background = null | { kind: 'tex'; tex: string } | { kind: 'blur' };

export interface Scene {
  warps: Warp[];
  sprites: SpriteCmd[];
  paints: PaintCmd[];
  swaps: SwapCmd[];
  bg: Background;
  hair: null | { color: RGB; rainbow: boolean; amount: number };
  grade: { tint: RGB; amount: number; sat: number; bright: number };
  hud: HTMLCanvasElement | null;
  hudVersion: number;
}

export function emptyScene(): Scene {
  return {
    warps: [],
    sprites: [],
    paints: [],
    swaps: [],
    bg: null,
    hair: null,
    grade: { tint: [1, 1, 1], amount: 0, sat: 1, bright: 1 },
    hud: null,
    hudVersion: 0,
  };
}

export interface SpriteOpts {
  /** landmark index or explicit point to anchor to */
  at: number | Vec3;
  /** offsets in face-width units along the face axes */
  x?: number;
  y?: number;
  z?: number;
  /** size in face-width units; h defaults to keeping the texture's aspect ratio */
  w: number;
  h?: number;
  /** rotation in the face plane (radians, clockwise on screen) */
  rot?: number;
  /** tilt the sprite plane back (+) or forward (-) around the face's horizontal axis */
  tilt?: number;
  /** turn the sprite plane around the face's vertical axis */
  turn?: number;
  alpha?: number;
  additive?: boolean;
  layer?: number;
  flipX?: boolean;
  tint?: RGB;
  /** which point of the texture (0..1, 0..1) sits on the anchor; default centre */
  pivot?: [number, number];
}

/** Places a textured quad in the face's 3D frame so it turns and tilts with the head. */
export function faceQuad(f: FaceGeom, aspect: number, o: SpriteOpts): Float32Array {
  const c = f.at(o.at, o.x ?? 0, o.y ?? 0, o.z ?? 0);
  const w = o.w * f.s;
  const h = (o.h ?? o.w / aspect) * f.s;
  let ax: Vec3 = f.ux;
  let ay: Vec3 = f.uy;
  const az: Vec3 = f.uz;
  if (o.tilt) {
    const ct = Math.cos(o.tilt);
    const st = Math.sin(o.tilt);
    ay = [ay[0] * ct + az[0] * st, ay[1] * ct + az[1] * st, ay[2] * ct + az[2] * st];
  }
  if (o.turn) {
    const ct = Math.cos(o.turn);
    const st = Math.sin(o.turn);
    ax = [ax[0] * ct + az[0] * st, ax[1] * ct + az[1] * st, ax[2] * ct + az[2] * st];
  }
  const r = o.rot ?? 0;
  if (r) {
    const cr = Math.cos(r);
    const sr = Math.sin(r);
    const nx: Vec3 = [ax[0] * cr + ay[0] * sr, ax[1] * cr + ay[1] * sr, ax[2] * cr + ay[2] * sr];
    const ny: Vec3 = [ay[0] * cr - ax[0] * sr, ay[1] * cr - ax[1] * sr, ay[2] * cr - ax[2] * sr];
    ax = nx;
    ay = ny;
  }
  const sx = o.flipX ? -1 : 1;
  const [px, py] = o.pivot ?? [0.5, 0.5];
  // texture-space edges relative to the anchor; flipping mirrors the texture around the anchor
  const el = -px * w * sx;
  const er = (1 - px) * w * sx;
  const et = -py * h;
  const eb = (1 - py) * h;
  const pt = (u: number, v: number) => [c[0] + ax[0] * u + ay[0] * v, c[1] + ax[1] * u + ay[1] * v];
  return new Float32Array([...pt(el, et), ...pt(er, et), ...pt(er, eb), ...pt(el, eb)]);
}

/** Screen-aligned quad centred at (x, y). */
export function screenQuad(x: number, y: number, w: number, h: number, rot = 0): Float32Array {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const hx = w / 2;
  const hy = h / 2;
  const pt = (dx: number, dy: number) => [x + dx * c - dy * s, y + dx * s + dy * c];
  return new Float32Array([...pt(-hx, -hy), ...pt(hx, -hy), ...pt(hx, hy), ...pt(-hx, hy)]);
}
