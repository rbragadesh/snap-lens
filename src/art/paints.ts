// Face paints drawn in the face mesh's texture space, so they stick to the skin and follow expressions.
import { FACE_UVS } from '../engine/faceMeshData';
import { FACE_OVAL } from '../engine/face';
import { OUTLINE, circle, ellipse, heartPath, lin, mk, rad, starPath, type Ctx } from './util';
import { rng } from '../engine/math';

const S = 1024;
const P = (i: number): [number, number] => [FACE_UVS[i * 2] * S, FACE_UVS[i * 2 + 1] * S];

const EYE_A = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const EYE_B = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
const LIPS_IN = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
const LIPS_OUT = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];

function poly(g: Ctx, ids: number[], grow = 1, dx = 0, dy = 0) {
  const pts = ids.map(P);
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const px = cx + (x - cx) * grow + dx;
    const py = cy + (y - cy) * grow + dy;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  });
  g.closePath();
}

function centre(ids: number[]): [number, number] {
  const pts = ids.map(P);
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
}

/** Fill the whole face, fading out towards the outline so there is no hard edge at the hairline. */
function faceBase(g: Ctx, fill: string | CanvasGradient, fade = 70) {
  poly(g, FACE_OVAL);
  g.fillStyle = fill;
  g.fill();
  softenEdge(g, fade);
}

function softenEdge(g: Ctx, fade: number) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < 8; k++) {
    g.globalAlpha = 0.16;
    g.lineWidth = fade * (1 - k / 8) * 2;
    poly(g, FACE_OVAL);
    g.stroke();
  }
  g.restore();
}

/** Remove paint from the eyes and the open mouth so they stay real. */
function holes(g: Ctx, eyeGrow = 1.3, mouth = true) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  poly(g, EYE_A, eyeGrow);
  g.fill();
  poly(g, EYE_B, eyeGrow);
  g.fill();
  if (mouth) {
    poly(g, LIPS_IN, 1.05);
    g.fill();
  }
  g.restore();
}

function stripe(g: Ctx, x0: number, y0: number, x1: number, y1: number, w: number) {
  // tapered brush stroke from (x0, y0) (thick) to (x1, y1) (point)
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * w;
  const ny = (dx / l) * w;
  g.beginPath();
  g.moveTo(x0 + nx, y0 + ny);
  g.quadraticCurveTo(x0 + dx * 0.5 + nx * 0.6, y0 + dy * 0.5 + ny * 0.6, x1, y1);
  g.quadraticCurveTo(x0 + dx * 0.5 - nx * 0.6, y0 + dy * 0.5 - ny * 0.6, x0 - nx, y0 - ny);
  g.closePath();
  g.fill();
}

const tiger = () =>
  mk(S, S, (g) => {
    faceBase(g, lin(g, 0, 0, 0, S, [
      [0, '#ff9f1c'],
      [1, '#f77f00'],
    ]));
    // white muzzle and eyebrow patches
    g.fillStyle = 'rgba(255,255,255,0.95)';
    const [nx, ny] = P(2);
    const [mx, my] = P(14);
    ellipse(g, nx - 75, ny + 40, 95, 70, 0.2);
    g.fill();
    ellipse(g, nx + 75, ny + 40, 95, 70, -0.2);
    g.fill();
    ellipse(g, mx, my + 60, 110, 90);
    g.fill();
    for (const id of [105, 334]) {
      const [x, y] = P(id);
      ellipse(g, x, y - 10, 70, 30);
      g.fill();
    }
    g.fillStyle = '#1a1a1a';
    // forehead stripes
    const [fx, fy] = P(10);
    stripe(g, fx, fy - 20, fx, fy + 150, 28);
    stripe(g, fx - 120, fy, fx - 70, fy + 140, 24);
    stripe(g, fx + 120, fy, fx + 70, fy + 140, 24);
    // cheek stripes from the sides
    for (const [side, ids] of [
      [-1, [234, 93, 132]],
      [1, [454, 323, 361]],
    ] as const) {
      ids.forEach((id, k) => {
        const [x, y] = P(id);
        stripe(g, x - side * 10, y + k * 20, x + side * (170 - k * 25), y + 10 + k * 30, 22);
      });
    }
    // nose
    const [tx, ty] = P(1);
    g.beginPath();
    g.moveTo(tx - 55, ty - 25);
    g.quadraticCurveTo(tx, ty - 45, tx + 55, ty - 25);
    g.quadraticCurveTo(tx + 10, ty + 40, tx, ty + 45);
    g.quadraticCurveTo(tx - 10, ty + 40, tx - 55, ty - 25);
    g.fill();
    holes(g);
  });

