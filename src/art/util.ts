export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function mk(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void) {
  const c = canvas(w, h);
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g, w, h);
  return c;
}

export const OUTLINE = '#2b1d2e';

export function lin(g: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

export function rad(g: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][], x1 = x, y1 = y) {
  const gr = g.createRadialGradient(x, y, r0, x1, y1, r1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}

/** Fill + outline the current path. */
export function paint(g: Ctx, fill: string | CanvasGradient, stroke: string | null = OUTLINE, lw = 10) {
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

export function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

export function circle(g: Ctx, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}

export function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Heart path centred at (x, y) with half-width s. */
export function heartPath(g: Ctx, x: number, y: number, s: number) {
  g.beginPath();
  g.moveTo(x, y + s * 0.95);
  g.bezierCurveTo(x - s * 1.5, y + s * 0.1, x - s * 1.1, y - s * 1.05, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 1.1, y - s * 1.05, x + s * 1.5, y + s * 0.1, x, y + s * 0.95);
  g.closePath();
}

export function starPath(g: Ctx, x: number, y: number, r: number, points = 5, inner = 0.45, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i * Math.PI) / points;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
  g.closePath();
}

/** Soft white highlight blob for a glossy look. */
export function gloss(g: Ctx, x: number, y: number, rx: number, ry: number, a = 0.55, rot = -0.5) {
  g.save();
  g.globalAlpha = a;
  g.fillStyle = '#fff';
  ellipse(g, x, y, rx, ry, rot);
  g.fill();
  g.restore();
}

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export function emoji(ch: string, size = 192) {
  return mk(size, size, (g) => {
    g.font = `${Math.round(size * 0.82)}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, size / 2, size * 0.54);
  });
}
