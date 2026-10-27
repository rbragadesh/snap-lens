import { Particles } from '../engine/particles';
import { RAINBOW, hex, type Lens } from './types';

export const USER_BG = 'userbg';

const SCENE_VARIANTS = [
  { name: 'Space', swatch: '🚀', scene: 'space' },
  { name: 'Ocean', swatch: '🐠', scene: 'ocean' },
  { name: 'Rainbow', swatch: '🌈', scene: 'rainbow' },
  { name: 'Candy', swatch: '🍭', scene: 'candy' },
  { name: 'Snow', swatch: '⛄', scene: 'snowy' },
  { name: 'Beach', swatch: '🏖️', scene: 'beach' },
  { name: 'Blur', swatch: '🌫️', scene: 'blur' },
  { name: 'My Photo', swatch: '🖼️', scene: 'user' },
];

const teleport: Lens = {
  id: 'teleport',
  name: 'Teleport',
  icon: '🚀',
  group: 'world',
  faces: 1,
  seg: 'person',
  variants: SCENE_VARIANTS.map(({ name, swatch }) => ({ name, swatch })),
  create() {
    const fx = new Particles(200);
    return {
      frame(c) {
        const v = SCENE_VARIANTS[c.variant] ?? SCENE_VARIANTS[0];
        if (v.scene === 'blur') c.scene.bg = { kind: 'blur' };
        else if (v.scene === 'user') {
          if (c.userBg) c.scene.bg = { kind: 'tex', tex: USER_BG };
          else {
            c.scene.bg = { kind: 'blur' };
            c.message = 'Tap 🖼️ again to pick a photo';
          }
        } else c.scene.bg = { kind: 'tex', tex: `scene:${v.scene}` };

        const r = Math.random();
        if (v.scene === 'space' && r < 0.4) {
          fx.emit({ tex: 'sparkle', x: Math.random() * c.W, y: Math.random() * c.H * 0.7, size: c.W * 0.03, max: 1, additive: true, layer: 1 });
        } else if (v.scene === 'ocean' && r < 0.25) {
          fx.emit({ tex: 'bubble', x: Math.random() * c.W, y: c.H + 30, vy: -c.H * 0.15, wobble: 50, size: c.W * (0.02 + Math.random() * 0.04), max: 9, fade: 0.05, layer: 16 });
        } else if (v.scene === 'snowy' && r < 0.5) {
          fx.emit({ tex: 'snowflake', x: Math.random() * c.W, y: -20, vy: c.H * 0.1, wobble: 40, size: c.W * 0.025, spin: 1, max: 12, layer: 16 });
        } else if (v.scene === 'candy' && r < 0.08) {
          fx.emit({ tex: 'heart', x: Math.random() * c.W, y: c.H + 30, vy: -c.H * 0.12, wobble: 60, size: c.W * 0.04, max: 9, layer: 16 });
        }
        fx.update(c.dt);
        fx.draw(c.scene);
      },
    };
  },
};

const HAIR = [
  { name: 'Pink', swatch: '#ff4fa3' },
  { name: 'Purple', swatch: '#9c4dff' },
  { name: 'Blue', swatch: '#2f8cff' },
  { name: 'Mint', swatch: '#2ee6a6' },
  { name: 'Gold', swatch: '#ffc61a' },
  { name: 'Rainbow', swatch: 'linear-gradient(90deg,#ff1744,#ffea00,#00e676,#2979ff,#d500f9)' },
];

const hair: Lens = {
  id: 'hair',
  name: 'Magic Hair',
  icon: '💇',
  group: 'world',
  faces: 1,
  seg: 'hair',
  variants: HAIR,
  create() {
    return {
      frame(c) {
        const v = HAIR[c.variant] ?? HAIR[0];
        const rainbow = v.name === 'Rainbow';
        c.scene.hair = { color: rainbow ? RAINBOW[0] : hex(v.swatch), rainbow, amount: 0.85 };
      },
    };
  },
};

export const WORLD_LENSES = [teleport, hair];
