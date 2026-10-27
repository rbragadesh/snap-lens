import { LM, type FaceGeom } from '../engine/face';
import { Spring, type Vec3 } from '../engine/math';
import type { LensCtx } from './types';

// Offsets below are in face-width units relative to the point between the eyes (landmark 168),
// measured from MediaPipe's canonical face model: eyes at y≈0.04, x≈±0.21; hairline y≈-0.33; chin y≈0.83.
export const O = LM.betweenEyes;
export const HEAD_TOP = -0.62;

/** Per-face state that survives between frames (keyed by tracker face id). */
export function perFace<T>(make: () => T) {
  const m = new Map<number, T>();
  return (f: FaceGeom) => {
    let v = m.get(f.id);
    if (!v) {
      v = make();
      m.set(f.id, v);
    }
    return v;
  };
}

/** Springy wobble driven by head roll velocity, for ears/antennae. */
export function wobbler() {
  const st = perFace(() => ({ s: new Spring(90, 7), lastRoll: NaN, lastX: NaN }));
  return (c: LensCtx, f: FaceGeom) => {
    const w = st(f);
    if (Number.isNaN(w.lastRoll)) {
      w.lastRoll = f.roll;
      w.lastX = f.o[0];
    }
    const dt = Math.max(c.dt, 1 / 120);
    // ears lag behind head turns and sideways moves, then settle
    const vel = (f.roll - w.lastRoll) / dt + ((f.o[0] - w.lastX) / f.s / dt) * 0.6;
    w.lastRoll = f.roll;
    w.lastX = f.o[0];
    const target = Math.max(-0.6, Math.min(0.6, -vel * 0.06));
    return w.s.update(target, dt);
  };
}

/** A left/right pair of stickers mirrored around the face centre. */
export function pair(
  c: LensCtx,
  f: FaceGeom,
  tex: string,
  o: { x: number; y: number; w: number; z?: number; rot?: number; pivot?: [number, number]; alpha?: number; layer?: number; tilt?: number },
  wobble = 0,
) {
  for (const side of [-1, 1]) {
    c.sprite(f, tex, {
      at: O,
      x: o.x * side,
      y: o.y,
      z: o.z ?? -0.25,
      w: o.w,
      rot: (o.rot ?? 0) * side + wobble,
      pivot: o.pivot,
      flipX: side > 0,
      alpha: o.alpha,
      layer: o.layer,
      tilt: o.tilt,
    });
  }
}

/** Unit 2D vector on screen for a face axis. */
export function dir2(v: Vec3): [number, number] {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

export function eyeWarp(c: LensCtx, f: FaceGeom, k: number, size = 3.2) {
  c.bulge(f.eyeL, f.eyeSize * size, k);
  c.bulge(f.eyeR, f.eyeSize * size, k);
}

export const pulse = (t: number, speed = 6, amt = 0.08) => 1 + Math.sin(t * speed) * amt;
