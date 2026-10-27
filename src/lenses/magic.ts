import type { FaceGeom } from '../engine/face';
import { Particles } from '../engine/particles';
import { emitRainbow } from './cute';
import { O, dir2, pair, perFace, pulse, wobbler } from './helpers';
import { RAINBOW, type Lens, type LensCtx } from './types';

const rainbow: Lens = {
  id: 'rainbow',
  name: 'Rainbow Mouth',
  icon: '🌈',
  group: 'magic',
  hint: 'Open your mouth!',
  create() {
    const ps = new Particles(1500);
    return {
      frame(c) {
        for (const f of c.faces) {
          if (f.mouthOpen > 0.35) emitRainbow(ps, f.mouth, f.ux, f.uy, f.s, Math.min(1, f.mouthOpen), c.dt);
          else c.sprite(f, 'rainbowArc', { at: O, y: -0.6, z: -0.25, w: 0.9, alpha: 0.95 });
        }
        ps.update(c.dt);
        ps.draw(c.scene);
      },
    };
  },
};

const dragon: Lens = {
  id: 'dragon',
  name: 'Dragon',
  icon: '🐉',
  group: 'magic',
  hint: 'Open your mouth to breathe fire!',
  create() {
    const fire = new Particles(500);
    return {
      frame(c) {
        let breathing = 0;
        for (const f of c.faces) {
          pair(c, f, 'dragonHorn', { x: 0.24, y: -0.4, w: 0.18, z: -0.2, rot: -0.1, pivot: [0.5, 0.95] });
          if (f.mouthOpen > 0.35) {
            breathing = Math.max(breathing, f.mouthOpen);
            // aim where the face points: down the face plus a bit towards the viewer's turn
            const [dx, dy] = dir2([f.uy[0] + f.uz[0] * 2, f.uy[1] + f.uz[1] * 2, 0]);
            for (let i = 0; i < 6; i++) {
              const sp = f.s * (2.2 + Math.random() * 1.4);
              const a = (Math.random() - 0.5) * 0.35;
              const ca = Math.cos(a);
              const sa = Math.sin(a);
              fire.emit({
                tex: 'flame',
                x: f.mouth[0],
                y: f.mouth[1],
                vx: (dx * ca - dy * sa) * sp,
                vy: (dx * sa + dy * ca) * sp,
                ay: -f.s * 1.5,
                drag: 1.2,
                size: f.s * 0.12,
                grow: 4,
                max: 0.7 + Math.random() * 0.3,
                additive: true,
                fade: 0.4,
                spin: 2,
                layer: 14,
              });
            }
          }
        }
        if (breathing) c.tint([1.15, 0.85, 0.6], 0.25 * breathing, 1.05, 1.05);
        fire.update(c.dt);
        fire.draw(c.scene);
      },
    };
  },
};

const love: Lens = {
  id: 'love',
  name: 'Love Eyes',
  icon: '😍',
  group: 'magic',
  hint: 'Smile!',
  create() {
    const hearts = new Particles(150);
    return {
      frame(c) {
        c.tint([1, 0.85, 0.9], 0.2);
        for (const f of c.faces) {
          const beat = 1 + Math.max(0, Math.sin(c.t * 8)) * 0.18;
          for (const e of [f.eyeL, f.eyeR]) c.sprite(f, 'heart', { at: e, w: 0.27 * beat, z: 0.05, layer: 12 });
          if (Math.random() < 0.1 + f.smile * 0.6) {
            const p = f.at(O, (Math.random() - 0.5) * 1.2, 0.3);
            hearts.emit({
              tex: 'heart',
              x: p[0],
              y: p[1],
              vx: (Math.random() - 0.5) * f.s * 0.4,
              vy: -f.s * (0.6 + Math.random() * 0.6),
              wobble: f.s * 0.5,
              size: f.s * (0.08 + Math.random() * 0.08),
              max: 2.5,
              spin: (Math.random() - 0.5) * 1.5,
              layer: 15,
            });
          }
        }
        hearts.update(c.dt);
        hearts.draw(c.scene);
      },
    };
  },
};

