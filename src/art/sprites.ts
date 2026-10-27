// Procedurally drawn sticker art. Everything is generated on the device; there are no image downloads.
import {
  OUTLINE,
  circle,
  ellipse,
  gloss,
  heartPath,
  lin,
  mk,
  paint,
  rad,
  roundRect,
  starPath,
  type Ctx,
} from './util';

type Draw = () => HTMLCanvasElement;

// ---------- glasses (1024 x 384, lens centres at x = 270 / 754, y = 190) ----------

function glassesFrame(g: Ctx, lens: (x: number, y: number) => void, frame: string, lensFill: string | CanvasGradient, lw = 22) {
  // temples
  g.strokeStyle = frame;
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(70, 150);
  g.lineTo(18, 140);
  g.moveTo(954, 150);
  g.lineTo(1006, 140);
  g.stroke();
  // bridge
  g.beginPath();
  g.moveTo(420, 165);
  g.quadraticCurveTo(512, 120, 604, 165);
  g.stroke();
  for (const x of [270, 754]) {
    lens(x, 190);
    g.fillStyle = lensFill;
    g.fill();
    g.strokeStyle = frame;
    g.lineWidth = lw;
    g.stroke();
  }
}

const shades: Draw = () =>
  mk(1024, 384, (g) => {
    const glass = lin(g, 0, 80, 0, 300, [
      [0, '#3b3f58'],
      [0.55, '#111320'],
      [1, '#2a1f3d'],
    ]);
    glassesFrame(g, (x, y) => roundRect(g, x - 190, y - 120, 380, 225, [40, 40, 110, 110]), '#141414', glass, 24);
    for (const x of [270, 754]) {
      g.save();
      g.globalAlpha = 0.35;
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(x - 130, 90);
      g.lineTo(x - 60, 90);
      g.lineTo(x - 140, 240);
      g.lineTo(x - 175, 240);
      g.closePath();
      g.fill();
      g.restore();
    }
  });

const heartGlasses: Draw = () =>
  mk(1024, 384, (g) => {
    const glass = lin(g, 0, 60, 0, 330, [
      [0, '#ff9ccf'],
      [1, '#e0157a'],
    ]);
    glassesFrame(g, (x, y) => heartPath(g, x, y - 10, 175), '#ff3d9a', glass, 20);
    for (const x of [270, 754]) gloss(g, x - 70, 120, 45, 22, 0.6);
  });

const starGlasses: Draw = () =>
  mk(1024, 384, (g) => {
    const glass = lin(g, 0, 20, 0, 360, [
      [0, '#fff59a'],
      [1, '#ffb300'],
    ]);
    glassesFrame(g, (x, y) => starPath(g, x, y, 200, 5, 0.52), '#ff8f00', glass, 18);
    for (const x of [270, 754]) gloss(g, x - 40, 140, 40, 20, 0.6);
  });

const nerdGlasses: Draw = () =>
  mk(1024, 384, (g) => {
    const glass = 'rgba(200,230,255,0.18)';
    glassesFrame(g, (x, y) => roundRect(g, x - 175, y - 120, 350, 230, 30), '#1b1b1b', glass, 36);
    for (const x of [270, 754]) gloss(g, x - 90, 120, 50, 14, 0.45, -0.3);
  });

const roundGlasses: Draw = () =>
  mk(1024, 384, (g) => {
    const glass = lin(g, 0, 60, 0, 330, [
      [0, 'rgba(120,200,255,0.55)'],
      [1, 'rgba(160,90,255,0.55)'],
    ]);
    glassesFrame(g, (x, y) => circle(g, x, y, 160), '#d4a017', glass, 16);
    for (const x of [270, 754]) gloss(g, x - 60, 130, 50, 20, 0.5);
  });

// ---------- hats and headwear ----------

