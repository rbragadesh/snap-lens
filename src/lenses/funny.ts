import { LM, type FaceGeom } from '../engine/face';
import { dot, sub, type Vec3 } from '../engine/math';
import { Particles } from '../engine/particles';
import { O, dir2 } from './helpers';
import type { Lens, LensCtx } from './types';

/** Push a point along face axes (amounts in face widths). */
function push(c: LensCtx, f: FaceGeom, at: Vec3, r: number, ax: number, ay: number) {
  const vx = (f.ux[0] * ax + f.uy[0] * ay) * f.s;
  const vy = (f.ux[1] * ax + f.uy[1] * ay) * f.s;
  c.shift(at, r * f.s, vx, vy);
}

/** -1 if the point is on the screen-left half of the face, +1 otherwise. */
const sideOf = (f: FaceGeom, p: Vec3) => (dot(sub(p, f.o), f.ux) < 0 ? -1 : 1);

const bigEyes: Lens = {
  id: 'bigeyes',
  name: 'Big Eyes',
  icon: '👀',
  group: 'funny',
  variants: [
    { name: 'Big', swatch: '👀' },
    { name: 'Wonky', swatch: '🤪' },
    { name: 'Tiny', swatch: '😑' },
  ],
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          const [kl, kr] = c.variant === 1 ? [0.62, -0.5] : c.variant === 2 ? [-0.55, -0.55] : [0.6, 0.6];
          c.bulge(f.eyeL, f.eyeSize * 3.3, kl);
          c.bulge(f.eyeR, f.eyeSize * 3.3, kr);
        }
      },
    };
  },
};

const bobble: Lens = {
  id: 'bobble',
  name: 'Big Head',
  icon: '🎈',
  group: 'funny',
  variants: [
    { name: 'Big Head', swatch: '🎈' },
    { name: 'Tiny Face', swatch: '🐜' },
  ],
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          const centre = f.at(O, 0, 0.15);
          if (c.variant === 1) c.bulge(centre, f.s * 0.95, -0.55);
          else c.bulge(centre, f.s * 1.2, 0.42);
        }
      },
    };
  },
};

const shook: Lens = {
  id: 'shook',
  name: 'Shook',
  icon: '😱',
  group: 'funny',
  hint: 'Open your mouth wide!',
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          c.bulge(f.eyeL, f.eyeSize * 3.6, 0.7);
          c.bulge(f.eyeR, f.eyeSize * 3.6, 0.7);
          push(c, f, f.p(105), 0.22, 0, -0.06);
          push(c, f, f.p(334), 0.22, 0, -0.06);
          const o = Math.min(1, f.mouthOpen * 1.5);
          c.bulge(f.mouth, f.s * 0.32, 0.25 + 0.2 * o);
          push(c, f, f.p(LM.chin), 0.55, 0, 0.1 + 0.12 * o);
        }
      },
    };
  },
};

const crybaby: Lens = {
  id: 'crybaby',
  name: 'Cry Baby',
  icon: '😭',
  group: 'funny',
  create() {
    const tears = new Particles(200);
    return {
      frame(c) {
        c.tint([0.8, 0.9, 1.1], 0.2, 0.9, 1);
        for (const f of c.faces) {
          c.bulge(f.eyeL, f.eyeSize * 3.2, 0.38);
          c.bulge(f.eyeR, f.eyeSize * 3.2, 0.38);
          // sad eyebrows: inner ends up
          push(c, f, f.p(107), 0.16, 0, -0.05);
          push(c, f, f.p(336), 0.16, 0, -0.05);
          // mouth corners down, wobbling
          const wob = Math.sin(c.t * 18) * 0.008;
          for (const id of [LM.mouthCornerA, LM.mouthCornerB]) {
            const p = f.p(id);
            push(c, f, p, 0.17, sideOf(f, p) * 0.01, 0.06 + wob);
          }
          push(c, f, f.p(LM.lowerLipBottom), 0.2, 0, -0.02);
          const [dx, dy] = dir2(f.uy);
          for (const id of [145, 374]) {
            if (Math.random() < 0.5) {
              const p = f.p(id);
              tears.emit({
                tex: 'tear',
                x: p[0] + (Math.random() - 0.5) * f.s * 0.05,
                y: p[1] + f.s * 0.03,
                vx: dx * f.s * 0.6,
                vy: dy * f.s * 0.6,
                ay: f.s * 2,
                size: f.s * 0.05,
                aspect: 0.67,
                max: 0.9,
                layer: 12,
              });
            }
          }
        }
        tears.update(c.dt);
        tears.draw(c.scene);
      },
    };
  },
};

const bigSmile: Lens = {
  id: 'smile',
  name: 'Big Smile',
  icon: '😁',
  group: 'funny',
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          for (const id of [LM.mouthCornerA, LM.mouthCornerB]) {
            const p = f.p(id);
            push(c, f, p, 0.22, sideOf(f, p) * 0.07, -0.09);
          }
          c.bulge(f.mouth, f.s * 0.32, 0.36);
          push(c, f, f.p(50), 0.2, 0, -0.03);
          push(c, f, f.p(280), 0.2, 0, -0.03);
        }
      },
    };
  },
};

const jelly: Lens = {
  id: 'jelly',
  name: 'Jelly Face',
  icon: '🍮',
  group: 'funny',
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          const pts = [f.p(50), f.p(280), f.p(151), f.p(LM.chin), f.p(LM.noseTip), f.mouth];
          pts.forEach((p, i) => c.bulge(p, f.s * 0.33, Math.sin(c.t * 7 + i * 1.3) * 0.35));
        }
      },
    };
  },
};

const babyFace: Lens = {
  id: 'baby',
  name: 'Baby Face',
  icon: '👶',
  group: 'funny',
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          c.bulge(f.eyeL, f.eyeSize * 3.2, 0.42);
          c.bulge(f.eyeR, f.eyeSize * 3.2, 0.42);
          c.bulge(f.p(LM.noseTip), f.s * 0.2, -0.45);
          c.bulge(f.mouth, f.s * 0.22, -0.35);
          push(c, f, f.p(LM.chin), 0.45, 0, -0.08);
          c.bulge(f.p(205), f.s * 0.25, 0.15);
          c.bulge(f.p(425), f.s * 0.25, 0.15);
          c.paint(f, 'blush', 'normal', 0.9);
          if (f.mouthOpen < 0.35) c.sprite(f, 'pacifier', { at: f.mouth, w: 0.3, pivot: [0.5, 0.37], z: 0.05, layer: 12 });
        }
      },
    };
  },
};

const funhouse: Lens = {
  id: 'funhouse',
  name: 'Funhouse',
  icon: '🪞',
  group: 'funny',
  variants: [
    { name: 'Tall', swatch: '↕️' },
    { name: 'Wide', swatch: '↔️' },
  ],
  create() {
    return {
      frame(c) {
        const k = c.variant === 1 ? -1 : 1;
        for (const f of c.faces) {
          push(c, f, f.p(LM.foreheadTop), 0.55, 0, -0.13 * k);
          push(c, f, f.p(LM.chin), 0.55, 0, 0.13 * k);
          for (const id of [LM.sideA, LM.sideB]) {
            const p = f.p(id);
            push(c, f, p, 0.45, -sideOf(f, p) * 0.09 * k, 0);
          }
        }
      },
    };
  },
};

export const FUNNY_LENSES = [bigEyes, bobble, shook, crybaby, bigSmile, babyFace, jelly, funhouse];