const panda = () =>
  mk(S, S, (g) => {
    faceBase(g, '#fafafa', 60);
    g.fillStyle = '#151515';
    for (const ids of [EYE_A, EYE_B]) {
      const [x, y] = centre(ids);
      const outer = ids === EYE_A ? -1 : 1;
      ellipse(g, x + outer * 12, y + 22, 105, 82, outer * 0.5);
      g.fill();
    }
    const [tx, ty] = P(1);
    ellipse(g, tx, ty - 5, 55, 38);
    g.fill();
    holes(g, 1.35);
  });

const kitty = () =>
  mk(S, S, (g) => {
    const [tx, ty] = P(1);
    // nose
    g.beginPath();
    g.moveTo(tx - 42, ty - 22);
    g.quadraticCurveTo(tx, ty - 34, tx + 42, ty - 22);
    g.quadraticCurveTo(tx + 12, ty + 22, tx, ty + 26);
    g.quadraticCurveTo(tx - 12, ty + 22, tx - 42, ty - 22);
    g.fillStyle = '#f06292';
    g.fill();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 5;
    g.stroke();
    // philtrum
    const [ux, uy] = P(0);
    g.beginPath();
    g.moveTo(tx, ty + 26);
    g.lineTo(ux, uy - 12);
    g.stroke();
    // whiskers
    g.strokeStyle = '#3e2723';
    g.lineWidth = 6;
    for (const side of [-1, 1]) {
      const [cx, cy] = P(side < 0 ? 205 : 425);
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(cx + side * 10, cy + i * 22);
        g.quadraticCurveTo(cx + side * 110, cy + i * 24 - 8, cx + side * 190, cy + i * 45);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,105,150,0.35)';
      const [bx, by] = P(side < 0 ? 50 : 280);
      ellipse(g, bx, by, 60, 40);
      g.fill();
    }
    holes(g);
  });

const butterflyPaint = () =>
  mk(S, S, (g) => {
    const [bx, by] = P(168);
    const grad = (x0: number, x1: number) =>
      lin(g, x0, 0, x1, 0, [
        [0, '#7c4dff'],
        [0.5, '#ff4fa3'],
        [1, '#40c4ff'],
      ]);
    for (const side of [-1, 1]) {
      g.save();
      g.globalAlpha = 0.9;
      // upper wing across the eyelid and brow
      g.beginPath();
      g.moveTo(bx, by + 10);
      g.bezierCurveTo(bx + side * 80, by - 230, bx + side * 420, by - 220, bx + side * 400, by - 10);
      g.bezierCurveTo(bx + side * 380, by + 90, bx + side * 200, by + 120, bx, by + 30);
      g.closePath();
      g.fillStyle = grad(bx, bx + side * 400);
      g.fill();
      g.strokeStyle = '#311b92';
      g.lineWidth = 8;
      g.stroke();
      // lower wing on the cheek
      g.beginPath();
      g.moveTo(bx, by + 40);
      g.bezierCurveTo(bx + side * 220, by + 120, bx + side * 330, by + 300, bx + side * 180, by + 330);
      g.bezierCurveTo(bx + side * 80, by + 330, bx + side * 30, by + 200, bx, by + 60);
      g.closePath();
      g.fillStyle = grad(bx + side * 300, bx);
      g.fill();
      g.stroke();
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [dx, dy, r] of [
        [300, -120, 22],
        [340, -40, 14],
        [180, 230, 18],
        [230, 280, 10],
      ]) {
        circle(g, bx + side * dx, by + dy, r);
        g.fill();
      }
    }
    // glitter
    const r = rng(7);
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2;
      const d = 60 + r() * 330;
      g.fillStyle = `hsla(${Math.floor(r() * 360)},100%,85%,0.9)`;
      circle(g, bx + Math.cos(a) * d, by + Math.sin(a) * d * 0.6, 2 + r() * 4);
      g.fill();
    }
    // body along the nose
    g.fillStyle = '#311b92';
    ellipse(g, bx, by + 60, 14, 90);
    g.fill();
    holes(g, 1.25);
  });

