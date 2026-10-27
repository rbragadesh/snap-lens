import { LM } from '../engine/face';
import type { Vec3 } from '../engine/math';
import { Particles } from '../engine/particles';
import { O, dir2, pair, perFace, pulse, wobbler } from './helpers';
import { RAINBOW, hex, type Lens } from './types';

const puppy: Lens = {
  id: 'puppy',
  name: 'Puppy',
  icon: '🐶',
  group: 'cute',
  hint: 'Open your mouth!',
  variants: [
    { name: 'Brown', swatch: '#8d6e63' },
    { name: 'Pink', swatch: '#f48fb1' },
  ],
  create() {
    const wob = wobbler();
    const hearts = new Particles(60);
    let next = 0;
    return {
      frame(c) {
        const pink = c.variant === 1;
        if (pink) c.tint([1, 0.78, 0.88], 0.35, 1.05, 1.03);
        for (const f of c.faces) {
          const w = wob(c, f);
          pair(c, f, pink ? 'dogEarPink' : 'dogEarBrown', { x: 0.37, y: -0.52, w: 0.44, z: -0.3, rot: 0.15, pivot: [0.83, 0.08] }, w);
          c.sprite(f, 'dogNose', { at: LM.noseTip, y: -0.02, z: 0.02, w: 0.3, layer: 12 });
          if (f.mouthOpen > 0.3) {
            const open = Math.min(1, (f.mouthOpen - 0.3) / 0.35);
            c.sprite(f, 'tongue', {
              at: LM.lowerLipIn,
              y: -0.02,
              w: 0.2,
              h: 0.05 + 0.3 * open,
              pivot: [0.5, 0.04],
              rot: Math.sin(c.t * 9) * 0.1,
              layer: 11,
            });
          }
          if (pink && c.t > next) {
            next = c.t + 0.35;
            const p = f.at(O, (Math.random() - 0.5) * 1.4, -0.5);
            hearts.emit({ tex: 'heart', x: p[0], y: p[1], vy: -f.s * 0.4, size: f.s * 0.12, max: 2.2, wobble: f.s * 0.4, layer: 3 });
          }
        }
        hearts.update(c.dt);
        hearts.draw(c.scene);
      },
    };
  },
};

const kitty: Lens = {
  id: 'kitty',
  name: 'Kitty',
  icon: '🐱',
  group: 'cute',
  variants: [
    { name: 'Ginger', swatch: '#ffb74d' },
    { name: 'Grey', swatch: '#b0bec5' },
  ],
  create() {
    const wob = wobbler();
    return {
      frame(c) {
        for (const f of c.faces) {
          const w = wob(c, f) * 0.4 + Math.sin(c.t * 2.3) * 0.03;
          pair(c, f, c.variant ? 'catEarGrey' : 'catEar', { x: 0.33, y: -0.5, w: 0.36, rot: 0.28, pivot: [0.5, 0.95] }, w);
          c.paint(f, 'kitty', 'normal');
        }
      },
    };
  },
};

const bunny: Lens = {
  id: 'bunny',
  name: 'Bunny',
  icon: '🐰',
  group: 'cute',
  hint: 'Smile big!',
  create() {
    const wob = wobbler();
    return {
      frame(c) {
        for (const f of c.faces) {
          const w = wob(c, f) * 0.6;
          // one ear flops a little
          c.sprite(f, 'bunnyEar', { at: O, x: -0.17, y: -0.58, z: -0.3, w: 0.22, rot: -0.12 + w, pivot: [0.5, 0.97] });
          c.sprite(f, 'bunnyEar', { at: O, x: 0.17, y: -0.58, z: -0.3, w: 0.22, rot: 0.3 + w + Math.sin(c.t * 3) * 0.06, pivot: [0.5, 0.97], flipX: true });
          c.sprite(f, 'bunnyNose', { at: LM.noseTip, y: -0.01, z: 0.02, w: 0.12, layer: 12 });
          c.paint(f, 'blush', 'normal', 0.8);
          if (f.mouthOpen > 0.12 || f.smile > 0.4) {
            c.sprite(f, 'bunnyTeeth', { at: LM.upperLipIn, y: -0.015, w: 0.13, pivot: [0.5, 0.05], layer: 11 });
          }
        }
      },
    };
  },
};

