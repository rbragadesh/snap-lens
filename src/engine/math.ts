export type Vec3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** a + b*s */
export const madd = (a: Vec3, b: Vec3, s: number): Vec3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Small seeded PRNG so art and particle layouts are stable between frames. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

/** Critically damped spring used for wobbly ears, antennae and similar. */
export class Spring {
  x = 0;
  v = 0;
  constructor(public stiffness = 120, public damping = 9) {}
  update(target: number, dt: number) {
    const a = this.stiffness * (target - this.x) - this.damping * this.v;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

/** One Euro filter: low jitter when still, low lag when moving. */
export class OneEuro {
  private x?: Float32Array;
  private dx?: Float32Array;
  constructor(
    public minCutoff = 1.2,
    public beta = 6,
    public dCutoff = 1,
  ) {}
  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  reset() {
    this.x = undefined;
    this.dx = undefined;
  }
  filter(input: Float32Array, dt: number): Float32Array {
    if (!this.x || this.x.length !== input.length || !this.dx) {
      this.x = Float32Array.from(input);
      this.dx = new Float32Array(input.length);
      return this.x;
    }
    const ad = OneEuro.alpha(this.dCutoff, dt);
    const x = this.x;
    const dx = this.dx;
    for (let i = 0; i < input.length; i++) {
      const d = (input[i] - x[i]) / dt;
      dx[i] += ad * (d - dx[i]);
      const cutoff = this.minCutoff + this.beta * Math.abs(dx[i]);
      const a = OneEuro.alpha(cutoff, dt);
      x[i] += a * (input[i] - x[i]);
    }
    return x;
  }
}