const glitter = () =>
  mk(S, S, (g) => {
    const r = rng(3);
    for (const side of [-1, 1]) {
      const [bx, by] = P(side < 0 ? 50 : 280);
      g.fillStyle = rad(g, bx, by, 0, 80, [
        [0, 'rgba(255,105,150,0.55)'],
        [1, 'rgba(255,105,150,0)'],
      ]);
      ellipse(g, bx, by, 90, 70);
      g.fill();
      // little stars near the outer eye corner
      const [ex, ey] = P(side < 0 ? 33 : 263);
      g.fillStyle = '#ffd54f';
      starPath(g, ex + side * 40, ey + 40, 22);
      g.fill();
      g.fillStyle = '#ff80ab';
      heartPath(g, ex + side * 70, ey + 95, 14);
      g.fill();
      g.fillStyle = '#80d8ff';
      starPath(g, ex + side * 20, ey + 120, 12);
      g.fill();
    }
    // freckles over nose and cheeks
    g.fillStyle = 'rgba(120,70,40,0.55)';
    const [nx, ny] = P(197);
    for (let i = 0; i < 40; i++) {
      const x = nx + (r() - 0.5) * 360;
      const y = ny + (r() - 0.3) * 120;
      circle(g, x, y, 3 + r() * 4);
      g.fill();
    }
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `hsla(${Math.floor(r() * 360)},100%,88%,${0.6 + r() * 0.4})`;
      circle(g, nx + (r() - 0.5) * 520, ny + (r() - 0.4) * 220, 1.5 + r() * 3);
      g.fill();
    }
    holes(g);
  });

const clown = () =>
  mk(S, S, (g) => {
    faceBase(g, '#ffffff', 60);
    // big red smile around the lips
    g.fillStyle = '#e53935';
    poly(g, LIPS_OUT, 1.45, 0, -5);
    g.fill();
    // blue diamonds over the eyes
    g.fillStyle = '#1e88e5';
    for (const ids of [EYE_A, EYE_B]) {
      const [x, y] = centre(ids);
      g.beginPath();
      g.moveTo(x, y - 120);
      g.lineTo(x + 45, y);
      g.lineTo(x, y + 120);
      g.lineTo(x - 45, y);
      g.closePath();
      g.fill();
    }
    g.fillStyle = 'rgba(255,82,82,0.6)';
    for (const id of [50, 280]) {
      const [x, y] = P(id);
      circle(g, x, y, 55);
      g.fill();
    }
    holes(g, 1.25);
  });

const skull = () =>
  mk(S, S, (g) => {
    faceBase(g, '#f5f5f5', 60);
    g.fillStyle = '#1b1b1b';
    for (const ids of [EYE_A, EYE_B]) {
      const [x, y] = centre(ids);
      circle(g, x, y + 5, 88);
      g.fill();
    }
    // petals around the eye sockets
    const cols = ['#ff4081', '#7c4dff', '#00e5ff', '#ffd740'];
    [EYE_A, EYE_B].forEach((ids, k) => {
      const [x, y] = centre(ids);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.fillStyle = cols[(i + k) % cols.length];
        circle(g, x + Math.cos(a) * 108, y + 5 + Math.sin(a) * 108, 16);
        g.fill();
      }
    });
    // nose
    const [tx, ty] = P(1);
    g.fillStyle = '#1b1b1b';
    g.save();
    g.translate(tx, ty);
    g.rotate(Math.PI);
    heartPath(g, 0, 0, 34);
    g.fill();
    g.restore();
    // stitches across the lips
    g.strokeStyle = '#1b1b1b';
    g.lineWidth = 7;
    const [ax] = P(61);
    const [bx2] = P(291);
    const [, my] = P(13);
    g.beginPath();
    g.moveTo(ax - 20, my + 6);
    g.lineTo(bx2 + 20, my + 6);
    g.stroke();
    for (let i = 0; i <= 8; i++) {
      const x = ax + ((bx2 - ax) * i) / 8;
      g.beginPath();
      g.moveTo(x, my - 26);
      g.lineTo(x, my + 38);
      g.stroke();
    }
    // forehead flower
    const [fx, fy] = P(151);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillStyle = '#ff4081';
      circle(g, fx + Math.cos(a) * 36, fy + Math.sin(a) * 36, 26);
      g.fill();
    }
    g.fillStyle = '#ffd740';
    circle(g, fx, fy, 22);
    g.fill();
    holes(g, 1.2, false);
  });