const teddy: Lens = {
  id: 'teddy',
  name: 'Teddy',
  icon: '🐻',
  group: 'cute',
  variants: [
    { name: 'Teddy', swatch: '#8d6e63' },
    { name: 'Panda', swatch: '#212121' },
    { name: 'Mouse', swatch: '#9e9e9e' },
  ],
  create() {
    const wob = wobbler();
    return {
      frame(c) {
        for (const f of c.faces) {
          const w = wob(c, f) * 0.3;
          const ear = ['bearEar', 'pandaEar', 'mouseEar'][c.variant] ?? 'bearEar';
          const big = c.variant === 2 ? 1.35 : 1;
          pair(c, f, ear, { x: 0.38, y: -0.5, w: 0.3 * big, rot: 0.2, pivot: [0.5, 0.7] }, w);
          if (c.variant === 1) c.paint(f, 'panda', 'shade');
          else {
            c.paint(f, 'blush', 'normal', 0.7);
            c.sprite(f, c.variant === 2 ? 'bunnyNose' : 'bearNose', { at: LM.noseTip, y: -0.01, z: 0.02, w: c.variant === 2 ? 0.12 : 0.2, layer: 12 });
          }
        }
      },
    };
  },
};

const FLOWER_SETS = [
  ['flowerPink', 'flowerWhite', 'flowerPurple'],
  ['flowerYellow', 'flowerWhite', 'flowerYellow'],
  ['flowerPink', 'flowerYellow', 'flowerBlue', 'flowerPurple', 'flowerWhite'],
];

const flowerCrown: Lens = {
  id: 'flowers',
  name: 'Flower Crown',
  icon: '🌸',
  group: 'cute',
  variants: [
    { name: 'Pink', swatch: '#f48fb1' },
    { name: 'Sunflower', swatch: '#ffd54f' },
    { name: 'Rainbow', swatch: 'linear-gradient(90deg,#f48fb1,#ffd54f,#81d4fa,#b39ddb)' },
  ],
  create() {
    return {
      frame(c) {
        const set = FLOWER_SETS[c.variant] ?? FLOWER_SETS[0];
        for (const f of c.faces) {
          c.paint(f, 'blush', 'normal', 0.6);
          const n = 9;
          for (let i = 0; i < n; i++) {
            const t = (i / (n - 1)) * 2 - 1; // -1..1 across the head
            const a = t * 1.25;
            const x = Math.sin(a) * 0.5;
            const y = -0.36 - Math.cos(a) * 0.12;
            const big = i % 2 === 0;
            if (!big) c.sprite(f, 'leaf', { at: O, x, y: y - 0.02, z: -0.15, w: 0.2, rot: a + 0.6, layer: 8 });
            c.sprite(f, set[i % set.length], {
              at: O,
              x,
              y,
              z: -0.1 - Math.abs(t) * 0.25,
              w: big ? 0.28 : 0.21,
              rot: a + Math.sin(c.t * 1.5 + i) * 0.08,
              layer: 9 + (big ? 1 : 0),
            });
          }
          // two butterflies fluttering around the head
          for (let k = 0; k < 2; k++) {
            const ph = c.t * 0.8 + k * Math.PI;
            const p = f.at(O, Math.cos(ph) * 0.75, -0.35 + Math.sin(ph * 1.7) * 0.25, Math.sin(ph) * 0.3);
            const flap = Math.abs(Math.sin(c.t * 14 + k));
            c.sprite2d('butterfly', p[0], p[1], f.s * 0.22 * (0.4 + 0.6 * flap), {
              h: f.s * 0.18,
              rot: Math.sin(ph) * 0.4,
              tint: k ? [1, 0.6, 0.85] : [0.6, 0.8, 1],
              layer: 14,
            });
          }
        }
      },
    };
  },
};