const partyHat: Draw = () =>
  mk(512, 720, (g) => {
    g.save();
    g.beginPath();
    g.moveTo(256, 90);
    g.lineTo(470, 640);
    g.quadraticCurveTo(256, 700, 42, 640);
    g.closePath();
    g.clip();
    g.fillStyle = lin(g, 0, 0, 512, 0, [
      [0, '#4fc3f7'],
      [1, '#7c4dff'],
    ]);
    g.fillRect(0, 0, 512, 720);
    const cols = ['#ffeb3b', '#ff4081', '#69f0ae'];
    for (let i = 0; i < 9; i++) {
      g.fillStyle = cols[i % 3];
      g.beginPath();
      g.moveTo(-200, 150 + i * 75);
      g.lineTo(700, 30 + i * 75);
      g.lineTo(700, 60 + i * 75);
      g.lineTo(-200, 180 + i * 75);
      g.fill();
    }
    g.restore();
    g.beginPath();
    g.moveTo(256, 90);
    g.lineTo(470, 640);
    g.quadraticCurveTo(256, 700, 42, 640);
    g.closePath();
    g.strokeStyle = OUTLINE;
    g.lineWidth = 12;
    g.stroke();
    // fluffy pom-pom
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      circle(g, 256 + Math.cos(a) * 34, 78 + Math.sin(a) * 34, 34);
      paint(g, i % 2 ? '#fff176' : '#ffee58', null);
    }
    circle(g, 256, 78, 40);
    paint(g, '#fff59d', null);
    // brim trim
    g.lineWidth = 26;
    g.strokeStyle = '#fff';
    g.beginPath();
    g.moveTo(52, 636);
    g.quadraticCurveTo(256, 694, 460, 636);
    g.stroke();
  });

function crownArt(body: [string, string, string], gem: string[]): HTMLCanvasElement {
  return mk(768, 480, (g) => {
    const path = () => {
      g.beginPath();
      g.moveTo(70, 420);
      g.lineTo(40, 150);
      g.lineTo(200, 280);
      g.lineTo(270, 70);
      g.lineTo(384, 250);
      g.lineTo(498, 70);
      g.lineTo(568, 280);
      g.lineTo(728, 150);
      g.lineTo(698, 420);
      g.closePath();
    };
    path();
    paint(g, lin(g, 0, 60, 0, 430, [
      [0, body[0]],
      [0.5, body[1]],
      [1, body[2]],
    ]), OUTLINE, 12);
    roundRect(g, 60, 360, 648, 80, 30);
    paint(g, lin(g, 0, 360, 0, 440, [
      [0, body[1]],
      [1, body[2]],
    ]), OUTLINE, 12);
    const tips: [number, number][] = [
      [40, 150],
      [270, 70],
      [498, 70],
      [728, 150],
    ];
    for (const [x, y] of tips) {
      circle(g, x, y, 28);
      paint(g, '#fff8e1', OUTLINE, 8);
    }
    gem.forEach((c, i) => {
      const x = 170 + i * 142;
      ellipse(g, x, 400, 34, 26);
      paint(g, c, OUTLINE, 8);
      gloss(g, x - 10, 392, 12, 7, 0.7);
    });
    circle(g, 384, 300, 46);
    paint(g, gem[1] ?? '#e91e63', OUTLINE, 10);
    gloss(g, 370, 285, 16, 10, 0.7);
    gloss(g, 200, 200, 70, 18, 0.35, -0.9);
  });
}

const crownGold: Draw = () => crownArt(['#fff59d', '#ffca28', '#e09400'], ['#e53935', '#1e88e5', '#43a047', '#8e24aa']);
const crownIce: Draw = () => crownArt(['#ffffff', '#b3e5fc', '#4fc3f7'], ['#e1f5fe', '#80deea', '#b39ddb', '#e1f5fe']);
const crownPink: Draw = () => crownArt(['#fce4ec', '#f48fb1', '#d81b60'], ['#fff176', '#ffffff', '#ce93d8', '#fff176']);

const topHat: Draw = () =>
  mk(640, 620, (g) => {
    roundRect(g, 150, 40, 340, 470, [30, 30, 10, 10]);
    paint(g, lin(g, 150, 0, 490, 0, [
      [0, '#3a3a3a'],
      [0.4, '#1a1a1a'],
      [1, '#000'],
    ]), OUTLINE, 12);
    g.fillStyle = '#c62828';
    g.fillRect(156, 380, 328, 70);
    ellipse(g, 320, 525, 300, 70);
    paint(g, '#111', OUTLINE, 12);
    gloss(g, 215, 200, 20, 120, 0.18, 0);
  });

