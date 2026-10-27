import type { FaceGeom, HandGeom } from '../engine/face';
import type { Vec3 } from '../engine/math';
import { faceQuad, screenQuad, type PaintMode, type RGB, type Scene, type SpriteOpts } from '../engine/scene';

export type LensGroup = 'cute' | 'funny' | 'magic' | 'paint' | 'world' | 'friends' | 'games';

export interface Variant {
  name: string;
  /** CSS colour or emoji shown in the picker */
  swatch: string;
}

export interface LensRuntime {
  frame(c: LensCtx): void;
  /** Taps on the preview, in output pixels. */
  tap?(c: LensCtx, x: number, y: number): void;
}

export interface Lens {
  id: string;
  name: string;
  icon: string;
  group: LensGroup;
  /** Short instruction shown when the lens is picked, e.g. "Open your mouth!" */
  hint?: string;
  /** how many faces the tracker should look for (0 = none needed) */
  faces?: number;
  seg?: 'person' | 'hair';
  hands?: boolean;
  variants?: Variant[];
  create(): LensRuntime;
}

export class LensCtx {
  t = 0;
  dt = 0;
  W = 1;
  H = 1;
  faces: FaceGeom[] = [];
  hands: HandGeom[] = [];
  variant = 0;
  /** true while the source is a still photo */
  still = false;
  /** whether the child picked their own background photo */
  userBg = false;
  /** on-screen tip for this frame (shown in the UI, never saved into photos) */
  message: string | null = null;
  constructor(
    public scene: Scene,
    public aspect: (tex: string) => number,
  ) {}

  /** Sticker attached to a face. */
  sprite(f: FaceGeom, tex: string, o: SpriteOpts) {
    this.scene.sprites.push({
      tex,
      q: faceQuad(f, this.aspect(tex), o),
      alpha: o.alpha ?? 1,
      additive: o.additive ?? false,
      layer: o.layer ?? 10,
      tint: o.tint ?? [1, 1, 1],
    });
  }

  /** Sticker in screen space (output pixels). */
  sprite2d(tex: string, x: number, y: number, w: number, o: { h?: number; rot?: number; alpha?: number; additive?: boolean; tint?: RGB; layer?: number } = {}) {
    const h = o.h ?? w / this.aspect(tex);
    this.scene.sprites.push({
      tex,
      q: screenQuad(x, y, w, h, o.rot ?? 0),
      alpha: o.alpha ?? 1,
      additive: o.additive ?? false,
      layer: o.layer ?? 10,
      tint: o.tint ?? [1, 1, 1],
    });
  }

  bulge(at: Vec3, r: number, k: number) {
    this.scene.warps.push({ type: 'bulge', x: at[0], y: at[1], r, k });
  }

  shift(at: Vec3, r: number, vx: number, vy: number) {
    this.scene.warps.push({ type: 'shift', x: at[0], y: at[1], r, vx, vy });
  }

  paint(f: FaceGeom, name: string, mode: PaintMode = 'shade', opacity = 1) {
    this.scene.paints.push({ pts: f.pts, tex: `paint:${name}`, mode, opacity });
  }

  tint(rgb: RGB, amount: number, sat = 1, bright = 1) {
    this.scene.grade = { tint: rgb, amount, sat, bright };
  }
}

export const RAINBOW: RGB[] = [
  [1, 0.09, 0.27],
  [1, 0.57, 0],
  [1, 0.92, 0],
  [0, 0.9, 0.46],
  [0.16, 0.47, 1],
  [0.84, 0, 0.98],
];

export function hex(h: string): RGB {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