const royal: Lens = {
  id: 'royal',
  name: 'Royal',
  icon: '👑',
  group: 'cute',
  variants: [
    { name: 'Gold', swatch: '#ffca28' },
    { name: 'Ice', swatch: '#81d4fa' },
    { name: 'Pink', swatch: '#f48fb1' },
  ],
  create() {
    return {
      frame(c) {
        const tex = ['crownGold', 'crownIce', 'crownPink'][c.variant] ?? 'crownGold';
        for (const f of c.faces) {
          c.sprite(f, tex, { at: O, y: -0.46, z: -0.2, w: 0.74, pivot: [0.5, 0.9], tilt: -0.1 });
          for (let i = 0; i < 6; i++) {
            const ph = c.t * 2 + i * 1.7;
            const tw = Math.max(0, Math.sin(ph));
            const p = f.at(O, Math.sin(i * 2.1) * 0.38, -0.7 + Math.cos(i * 1.3) * 0.12, 0);
            c.sprite2d('sparkle', p[0], p[1], f.s * 0.16 * tw, { additive: true, layer: 15 });
          }
        }
      },
    };
  },
};

const GLASSES = ['shades', 'heartGlasses', 'starGlasses', 'nerdGlasses', 'roundGlasses'];

const glasses: Lens = {
  id: 'glasses',
  name: 'Glasses',
  icon: '😎',
  group: 'cute',
  variants: [
    { name: 'Cool', swatch: '😎' },
    { name: 'Hearts', swatch: '💖' },
    { name: 'Stars', swatch: '⭐' },
    { name: 'Smart', swatch: '🤓' },
    { name: 'Round', swatch: '🔮' },
  ],
  create() {
    return {
      frame(c) {
        const tex = GLASSES[c.variant] ?? 'shades';
        for (const f of c.faces) c.sprite(f, tex, { at: O, y: 0.035, z: 0.02, w: 0.92 });
      },
    };
  },
};

const party: Lens = {
  id: 'party',
  name: 'Party',
  icon: '🥳',
  group: 'cute',
  hint: 'Open your mouth for confetti!',
  create() {
    const confetti = new Particles(300);
    const st = perFace(() => ({ was: false }));
    return {
      frame(c) {
        for (const f of c.faces) {
          c.sprite(f, 'partyHat', { at: O, x: 0.13, y: -0.5, z: -0.25, w: 0.5, rot: 0.25, pivot: [0.5, 0.92] });
          const s = st(f);
          const open = f.mouthOpen > 0.4;
          if (open && !s.was) {
            for (let i = 0; i < 70; i++) {
              const a = Math.random() * Math.PI * 2;
              const v = f.s * (0.8 + Math.random() * 1.6);
              confetti.emit({
                tex: 'confetti',
                x: f.mouth[0],
                y: f.mouth[1],
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v - f.s,
                ay: f.s * 2.2,
                drag: 1.5,
                size: f.s * 0.05,
                aspect: 0.66,
                spin: (Math.random() - 0.5) * 12,
                max: 2.5,
                tint: RAINBOW[i % RAINBOW.length],
                layer: 16,
              });
            }
          }
          s.was = open;
        }
        if (Math.random() < 0.3) {
          confetti.emit({
            tex: 'confetti',
            x: Math.random() * c.W,
            y: -20,
            vy: c.H * 0.15,
            wobble: 60,
            size: c.W * 0.015,
            aspect: 0.66,
            spin: 3,
            max: 6,
            tint: RAINBOW[Math.floor(Math.random() * 6)],
            layer: 2,
          });
        }
        confetti.update(c.dt);
        confetti.draw(c.scene);
      },
    };
  },
};

const pirate: Lens = {
  id: 'pirate',
  name: 'Pirate',
  icon: '🏴‍☠️',
  group: 'cute',
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          c.sprite(f, 'pirateHat', { at: O, y: -0.4, z: -0.25, w: 1.15, pivot: [0.5, 0.82] });
          c.sprite(f, 'eyePatch', { at: O, y: 0.035, z: 0.0, w: 0.95, layer: 11 });
          c.sprite(f, 'mustache', { at: LM.noseBottom, y: 0.055, z: 0.01, w: 0.42, layer: 12 });
        }
      },
    };
  },
};