const witchHat: Draw = () =>
  mk(700, 700, (g) => {
    ellipse(g, 350, 590, 330, 80);
    paint(g, '#4a148c', OUTLINE, 12);
    g.beginPath();
    g.moveTo(170, 580);
    g.quadraticCurveTo(250, 300, 330, 160);
    g.quadraticCurveTo(420, 40, 560, 60);
    g.quadraticCurveTo(450, 130, 430, 300);
    g.lineTo(530, 580);
    g.closePath();
    paint(g, lin(g, 170, 0, 530, 0, [
      [0, '#7b1fa2'],
      [1, '#4a148c'],
    ]), OUTLINE, 12);
    g.beginPath();
    g.moveTo(178, 540);
    g.quadraticCurveTo(350, 480, 522, 540);
    g.lineTo(530, 590);
    g.quadraticCurveTo(350, 530, 170, 590);
    g.closePath();
    paint(g, '#ff9800', OUTLINE, 8);
    roundRect(g, 310, 515, 80, 60, 10);
    g.strokeStyle = '#ffeb3b';
    g.lineWidth = 12;
    g.stroke();
    for (const [x, y, r] of [
      [300, 330, 26],
      [380, 230, 18],
      [250, 450, 16],
    ] as const) {
      starPath(g, x, y, r);
      paint(g, '#ffeb3b', null);
    }
  });

const pirateHat: Draw = () =>
  mk(900, 480, (g) => {
    g.beginPath();
    g.moveTo(30, 360);
    g.quadraticCurveTo(160, 330, 220, 150);
    g.quadraticCurveTo(450, 0, 680, 150);
    g.quadraticCurveTo(740, 330, 870, 360);
    g.quadraticCurveTo(450, 470, 30, 360);
    g.closePath();
    paint(g, lin(g, 0, 50, 0, 440, [
      [0, '#3e2723'],
      [1, '#120c0a'],
    ]), OUTLINE, 12);
    g.strokeStyle = '#ffca28';
    g.lineWidth = 14;
    g.beginPath();
    g.moveTo(60, 365);
    g.quadraticCurveTo(450, 455, 840, 365);
    g.stroke();
    // skull & bones
    g.strokeStyle = '#fff';
    g.lineWidth = 22;
    g.beginPath();
    g.moveTo(380, 300);
    g.lineTo(520, 200);
    g.moveTo(380, 200);
    g.lineTo(520, 300);
    g.stroke();
    circle(g, 450, 205, 58);
    paint(g, '#fff', null);
    roundRect(g, 420, 230, 60, 50, 12);
    paint(g, '#fff', null);
    circle(g, 428, 205, 15);
    paint(g, '#120c0a', null);
    circle(g, 472, 205, 15);
    paint(g, '#120c0a', null);
  });

const eyePatch: Draw = () =>
  mk(1024, 300, (g) => {
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(0, 60);
    g.quadraticCurveTo(300, 70, 760, 150);
    g.quadraticCurveTo(900, 200, 1024, 230);
    g.stroke();
    ellipse(g, 270, 165, 150, 120);
    paint(g, lin(g, 0, 50, 0, 290, [
      [0, '#2e2e2e'],
      [1, '#000'],
    ]), OUTLINE, 8);
    gloss(g, 220, 110, 50, 16, 0.25);
  });

const halo: Draw = () =>
  mk(600, 600, (g) => {
    g.save();
    g.shadowColor = 'rgba(255,240,150,0.95)';
    g.shadowBlur = 50;
    g.strokeStyle = lin(g, 0, 0, 600, 600, [
      [0, '#fff9c4'],
      [0.5, '#ffd54f'],
      [1, '#ffb300'],
    ]);
    g.lineWidth = 60;
    circle(g, 300, 300, 210);
    g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 12;
    g.beginPath();
    g.arc(300, 300, 210, Math.PI * 1.1, Math.PI * 1.5);
    g.stroke();
  });

const devilHorn: Draw = () =>
  mk(300, 400, (g) => {
    g.beginPath();
    g.moveTo(60, 380);
    g.quadraticCurveTo(40, 160, 220, 30);
    g.quadraticCurveTo(170, 200, 250, 380);
    g.closePath();
    paint(g, lin(g, 0, 400, 300, 0, [
      [0, '#b71c1c'],
      [1, '#ff5252'],
    ]), OUTLINE, 12);
    gloss(g, 140, 200, 18, 70, 0.4, 0.4);
  });

const dragonHorn: Draw = () =>
  mk(300, 440, (g) => {
    g.beginPath();
    g.moveTo(50, 420);
    g.quadraticCurveTo(30, 200, 200, 20);
    g.quadraticCurveTo(160, 230, 260, 420);
    g.closePath();
    paint(g, lin(g, 0, 440, 0, 0, [
      [0, '#558b2f'],
      [1, '#fff59d'],
    ]), OUTLINE, 12);
    g.strokeStyle = 'rgba(40,60,20,0.5)';
    g.lineWidth = 8;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(60 + i * 12, 380 - i * 70);
      g.quadraticCurveTo(150, 360 - i * 70, 230 - i * 10, 390 - i * 75);
      g.stroke();
    }
  });