const alien = () =>
  mk(S, S, (g) => {
    faceBase(g, lin(g, 0, 0, 0, S, [
      [0, '#9cff57'],
      [1, '#4caf50'],
    ]), 50);
    const r = rng(11);
    g.fillStyle = 'rgba(30,90,30,0.35)';
    for (let i = 0; i < 25; i++) {
      const [x, y] = P(Math.floor(r() * 468));
      circle(g, x, y, 6 + r() * 14);
      g.fill();
    }
    holes(g, 1.15);
  });

const robot = () =>
  mk(S, S, (g) => {
    faceBase(g, lin(g, 0, 0, S, S, [
      [0, '#eceff1'],
      [0.5, '#90a4ae'],
      [1, '#cfd8dc'],
    ]), 40);
    g.strokeStyle = 'rgba(38,50,56,0.7)';
    g.lineWidth = 5;
    const [fx, fy] = P(151);
    g.beginPath();
    g.moveTo(fx - 200, fy + 30);
    g.lineTo(fx + 200, fy + 30);
    g.moveTo(fx, fy - 70);
    g.lineTo(fx, fy + 30);
    for (const id of [205, 425]) {
      const [x, y] = P(id);
      g.moveTo(x - 60, y - 40);
      g.lineTo(x + 60, y - 40);
      g.lineTo(x + 60, y + 60);
      g.lineTo(x - 60, y + 60);
      g.closePath();
    }
    g.stroke();
    for (const id of [127, 356, 58, 288]) {
      const [x, y] = P(id);
      circle(g, x + (x < S / 2 ? 30 : -30), y, 14);
      g.fillStyle = '#607d8b';
      g.fill();
      g.stroke();
    }
    g.fillStyle = rad(g, fx, fy - 20, 0, 30, [
      [0, '#ffebee'],
      [0.4, '#ff1744'],
      [1, 'rgba(255,23,68,0)'],
    ]);
    circle(g, fx, fy - 20, 30);
    g.fill();
    holes(g, 1.2);
  });

const blush = () =>
  mk(S, S, (g) => {
    for (const id of [50, 280]) {
      const [x, y] = P(id);
      g.fillStyle = rad(g, x, y, 0, 90, [
        [0, 'rgba(255,90,130,0.6)'],
        [1, 'rgba(255,90,130,0)'],
      ]);
      ellipse(g, x, y, 95, 75);
      g.fill();
    }
  });

const zebra = () =>
  mk(S, S, (g) => {
    faceBase(g, '#ffffff', 60);
    g.fillStyle = '#111';
    const r = rng(5);
    for (let i = 0; i < 16; i++) {
      const y = 80 + i * 60;
      const side = i % 2 ? -1 : 1;
      stripe(g, side < 0 ? 0 : S, y, S / 2 + side * (60 + r() * 120), y + 20 + r() * 40, 18 + r() * 8);
    }
    holes(g, 1.3);
  });

export const PAINTS: Record<string, () => HTMLCanvasElement> = {
  tiger,
  panda,
  kitty,
  butterfly: butterflyPaint,
  glitter,
  clown,
  skull,
  alien,
  robot,
  blush,
  zebra,
};