const fancy: Lens = {
  id: 'fancy',
  name: 'Fancy',
  icon: '🎩',
  group: 'cute',
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          c.sprite(f, 'topHat', { at: O, x: 0.05, y: -0.45, z: -0.25, w: 0.66, rot: -0.12, pivot: [0.5, 0.86] });
          c.sprite(f, 'monocle', { at: f.eyeR, w: 0.28, pivot: [0.5, 0.25], z: 0.08, layer: 12 });
          c.sprite(f, 'mustache', { at: LM.noseBottom, y: 0.055, z: 0.01, w: 0.5, rot: Math.sin(c.t * 4) * 0.04, layer: 12 });
        }
      },
    };
  },
};

const clown: Lens = {
  id: 'clown',
  name: 'Clown',
  icon: '🤡',
  group: 'cute',
  create() {
    const wob = wobbler();
    return {
      frame(c) {
        for (const f of c.faces) {
          c.paint(f, 'clown', 'shade');
          pair(c, f, 'clownWig', { x: 0.48, y: -0.35, w: 0.55, z: -0.3, pivot: [0.6, 0.5] }, wob(c, f) * 0.3);
          c.sprite(f, 'clownNose', { at: LM.noseTip, z: 0.04, w: 0.22 * pulse(c.t, 5, 0.05), layer: 12 });
        }
      },
    };
  },
};

const angelDevil: Lens = {
  id: 'angel',
  name: 'Angel / Devil',
  icon: '😇',
  group: 'cute',
  variants: [
    { name: 'Angel', swatch: '😇' },
    { name: 'Devil', swatch: '😈' },
  ],
  create() {
    const sparks = new Particles(80);
    return {
      frame(c) {
        for (const f of c.faces) {
          if (c.variant === 0) {
            const bob = Math.sin(c.t * 2) * 0.03;
            c.sprite(f, 'halo', { at: O, y: -0.8 + bob, z: -0.25, w: 0.62, tilt: 1.15 });
            if (Math.random() < 0.3) {
              const p = f.at(O, (Math.random() - 0.5) * 0.7, -0.8);
              sparks.emit({ tex: 'sparkle', x: p[0], y: p[1], vy: f.s * 0.2, size: f.s * 0.08, max: 1.2, additive: true, tint: [1, 0.95, 0.7] });
            }
          } else {
            pair(c, f, 'devilHorn', { x: 0.25, y: -0.42, w: 0.17, z: -0.2, rot: -0.15, pivot: [0.5, 0.95] });
          }
        }
        if (c.variant === 0) c.tint([1, 0.97, 0.88], 0.3, 1, 1.06);
        else c.tint([1, 0.55, 0.5], 0.35, 1.1, 1);
        sparks.update(c.dt);
        sparks.draw(c.scene);
      },
    };
  },
};

const bee: Lens = {
  id: 'bee',
  name: 'Busy Bee',
  icon: '🐝',
  group: 'cute',
  create() {
    const wob = wobbler();
    return {
      frame(c) {
        for (const f of c.faces) {
          const w = wob(c, f) * 0.8;
          pair(c, f, 'antennaBee', { x: 0.16, y: -0.48, w: 0.13, z: -0.25, rot: 0.25, pivot: [0.5, 0.98] }, w + Math.sin(c.t * 5) * 0.06);
          c.paint(f, 'blush', 'normal', 0.6);
          for (let k = 0; k < 3; k++) {
            const ph = c.t * (1.1 + k * 0.25) + (k * Math.PI * 2) / 3;
            const p = f.at(O, Math.cos(ph) * 0.85, 0.05 + Math.sin(ph * 2) * 0.35, Math.sin(ph) * 0.5);
            const front = Math.sin(ph) > -0.2;
            const goingRight = -Math.sin(ph) > 0;
            const size = f.s * (0.18 + 0.05 * Math.sin(ph));
            c.sprite2d('bee', p[0] + Math.sin(c.t * 30 + k) * 2, p[1], size * (goingRight ? 1 : -1), {
              h: size * 0.87,
              alpha: front ? 1 : 0.55,
              layer: front ? 15 : 1,
            });
          }
        }
      },
    };
  },
};

