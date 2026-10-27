import { Particles } from '../engine/particles';
import { canvas } from '../art/util';
import { RAINBOW, type Lens, type LensCtx } from './types';

const GOOD = ['🍓', '🍉', '🍌', '🍪', '🍩', '🧁', '🍎', '🍇', '🍕', '🍦'];
const HOT = '🌶️';
const ROUND = 30;

interface Item {
  x: number;
  y: number;
  vy: number;
  rot: number;
  spin: number;
  ch: string;
}

const snackAttack: Lens = {
  id: 'snacks',
  name: 'Snack Attack',
  icon: '🍓',
  group: 'games',
  hint: 'Catch snacks with your mouth! Watch out for 🌶️',
  create() {
    let state: 'ready' | 'play' | 'over' = 'ready';
    let items: Item[] = [];
    let score = 0;
    let best = 0;
    let left = ROUND;
    let spawnIn = 0;
    let overAt = 0;
    let hud: HTMLCanvasElement | null = null;
    let hudKey = '';
    const fx = new Particles(300);

    const drawHud = (c: LensCtx) => {
      const secs = Math.ceil(left);
      const key = `${state}|${score}|${secs}|${c.W}x${c.H}|${best}`;
      if (key === hudKey && hud) return;
      hudKey = key;
      if (!hud || hud.width !== c.W || hud.height !== c.H) hud = canvas(c.W, c.H);
      const g = hud.getContext('2d')!;
      g.clearRect(0, 0, c.W, c.H);
      const u = Math.min(c.W, c.H) / 28;
      g.textBaseline = 'middle';
      const pill = (text: string, x: number, y: number, align: CanvasTextAlign, bg: string) => {
        // shrink long messages so they always fit across the picture
        let size = u * 1.3;
        g.font = `bold ${Math.round(size)}px system-ui, -apple-system, sans-serif`;
        const fit = (c.W - u * 4) / (g.measureText(text).width || 1);
        if (fit < 1) {
          size *= fit;
          g.font = `bold ${Math.round(size)}px system-ui, -apple-system, sans-serif`;
        }
        const w = g.measureText(text).width + u * 1.4;
        const h = u * 2;
        const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
        g.fillStyle = bg;
        g.beginPath();
        g.roundRect(x0, y - h / 2, w, h, h / 2);
        g.fill();
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.fillText(text, x0 + w / 2, y + u * 0.05);
      };
      if (state === 'play') {
        pill(`⭐ ${score}`, u, u * 2.2, 'left', 'rgba(124,77,255,0.85)');
        pill(`⏱ ${secs}`, c.W - u, u * 2.2, 'right', secs <= 5 ? 'rgba(229,57,53,0.9)' : 'rgba(0,0,0,0.55)');
      } else if (state === 'ready') {
        pill('😮 Open your mouth to start!', c.W / 2, c.H * 0.14, 'center', 'rgba(124,77,255,0.88)');
      } else {
        pill(`🎉 You ate ${score} snacks!`, c.W / 2, c.H * 0.14, 'center', 'rgba(255,64,129,0.9)');
        if (best > 0) pill(`🏆 Best: ${best}`, c.W / 2, c.H * 0.14 + u * 2.6, 'center', 'rgba(0,0,0,0.55)');
      }
      c.scene.hudVersion++;
    };

    const burst = (x: number, y: number, s: number, hot: boolean) => {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        fx.emit({
          tex: hot ? 'flame' : 'sparkle',
          x,
          y,
          vx: Math.cos(a) * s * 1.5,
          vy: Math.sin(a) * s * 1.5,
          drag: 3,
          size: s * (hot ? 0.3 : 0.15),
          grow: hot ? 2 : 1,
          max: 0.6,
          additive: true,
          tint: hot ? [1, 1, 1] : RAINBOW[i % 6],
        });
      }
    };

    return {
      frame(c) {
        const faces = c.faces;
        const anyOpen = faces.some((f) => f.mouthOpen > 0.4);
        if (state === 'ready' || state === 'over') {
          if (faces.length === 0) c.message = 'Show your face to play!';
          if (anyOpen && (state === 'ready' || c.t - overAt > 2)) {
            state = 'play';
            score = 0;
            left = ROUND;
            items = [];
            spawnIn = 0.3;
          }
        }
        if (state === 'play') {
          left -= c.dt;
          spawnIn -= c.dt;
          const speedUp = 1 + (ROUND - left) / ROUND;
          if (spawnIn <= 0) {
            spawnIn = (0.55 + Math.random() * 0.5) / speedUp;
            const hot = Math.random() < 0.18;
            items.push({
              x: c.W * (0.12 + Math.random() * 0.76),
              y: -c.H * 0.05,
              vy: c.H * (0.22 + Math.random() * 0.12) * speedUp,
              rot: 0,
              spin: (Math.random() - 0.5) * 3,
              ch: hot ? HOT : GOOD[Math.floor(Math.random() * GOOD.length)],
            });
          }
          for (const it of items) {
            it.y += it.vy * c.dt;
            it.rot += it.spin * c.dt;
          }
          items = items.filter((it) => {
            for (const f of faces) {
              if (f.mouthOpen < 0.32) continue;
              if (Math.hypot(it.x - f.mouth[0], it.y - f.mouth[1]) < f.s * 0.28) {
                const hot = it.ch === HOT;
                score = Math.max(0, score + (hot ? -2 : 1));
                burst(it.x, it.y, f.s * 0.5, hot);
                return false;
              }
            }
            return it.y < c.H * 1.1;
          });
          if (left <= 0) {
            state = 'over';
            overAt = c.t;
            best = Math.max(best, score);
            items = [];
          }
        }
        const size = Math.min(c.W, c.H) * 0.11;
        for (const it of items) c.sprite2d(`emoji:${it.ch}`, it.x, it.y, size, { rot: it.rot, layer: 14 });
        fx.update(c.dt);
        fx.draw(c.scene);
        drawHud(c);
        c.scene.hud = hud;
      },
    };
  },
};

export const GAME_LENSES = [snackAttack];