const unicornHorn: Draw = () =>
  mk(300, 600, (g) => {
    g.beginPath();
    g.moveTo(150, 20);
    g.lineTo(250, 560);
    g.quadraticCurveTo(150, 600, 50, 560);
    g.closePath();
    paint(g, lin(g, 0, 0, 0, 600, [
      [0, '#fff9c4'],
      [0.5, '#f8bbd0'],
      [1, '#b39ddb'],
    ]), OUTLINE, 12);
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 16;
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(20, 140 + i * 72);
      g.quadraticCurveTo(150, 100 + i * 72, 280, 70 + i * 72);
      g.stroke();
    }
    g.restore();
  });

const antenna = (ball: string, stalk: string): Draw => () =>
  mk(200, 500, (g) => {
    g.strokeStyle = stalk;
    g.lineWidth = 18;
    g.beginPath();
    g.moveTo(100, 495);
    g.quadraticCurveTo(70, 300, 100, 110);
    g.stroke();
    circle(g, 100, 85, 62);
    paint(g, rad(g, 80, 65, 5, 70, [
      [0, '#fff'],
      [0.3, ball],
      [1, ball],
    ]), OUTLINE, 10);
  });

// ---------- animal parts ----------

const dogEar = (fur: string, dark: string, inner: string): Draw => () =>
  mk(360, 520, (g) => {
    g.beginPath();
    g.moveTo(300, 40);
    g.bezierCurveTo(120, 0, 10, 200, 30, 420);
    g.bezierCurveTo(40, 520, 170, 520, 210, 440);
    g.bezierCurveTo(260, 330, 320, 200, 330, 110);
    g.closePath();
    paint(g, lin(g, 0, 0, 0, 520, [
      [0, fur],
      [1, dark],
    ]), OUTLINE, 12);
    g.beginPath();
    g.moveTo(270, 110);
    g.bezierCurveTo(150, 90, 80, 230, 95, 390);
    g.bezierCurveTo(110, 450, 160, 440, 180, 400);
    g.bezierCurveTo(220, 300, 270, 220, 270, 110);
    g.closePath();
    paint(g, inner, null);
  });

const dogNose: Draw = () =>
  mk(300, 220, (g) => {
    g.beginPath();
    g.moveTo(150, 200);
    g.bezierCurveTo(40, 180, 10, 90, 40, 50);
    g.bezierCurveTo(80, 0, 220, 0, 260, 50);
    g.bezierCurveTo(290, 90, 260, 180, 150, 200);
    paint(g, rad(g, 120, 70, 10, 180, [
      [0, '#4a4a4a'],
      [1, '#0d0d0d'],
    ]), OUTLINE, 8);
    gloss(g, 110, 60, 45, 20, 0.6, -0.2);
  });

const tongue: Draw = () =>
  mk(300, 400, (g) => {
    g.beginPath();
    g.moveTo(40, 20);
    g.lineTo(260, 20);
    g.bezierCurveTo(290, 200, 260, 380, 150, 385);
    g.bezierCurveTo(40, 380, 10, 200, 40, 20);
    paint(g, lin(g, 0, 0, 0, 400, [
      [0, '#e5537a'],
      [1, '#ff8fab'],
    ]), OUTLINE, 10);
    g.strokeStyle = '#c2185b';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(150, 60);
    g.lineTo(150, 250);
    g.stroke();
    gloss(g, 100, 280, 25, 45, 0.35, 0.2);
  });

const catEar = (fur: string, inner: string): Draw => () =>
  mk(360, 420, (g) => {
    g.beginPath();
    g.moveTo(30, 400);
    g.quadraticCurveTo(40, 120, 150, 20);
    g.quadraticCurveTo(290, 160, 330, 400);
    g.closePath();
    paint(g, fur, OUTLINE, 12);
    g.beginPath();
    g.moveTo(90, 380);
    g.quadraticCurveTo(100, 180, 160, 100);
    g.quadraticCurveTo(250, 210, 270, 380);
    g.closePath();
    paint(g, inner, null);
  });

const catNose: Draw = () =>
  mk(240, 200, (g) => {
    g.beginPath();
    g.moveTo(30, 40);
    g.quadraticCurveTo(120, 10, 210, 40);
    g.quadraticCurveTo(170, 130, 120, 160);
    g.quadraticCurveTo(70, 130, 30, 40);
    paint(g, lin(g, 0, 0, 0, 160, [
      [0, '#ffb3c8'],
      [1, '#f06292'],
    ]), OUTLINE, 8);
    gloss(g, 95, 50, 30, 12, 0.7, 0);
  });