const butterflyLens: Lens = {
  id: 'butterfly',
  name: 'Butterfly',
  icon: '🦋',
  group: 'paint',
  create() {
    return {
      frame(c) {
        for (const f of c.faces) {
          c.paint(f, 'butterfly', 'normal', 0.92);
          for (let k = 0; k < 4; k++) {
            const ph = c.t * 0.6 + k * 1.6;
            const p = f.at(O, Math.cos(ph) * (0.7 + k * 0.08), -0.2 + Math.sin(ph * 1.3) * 0.5, 0);
            const flap = Math.abs(Math.sin(c.t * 12 + k * 2));
            c.sprite2d('butterfly', p[0], p[1], f.s * 0.2 * (0.35 + 0.65 * flap), {
              h: f.s * 0.16,
              tint: RAINBOW[(k * 2) % 6],
              rot: Math.sin(ph * 2) * 0.3,
              layer: 14,
            });
          }
        }
      },
    };
  },
};

const alien: Lens = {
  id: 'alien',
  name: 'Alien',
  icon: '👽',
  group: 'cute',
  create() {
    const wob = wobbler();
    return {
      frame(c) {
        for (const f of c.faces) {
          c.bulge(f.eyeL, f.eyeSize * 3, 0.4);
          c.bulge(f.eyeR, f.eyeSize * 3, 0.4);
          c.paint(f, 'alien', 'multiply', 0.9);
          pair(c, f, 'antennaAlien', { x: 0.2, y: -0.45, w: 0.14, z: -0.25, rot: 0.35, pivot: [0.5, 0.98] }, wob(c, f) + Math.sin(c.t * 4) * 0.08);
        }
      },
    };
  },
};

const HERO_COLORS = ['#e53935', '#1e88e5', '#43a047', '#8e24aa', '#212121'];

const hero: Lens = {
  id: 'hero',
  name: 'Super Hero',
  icon: '🦸',
  group: 'cute',
  variants: HERO_COLORS.map((c, i) => ({ name: ['Red', 'Blue', 'Green', 'Purple', 'Night'][i], swatch: c })),
  create() {
    const stars = new Particles(40);
    return {
      frame(c) {
        for (const f of c.faces) {
          c.sprite(f, 'heroMask', { at: O, y: 0.03, z: 0.02, w: 1.0, tint: hex(HERO_COLORS[c.variant] ?? HERO_COLORS[0]) });
          if (Math.random() < 0.08) {
            const [dx, dy] = dir2(f.ux);
            const side = Math.random() < 0.5 ? -1 : 1;
            const p = f.at(O, side * 0.7, -0.3 + Math.random() * 0.6);
            stars.emit({ tex: 'star', x: p[0], y: p[1], vx: dx * side * f.s * 0.5, vy: dy * side * f.s * 0.5, size: f.s * 0.1, grow: 1.6, spin: 3, max: 1 });
          }
        }
        stars.update(c.dt);
        stars.draw(c.scene);
      },
    };
  },
};

const spooky: Lens = {
  id: 'spooky',
  name: 'Spooky',
  icon: '🎃',
  group: 'cute',
  variants: [
    { name: 'Witch', swatch: '🧙' },
    { name: 'Sugar Skull', swatch: '💀' },
    { name: 'Ghosts', swatch: '👻' },
  ],
  create() {
    const bats = new Particles(30);
    return {
      frame(c) {
        c.tint([0.75, 0.6, 1], 0.3, 0.9, 0.95);
        for (const f of c.faces) {
          if (c.variant === 0) {
            c.sprite(f, 'witchHat', { at: O, x: 0.04, y: -0.38, z: -0.25, w: 1.05, rot: 0.08, pivot: [0.5, 0.86] });
          } else if (c.variant === 1) {
            c.paint(f, 'skull', 'shade');
            const set = ['flowerPink', 'flowerYellow', 'flowerPurple'];
            for (let i = 0; i < 7; i++) {
              const a = ((i / 6) * 2 - 1) * 1.2;
              c.sprite(f, set[i % 3], { at: O, x: Math.sin(a) * 0.5, y: -0.36 - Math.cos(a) * 0.12, z: -0.2, w: 0.2, rot: a });
            }
          } else {
            for (let k = 0; k < 3; k++) {
              const ph = c.t * 0.9 + (k * Math.PI * 2) / 3;
              const p = f.at(O, Math.cos(ph) * 0.85, -0.1 + Math.sin(ph * 2) * 0.3);
              c.sprite2d('ghost', p[0], p[1] + Math.sin(c.t * 3 + k) * f.s * 0.04, f.s * 0.24, {
                alpha: 0.85,
                layer: Math.sin(ph) > 0 ? 15 : 1,
              });
            }
          }
        }
        if (c.variant !== 2 && Math.random() < 0.025) {
          const fromLeft = Math.random() < 0.5;
          bats.emit({
            tex: 'bat',
            x: fromLeft ? -60 : c.W + 60,
            y: c.H * (0.1 + Math.random() * 0.35),
            vx: (fromLeft ? 1 : -1) * c.W * 0.25,
            vy: -c.H * 0.03,
            wobble: c.H * 0.3,
            size: c.W * 0.1,
            aspect: 1.8,
            max: 5,
            layer: 16,
          });
        }
        bats.update(c.dt);
        bats.draw(c.scene);
      },
    };
  },
};

