import type { RGB, Scene } from './scene';
import { screenQuad } from './scene';

export interface Particle {
  tex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  drag: number;
  life: number;
  max: number;
  size: number;
  /** size multiplier at end of life */
  grow: number;
  rot: number;
  spin: number;
  alpha: number;
  tint: RGB;
  additive: boolean;
  /** fade in/out fraction of life */
  fade: number;
  wobble: number;
  layer: number;
  aspect: number;
}

export type ParticleInit = Partial<Particle> & { tex: string; x: number; y: number };

export class Particles {
  list: Particle[] = [];
  constructor(public max = 400) {}

  emit(p: ParticleInit) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      drag: 0,
      life: 0,
      max: 1.5,
      size: 40,
      grow: 1,
      rot: 0,
      spin: 0,
      alpha: 1,
      tint: [1, 1, 1],
      additive: false,
      fade: 0.25,
      wobble: 0,
      layer: 5,
      aspect: 1,
      ...p,
    });
  }

  update(dt: number) {
    for (const p of this.list) {
      p.life += dt;
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt + (p.wobble ? Math.sin(p.life * 6 + p.size) * p.wobble * dt : 0);
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    this.list = this.list.filter((p) => p.life < p.max);
  }

  draw(scene: Scene) {
    for (const p of this.list) {
      const t = p.life / p.max;
      const s = p.size * (1 + (p.grow - 1) * t);
      const fadeIn = Math.min(1, t / Math.max(0.001, p.fade * 0.4));
      const fadeOut = Math.min(1, (1 - t) / Math.max(0.001, p.fade));
      scene.sprites.push({
        tex: p.tex,
        q: screenQuad(p.x, p.y, s, s / p.aspect, p.rot),
        alpha: p.alpha * Math.min(fadeIn, fadeOut),
        additive: p.additive,
        layer: p.layer,
        tint: p.tint,
      });
    }
  }

  clear() {
    this.list = [];
  }
}