const whiskers: Draw = () =>
  mk(1024, 300, (g) => {
    g.strokeStyle = '#2b1d2e';
    g.lineWidth = 9;
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        const x0 = 512 + side * 150;
        const y0 = 150 + i * 30;
        g.moveTo(x0, y0);
        g.quadraticCurveTo(512 + side * 330, y0 + i * 30 - 10, 512 + side * 490, y0 + i * 70);
        g.stroke();
      }
    }
  });

const bunnyEar: Draw = () =>
  mk(260, 700, (g) => {
    g.beginPath();
    g.moveTo(130, 20);
    g.bezierCurveTo(250, 30, 250, 500, 200, 690);
    g.lineTo(60, 690);
    g.bezierCurveTo(10, 500, 10, 30, 130, 20);
    paint(g, lin(g, 0, 0, 260, 0, [
      [0, '#fafafa'],
      [1, '#e0e0e0'],
    ]), OUTLINE, 12);
    g.beginPath();
    g.moveTo(130, 80);
    g.bezierCurveTo(200, 90, 195, 480, 165, 660);
    g.lineTo(95, 660);
    g.bezierCurveTo(65, 480, 60, 90, 130, 80);
    paint(g, lin(g, 0, 0, 0, 700, [
      [0, '#f8bbd0'],
      [1, '#f48fb1'],
    ]), null);
  });

const bunnyTeeth: Draw = () =>
  mk(240, 200, (g) => {
    for (const x of [22, 122]) {
      roundRect(g, x, 10, 96, 175, [6, 6, 30, 30]);
      paint(g, '#fffdf5', OUTLINE, 9);
    }
  });

const roundEar = (fur: string, inner: string): Draw => () =>
  mk(320, 320, (g) => {
    circle(g, 160, 160, 140);
    paint(g, fur, OUTLINE, 12);
    circle(g, 160, 170, 80);
    paint(g, inner, null);
  });

const smallNose = (top: string, bottom: string): Draw => () =>
  mk(220, 180, (g) => {
    ellipse(g, 110, 90, 90, 65);
    paint(g, lin(g, 0, 20, 0, 160, [
      [0, top],
      [1, bottom],
    ]), OUTLINE, 8);
    gloss(g, 80, 65, 30, 14, 0.65, -0.2);
  });

const mustache: Draw = () =>
  mk(700, 260, (g) => {
    g.beginPath();
    g.moveTo(350, 70);
    g.bezierCurveTo(420, 20, 520, 60, 560, 120);
    g.bezierCurveTo(600, 170, 660, 170, 680, 110);
    g.bezierCurveTo(700, 210, 600, 250, 520, 200);
    g.bezierCurveTo(470, 170, 420, 160, 350, 180);
    g.bezierCurveTo(280, 160, 230, 170, 180, 200);
    g.bezierCurveTo(100, 250, 0, 210, 20, 110);
    g.bezierCurveTo(40, 170, 100, 170, 140, 120);
    g.bezierCurveTo(180, 60, 280, 20, 350, 70);
    paint(g, lin(g, 0, 40, 0, 240, [
      [0, '#5d4037'],
      [1, '#2e1b14'],
    ]), OUTLINE, 8);
  });

const monocle: Draw = () =>
  mk(300, 600, (g) => {
    g.strokeStyle = '#d4a017';
    g.lineWidth = 8;
    g.setLineDash([16, 10]);
    g.beginPath();
    g.moveTo(240, 220);
    g.quadraticCurveTo(290, 420, 200, 590);
    g.stroke();
    g.setLineDash([]);
    circle(g, 150, 150, 120);
    paint(g, 'rgba(200,230,255,0.22)', '#d4a017', 20);
    gloss(g, 110, 105, 40, 14, 0.5);
  });

const clownNose: Draw = () =>
  mk(240, 240, (g) => {
    circle(g, 120, 120, 105);
    paint(g, rad(g, 85, 80, 10, 130, [
      [0, '#ff8a80'],
      [0.4, '#f44336'],
      [1, '#b71c1c'],
    ]), OUTLINE, 8);
    gloss(g, 80, 70, 32, 18, 0.75);
  });

const clownWig: Draw = () =>
  mk(500, 500, (g) => {
    const cols = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#2979ff', '#d500f9'];
    const puffs: [number, number, number][] = [
      [250, 260, 150],
      [150, 180, 110],
      [340, 160, 110],
      [130, 340, 100],
      [360, 350, 100],
      [250, 110, 100],
    ];
    puffs.forEach(([x, y, r], i) => {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        circle(g, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 0.55);
        paint(g, cols[(i + k) % cols.length], null);
      }
    });
  });