const unicorn: Lens = {
  id: 'unicorn',
  name: 'Unicorn',
  icon: '🦄',
  group: 'cute',
  hint: 'Open your mouth!',
  create() {
    const rainbow = new Particles(1500);
    const sparks = new Particles(60);
    return {
      frame(c) {
        for (const f of c.faces) {
          c.sprite(f, 'unicornHorn', { at: O, y: -0.44, z: -0.15, w: 0.22, pivot: [0.5, 0.97], tilt: -0.15 });
          for (const [x, tex] of [
            [-0.15, 'flowerPink'],
            [0.15, 'flowerPurple'],
          ] as const) {
            c.sprite(f, tex, { at: O, x, y: -0.43, z: -0.15, w: 0.2 });
          }
          c.paint(f, 'blush', 'normal', 0.6);
          if (Math.random() < 0.25) {
            const p = f.at(O, (Math.random() - 0.5) * 0.4, -0.75);
            sparks.emit({ tex: 'sparkle', x: p[0], y: p[1], size: f.s * 0.09, max: 0.8, additive: true, tint: RAINBOW[Math.floor(Math.random() * 6)] });
          }
          if (f.mouthOpen > 0.35) emitRainbow(rainbow, f.mouth, f.ux, f.uy, f.s, Math.min(1, f.mouthOpen), c.dt);
        }
        rainbow.update(c.dt);
        rainbow.draw(c.scene);
        sparks.update(c.dt);
        sparks.draw(c.scene);
      },
    };
  },
};

/** The classic rainbow stream: parallel colour bands pouring out of the mouth. */
export function emitRainbow(ps: Particles, mouth: Vec3, ux: Vec3, uy: Vec3, s: number, strength: number, dt: number) {
  const [dx, dy] = dir2(uy);
  const [px, py] = dir2(ux);
  const band = s * 0.045 * (0.6 + strength * 0.5);
  const v = s * 2.2;
  const g = s * 3.5;
  // emit enough sub-steps that the stream stays continuous even at low frame rates
  const steps = Math.max(1, Math.min(8, Math.round(dt * 60)));
  for (let k = 0; k < steps; k++) {
    const age = (k / steps) * dt;
    for (let i = 0; i < 6; i++) {
      const off = (i - 2.5) * band;
      ps.emit({
        tex: 'blob',
        x: mouth[0] + px * off + dx * v * age,
        y: mouth[1] + py * off + dy * v * age + 0.5 * g * age * age,
        vx: dx * v,
        vy: dy * v + g * age,
        ay: g,
        life: age,
        size: band * 1.6,
        grow: 1.8,
        max: 1.1,
        fade: 0.15,
        tint: RAINBOW[i],
        layer: 13,
      });
    }
  }
}

export const CUTE_LENSES = [puppy, kitty, bunny, teddy, flowerCrown, royal, glasses, unicorn, party, bee, alien, hero, angelDevil, pirate, fancy, clown, spooky];
export const BUTTERFLY_LENS = butterflyLens;