const bubbles: Lens = {
  id: 'bubbles',
  name: 'Bubbles',
  icon: '🫧',
  group: 'magic',
  hint: 'Make a kissy face or open your mouth!',
  create() {
    const ps = new Particles(120);
    return {
      frame(c) {
        for (const f of c.faces) {
          const blow = Math.max(f.pucker, f.mouthOpen);
          if (blow > 0.45 && Math.random() < 0.35) {
            const [dx, dy] = dir2(f.uy);
            ps.emit({
              tex: 'bubble',
              x: f.mouth[0],
              y: f.mouth[1],
              vx: dx * f.s * 0.3 + (Math.random() - 0.5) * f.s * 0.8,
              vy: dy * f.s * 0.3 - f.s * (0.5 + Math.random() * 0.4),
              wobble: f.s * 0.6,
              size: f.s * (0.08 + Math.random() * 0.15),
              grow: 1.4,
              drag: 0.5,
              max: 3 + Math.random() * 2,
              fade: 0.08,
              layer: 15,
            });
          }
        }
        ps.update(c.dt);
        ps.draw(c.scene);
      },
    };
  },
};

const snowQueen: Lens = {
  id: 'snow',
  name: 'Snow Queen',
  icon: '❄️',
  group: 'magic',
  hint: 'Blink for ice magic!',
  create() {
    const snow = new Particles(250);
    const magic = new Particles(150);
    const st = perFace(() => ({ was: false }));
    return {
      frame(c) {
        c.tint([0.85, 0.95, 1.15], 0.35, 0.85, 1.05);
        for (const f of c.faces) {
          c.sprite(f, 'crownIce', { at: O, y: -0.46, z: -0.2, w: 0.7, pivot: [0.5, 0.9] });
          const s = st(f);
          const blinking = f.blink > 0.5;
          if (blinking && !s.was) {
            for (const e of [f.eyeL, f.eyeR]) {
              for (let i = 0; i < 14; i++) {
                const a = Math.random() * Math.PI * 2;
                const v = f.s * (0.4 + Math.random() * 0.8);
                magic.emit({ tex: Math.random() < 0.5 ? 'snowflake' : 'sparkle', x: e[0], y: e[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2, size: f.s * 0.09, spin: 3, max: 1.2, additive: true, tint: [0.7, 0.9, 1] });
              }
            }
          }
          s.was = blinking;
        }
        if (Math.random() < 0.6) {
          snow.emit({ tex: 'snowflake', x: Math.random() * c.W, y: -20, vy: c.H * (0.08 + Math.random() * 0.08), wobble: 40, size: c.W * (0.015 + Math.random() * 0.025), spin: 1, max: 12, alpha: 0.9, layer: 16 });
        }
        snow.update(c.dt);
        snow.draw(c.scene);
        magic.update(c.dt);
        magic.draw(c.scene);
      },
    };
  },
};

const magicHands: Lens = {
  id: 'hands',
  name: 'Magic Hands',
  icon: '✨',
  group: 'magic',
  hint: 'Wave your hands! Open your palm for stars.',
  faces: 0,
  hands: true,
  create() {
    const ps = new Particles(500);
    const opened = [false, false];
    return {
      frame(c) {
        c.hands.forEach((h, i) => {
          for (const tip of [4, 8, 12, 16, 20]) {
            if (tip !== 8 && Math.random() < 0.6) continue;
            const p = h.p(tip);
            ps.emit({
              tex: 'sparkle',
              x: p[0],
              y: p[1],
              vx: (Math.random() - 0.5) * h.size,
              vy: (Math.random() - 0.5) * h.size + h.size * 0.3,
              size: h.size * (tip === 8 ? 0.35 : 0.2),
              max: 0.9,
              additive: true,
              tint: RAINBOW[Math.floor(c.t * 4 + tip) % 6],
            });
          }
          const open = h.open > 0.7;
          if (open && !opened[i]) {
            const palm = h.p(9);
            for (let k = 0; k < 18; k++) {
              const a = (k / 18) * Math.PI * 2;
              ps.emit({ tex: 'star', x: palm[0], y: palm[1], vx: Math.cos(a) * h.size * 3, vy: Math.sin(a) * h.size * 3, drag: 2, size: h.size * 0.35, spin: 4, max: 1.2 });
            }
          }
          opened[i] = open;
          if (h.pinch < 0.25 && Math.random() < 0.3) {
            const p = h.p(8);
            ps.emit({ tex: 'heart', x: p[0], y: p[1], vy: -h.size * 1.5, size: h.size * 0.3, max: 1.4, wobble: h.size });
          }
        });
        ps.update(c.dt);
        ps.draw(c.scene);
      },
    };
  },
};

const tiger: Lens = {
  id: 'tiger',
  name: 'Tiger',
  icon: '🐯',
  group: 'paint',
  create() {
    const wob = wobbler();
    return {
      frame(c) {
        for (const f of c.faces) {
          c.paint(f, 'tiger', 'shade', 0.95);
          pair(c, f, 'bearEar', { x: 0.38, y: -0.48, w: 0.26, rot: 0.25, pivot: [0.5, 0.7] }, wob(c, f) * 0.2);
        }
      },
    };
  },
};

const glitter: Lens = {
  id: 'glitter',
  name: 'Glitter',
  icon: '💫',
  group: 'paint',
  create() {
    const sp = new Particles(60);
    return {
      frame(c) {
        for (const f of c.faces) {
          c.paint(f, 'glitter', 'normal');
          if (Math.random() < 0.35) {
            const ids = [50, 280, 33, 263, 151, 205, 425];
            const p = f.p(ids[Math.floor(Math.random() * ids.length)]);
            sp.emit({ tex: 'sparkle', x: p[0] + (Math.random() - 0.5) * f.s * 0.2, y: p[1] + (Math.random() - 0.5) * f.s * 0.1, size: f.s * 0.08, max: 0.6, additive: true, tint: RAINBOW[Math.floor(Math.random() * 6)] });
          }
        }
        sp.update(c.dt);
        sp.draw(c.scene);
      },
    };
  },
};

const facePaints: Lens = {
  id: 'facepaint',
  name: 'Face Paint',
  icon: '🎨',
  group: 'paint',
  variants: [
    { name: 'Panda', swatch: '🐼' },
    { name: 'Zebra', swatch: '🦓' },
    { name: 'Robot', swatch: '🤖' },
    { name: 'Clown', swatch: '🤡' },
  ],
  create() {
    return {
      frame(c) {
        const name = ['panda', 'zebra', 'robot', 'clown'][c.variant] ?? 'panda';
        for (const f of c.faces) {
          c.paint(f, name, 'shade');
          if (name === 'robot') {
            c.sprite(f, 'antennaAlien', { at: O, y: -0.45, z: -0.2, w: 0.14, pivot: [0.5, 0.98], tint: [0.8, 0.85, 0.9] });
            c.sprite(f, 'glow', { at: f.at(O, 0, -0.27), w: 0.15 * pulse(c.t, 8, 0.3), additive: true, tint: [1, 0.2, 0.2], alpha: 0.8, layer: 12 });
          }
          if (name === 'panda') pairEars(c, f);
        }
      },
    };
  },
};

function pairEars(c: LensCtx, f: FaceGeom) {
  pair(c, f, 'pandaEar', { x: 0.38, y: -0.5, w: 0.3, rot: 0.2, pivot: [0.5, 0.7] });
}

export const MAGIC_LENSES = [rainbow, dragon, love, bubbles, snowQueen, magicHands];
export const PAINT_LENSES = [tiger, glitter, facePaints];