const pacifier: Draw = () =>
  mk(400, 300, (g) => {
    g.strokeStyle = '#4fc3f7';
    g.lineWidth = 26;
    circle(g, 200, 215, 60);
    g.stroke();
    ellipse(g, 200, 110, 175, 90);
    paint(g, lin(g, 0, 20, 0, 200, [
      [0, '#f8bbd0'],
      [1, '#f06292'],
    ]), OUTLINE, 10);
    circle(g, 200, 115, 42);
    paint(g, '#fff59d', OUTLINE, 8);
    gloss(g, 140, 70, 50, 18, 0.5, -0.2);
  });

const heroMask: Draw = () =>
  mk(1024, 360, (g) => {
    g.beginPath();
    g.moveTo(40, 120);
    g.quadraticCurveTo(250, 30, 512, 110);
    g.quadraticCurveTo(774, 30, 984, 120);
    g.quadraticCurveTo(1010, 300, 780, 320);
    g.quadraticCurveTo(600, 330, 512, 250);
    g.quadraticCurveTo(424, 330, 244, 320);
    g.quadraticCurveTo(14, 300, 40, 120);
    g.closePath();
    paint(g, lin(g, 0, 40, 0, 330, [
      [0, '#ffffff'],
      [1, '#bdbdbd'],
    ]), OUTLINE, 12);
    g.globalCompositeOperation = 'destination-out';
    for (const x of [270, 754]) {
      ellipse(g, x, 190, 125, 80);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    for (const x of [270, 754]) {
      ellipse(g, x, 190, 125, 80);
      g.strokeStyle = OUTLINE;
      g.lineWidth = 10;
      g.stroke();
    }
  });

// ---------- small things for particles / decorations ----------

const heart: Draw = () =>
  mk(256, 256, (g) => {
    heartPath(g, 128, 130, 100);
    paint(g, rad(g, 95, 80, 10, 170, [
      [0, '#ff8a9a'],
      [0.5, '#ff1744'],
      [1, '#c2002a'],
    ]), OUTLINE, 8);
    gloss(g, 85, 85, 26, 14, 0.7);
  });

const star: Draw = () =>
  mk(256, 256, (g) => {
    starPath(g, 128, 136, 115, 5, 0.48);
    paint(g, rad(g, 110, 100, 10, 150, [
      [0, '#fffde7'],
      [0.5, '#ffeb3b'],
      [1, '#ffa000'],
    ]), OUTLINE, 8);
  });

const sparkle: Draw = () =>
  mk(256, 256, (g) => {
    g.fillStyle = rad(g, 128, 128, 0, 128, [
      [0, 'rgba(255,255,255,1)'],
      [0.15, 'rgba(255,255,255,0.8)'],
      [0.4, 'rgba(255,255,255,0.15)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#fff';
    starPath(g, 128, 128, 125, 4, 0.13, 0);
    g.fill();
  });

const glow: Draw = () =>
  mk(128, 128, (g) => {
    g.fillStyle = rad(g, 64, 64, 0, 64, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    g.fillRect(0, 0, 128, 128);
  });

const blob: Draw = () =>
  mk(128, 128, (g) => {
    circle(g, 64, 64, 60);
    g.fillStyle = '#fff';
    g.fill();
  });

const bubble: Draw = () =>
  mk(256, 256, (g) => {
    circle(g, 128, 128, 115);
    g.fillStyle = rad(g, 128, 128, 60, 118, [
      [0, 'rgba(200,240,255,0.06)'],
      [0.85, 'rgba(180,220,255,0.25)'],
      [1, 'rgba(255,255,255,0.75)'],
    ]);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 5;
    g.stroke();
    gloss(g, 85, 80, 30, 16, 0.8);
    g.strokeStyle = 'rgba(255,170,240,0.5)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(128, 128, 100, 0.2, 1.3);
    g.stroke();
  });

const snowflake: Draw = () =>
  mk(256, 256, (g) => {
    g.translate(128, 128);
    g.strokeStyle = '#fff';
    g.lineWidth = 12;
    g.shadowColor = 'rgba(120,200,255,0.9)';
    g.shadowBlur = 12;
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -105);
      g.moveTo(0, -60);
      g.lineTo(-28, -88);
      g.moveTo(0, -60);
      g.lineTo(28, -88);
      g.stroke();
    }
  });

const confetti: Draw = () =>
  mk(64, 96, (g) => {
    roundRect(g, 4, 4, 56, 88, 10);
    g.fillStyle = '#fff';
    g.fill();
  });

const tear: Draw = () =>
  mk(160, 240, (g) => {
    g.beginPath();
    g.moveTo(80, 10);
    g.bezierCurveTo(110, 80, 150, 120, 150, 160);
    g.arc(80, 160, 70, 0, Math.PI);
    g.bezierCurveTo(10, 120, 50, 80, 80, 10);
    paint(g, lin(g, 0, 0, 0, 240, [
      [0, 'rgba(180,230,255,0.9)'],
      [1, 'rgba(41,121,255,0.9)'],
    ]), 'rgba(13,71,161,0.8)', 6);
    gloss(g, 60, 150, 16, 26, 0.7, 0.2);
  });

const flame: Draw = () =>
  mk(256, 256, (g) => {
    g.fillStyle = rad(g, 128, 128, 0, 128, [
      [0, 'rgba(255,255,220,1)'],
      [0.25, 'rgba(255,220,80,0.95)'],
      [0.55, 'rgba(255,110,20,0.6)'],
      [1, 'rgba(200,30,0,0)'],
    ]);
    g.fillRect(0, 0, 256, 256);
  });

const flower = (petal: string, centre: string, n = 6): Draw => () =>
  mk(256, 256, (g) => {
    g.translate(128, 128);
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate((i / n) * Math.PI * 2);
      ellipse(g, 0, -62, 42, 62);
      paint(g, lin(g, 0, -120, 0, 0, [
        [0, petal],
        [1, '#ffffff'],
      ]), OUTLINE, 6);
      g.restore();
    }
    circle(g, 0, 0, 36);
    paint(g, rad(g, -8, -8, 2, 40, [
      [0, '#fff9c4'],
      [1, centre],
    ]), OUTLINE, 6);
  });

const leaf: Draw = () =>
  mk(200, 120, (g) => {
    g.beginPath();
    g.moveTo(10, 60);
    g.quadraticCurveTo(100, -10, 190, 60);
    g.quadraticCurveTo(100, 130, 10, 60);
    paint(g, lin(g, 0, 0, 200, 0, [
      [0, '#81c784'],
      [1, '#2e7d32'],
    ]), OUTLINE, 6);
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(20, 60);
    g.lineTo(170, 60);
    g.stroke();
  });

const butterfly: Draw = () =>
  mk(300, 240, (g) => {
    // drawn in light colours so a tint can recolour it
    for (const s of [-1, 1]) {
      g.save();
      g.translate(150, 120);
      g.scale(s, 1);
      g.beginPath();
      g.moveTo(0, -10);
      g.bezierCurveTo(60, -120, 150, -100, 135, -20);
      g.bezierCurveTo(130, 20, 60, 20, 0, 5);
      g.closePath();
      paint(g, lin(g, 0, -100, 140, 0, [
        [0, '#ffffff'],
        [1, '#d9d9d9'],
      ]), OUTLINE, 6);
      g.beginPath();
      g.moveTo(0, 5);
      g.bezierCurveTo(70, 10, 120, 60, 85, 100);
      g.bezierCurveTo(50, 120, 15, 70, 0, 20);
      g.closePath();
      paint(g, '#eeeeee', OUTLINE, 6);
      circle(g, 85, -50, 18);
      paint(g, 'rgba(255,255,255,0.9)', null);
      g.restore();
    }
    ellipse(g, 150, 125, 12, 60);
    paint(g, '#3e2723', null);
  });

const bee: Draw = () =>
  mk(300, 260, (g) => {
    for (const [x, rot] of [
      [120, -0.5],
      [180, 0.5],
    ] as const) {
      ellipse(g, x, 70, 50, 70, rot);
      paint(g, 'rgba(220,240,255,0.85)', OUTLINE, 6);
    }
    ellipse(g, 150, 160, 120, 82);
    g.save();
    g.clip();
    g.fillStyle = '#ffd600';
    g.fillRect(0, 0, 300, 260);
    g.fillStyle = '#212121';
    for (const x of [110, 175]) g.fillRect(x, 60, 34, 200);
    g.restore();
    ellipse(g, 150, 160, 120, 82);
    g.strokeStyle = OUTLINE;
    g.lineWidth = 8;
    g.stroke();
    circle(g, 238, 145, 14);
    paint(g, '#212121', null);
    circle(g, 243, 140, 5);
    paint(g, '#fff', null);
    g.beginPath();
    g.moveTo(30, 160);
    g.lineTo(5, 170);
    g.lineTo(30, 180);
    paint(g, '#212121', null);
  });

const bat: Draw = () =>
  mk(360, 200, (g) => {
    g.beginPath();
    g.moveTo(180, 60);
    g.quadraticCurveTo(250, 0, 350, 40);
    g.quadraticCurveTo(320, 80, 330, 130);
    g.quadraticCurveTo(290, 100, 260, 130);
    g.quadraticCurveTo(230, 110, 200, 150);
    g.lineTo(180, 165);
    g.lineTo(160, 150);
    g.quadraticCurveTo(130, 110, 100, 130);
    g.quadraticCurveTo(70, 100, 30, 130);
    g.quadraticCurveTo(40, 80, 10, 40);
    g.quadraticCurveTo(110, 0, 180, 60);
    paint(g, '#4a148c', OUTLINE, 6);
    circle(g, 165, 85, 9);
    paint(g, '#ffeb3b', null);
    circle(g, 195, 85, 9);
    paint(g, '#ffeb3b', null);
  });

const ghost: Draw = () =>
  mk(240, 280, (g) => {
    g.beginPath();
    g.moveTo(20, 260);
    g.lineTo(20, 120);
    g.arc(120, 120, 100, Math.PI, 0);
    g.lineTo(220, 260);
    for (let i = 0; i < 4; i++) {
      g.quadraticCurveTo(207 - i * 50, 230, 195 - i * 50, 260);
    }
    g.closePath();
    paint(g, 'rgba(255,255,255,0.92)', OUTLINE, 8);
    ellipse(g, 85, 120, 16, 24);
    paint(g, '#212121', null);
    ellipse(g, 155, 120, 16, 24);
    paint(g, '#212121', null);
    ellipse(g, 120, 175, 18, 14);
    paint(g, '#212121', null);
  });

const rainbowArc: Draw = () =>
  mk(600, 320, (g) => {
    const cols = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#2979ff', '#d500f9'];
    cols.forEach((c, i) => {
      g.strokeStyle = c;
      g.lineWidth = 36;
      g.beginPath();
      g.arc(300, 310, 270 - i * 34, Math.PI, 0);
      g.stroke();
    });
    for (const x of [70, 530]) {
      for (let k = 0; k < 4; k++) {
        circle(g, x - 40 + k * 28, 290 - (k % 2) * 20, 38);
        paint(g, '#fff', null);
      }
    }
  });

export const SPRITES: Record<string, Draw> = {
  shades,
  heartGlasses,
  starGlasses,
  nerdGlasses,
  roundGlasses,
  partyHat,
  crownGold,
  crownIce,
  crownPink,
  topHat,
  witchHat,
  pirateHat,
  eyePatch,
  halo,
  devilHorn,
  dragonHorn,
  unicornHorn,
  antennaBee: antenna('#212121', '#212121'),
  antennaAlien: antenna('#76ff03', '#64dd17'),
  dogEarBrown: dogEar('#a1887f', '#5d4037', '#f8bbd0'),
  dogEarPink: dogEar('#f8bbd0', '#ec407a', '#fff0f5'),
  dogNose,
  tongue,
  catEar: catEar('#ffcc80', '#f8bbd0'),
  catEarGrey: catEar('#b0bec5', '#f8bbd0'),
  catNose,
  whiskers,
  bunnyEar,
  bunnyTeeth,
  bearEar: roundEar('#8d6e63', '#d7ccc8'),
  pandaEar: roundEar('#212121', '#424242'),
  mouseEar: roundEar('#9e9e9e', '#f8bbd0'),
  bearNose: smallNose('#6d4c41', '#3e2723'),
  bunnyNose: smallNose('#f8bbd0', '#ec407a'),
  mustache,
  monocle,
  clownNose,
  clownWig,
  pacifier,
  heroMask,
  heart,
  star,
  sparkle,
  glow,
  blob,
  bubble,
  snowflake,
  confetti,
  tear,
  flame,
  flowerPink: flower('#f48fb1', '#ffb300'),
  flowerYellow: flower('#ffd54f', '#795548', 10),
  flowerPurple: flower('#b39ddb', '#ffeb3b', 5),
  flowerBlue: flower('#81d4fa', '#ffffff', 5),
  flowerWhite: flower('#fafafa', '#ffca28', 8),
  leaf,
  butterfly,
  bee,
  bat,
  ghost,
  rainbowArc,
};
