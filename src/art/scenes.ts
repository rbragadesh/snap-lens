// Background scenes for the "Teleport" lens, drawn on the device.
import { rng } from '../engine/math';
import { OUTLINE, circle, ellipse, heartPath, lin, mk, paint, rad, starPath, type Ctx } from './util';

const N = 1200;

function stars(g: Ctx, count: number, seed: number, maxY = N) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const s = r() * 2.6 + 0.6;
    g.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
    circle(g, r() * N, r() * maxY, s);
    g.fill();
  }
}

function cloud(g: Ctx, x: number, y: number, s: number) {
  g.fillStyle = '#fff';
  for (const [dx, dy, r] of [
    [-1, 0.2, 0.7],
    [-0.35, -0.25, 0.9],
    [0.4, -0.15, 0.8],
    [1, 0.2, 0.6],
    [0, 0.35, 0.7],
  ]) {
    circle(g, x + dx * s, y + dy * s, r * s);
    g.fill();
  }
}

const space = () =>
  mk(N, N, (g) => {
    g.fillStyle = lin(g, 0, 0, 0, N, [
      [0, '#0b0326'],
      [0.6, '#24125e'],
      [1, '#3b1a6e'],
    ]);
    g.fillRect(0, 0, N, N);
    for (const [x, y, r, c] of [
      [300, 400, 380, 'rgba(255,64,160,0.18)'],
      [900, 800, 420, 'rgba(64,180,255,0.16)'],
    ] as const) {
      g.fillStyle = rad(g, x, y, 0, r, [
        [0, c],
        [1, 'rgba(0,0,0,0)'],
      ]);
      g.fillRect(0, 0, N, N);
    }
    stars(g, 380, 1);
    // ringed planet
    g.save();
    g.translate(930, 260);
    g.rotate(-0.35);
    ellipse(g, 0, 0, 230, 55);
    g.strokeStyle = '#ffd180';
    g.lineWidth = 22;
    g.stroke();
    circle(g, 0, 0, 130);
    paint(g, lin(g, -130, -130, 130, 130, [
      [0, '#ffab40'],
      [1, '#d84315'],
    ]), null);
    g.beginPath();
    g.ellipse(0, 0, 230, 55, 0, 0.05, Math.PI - 0.05);
    g.stroke();
    g.restore();
    // moon
    circle(g, 180, 1020, 150);
    paint(g, rad(g, 140, 980, 10, 160, [
      [0, '#fafafa'],
      [1, '#b0bec5'],
    ]), null);
    for (const [x, y, r] of [
      [140, 990, 28],
      [230, 1060, 20],
      [170, 1100, 14],
    ]) {
      circle(g, x, y, r);
      g.fillStyle = 'rgba(120,130,150,0.45)';
      g.fill();
    }
    // rocket
    g.save();
    g.translate(620, 180);
    g.rotate(0.7);
    ellipse(g, 0, 0, 40, 100);
    paint(g, '#eceff1', OUTLINE, 6);
    circle(g, 0, -20, 18);
    paint(g, '#4fc3f7', OUTLINE, 5);
    g.beginPath();
    g.moveTo(-40, 50);
    g.lineTo(-70, 100);
    g.lineTo(-30, 85);
    paint(g, '#ff5252', OUTLINE, 5);
    g.beginPath();
    g.moveTo(40, 50);
    g.lineTo(70, 100);
    g.lineTo(30, 85);
    paint(g, '#ff5252', OUTLINE, 5);
    ellipse(g, 0, 125, 20, 40);
    paint(g, '#ffab00', null);
    g.restore();
  });

const ocean = () =>
  mk(N, N, (g) => {
    g.fillStyle = lin(g, 0, 0, 0, N, [
      [0, '#4dd0e1'],
      [0.5, '#0288d1'],
      [1, '#01386b'],
    ]);
    g.fillRect(0, 0, N, N);
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(100 + i * 200, 0);
      g.lineTo(180 + i * 200, 0);
      g.lineTo(320 + i * 160, N);
      g.lineTo(220 + i * 160, N);
      g.fill();
    }
    g.restore();
    // sand
    g.fillStyle = lin(g, 0, 1000, 0, N, [
      [0, '#ffe082'],
      [1, '#ffb74d'],
    ]);
    g.beginPath();
    g.moveTo(0, 1040);
    g.quadraticCurveTo(600, 960, N, 1050);
    g.lineTo(N, N);
    g.lineTo(0, N);
    g.fill();
    // seaweed
    for (const [x, c] of [
      [90, '#2e7d32'],
      [160, '#43a047'],
      [1050, '#2e7d32'],
      [1120, '#66bb6a'],
    ] as const) {
      g.strokeStyle = c;
      g.lineWidth = 26;
      g.beginPath();
      g.moveTo(x, N);
      for (let y = N; y > 650; y -= 60) g.quadraticCurveTo(x + (y % 120 ? 45 : -45), y - 30, x, y - 60);
      g.stroke();
    }
    // fish
    const fish = (x: number, y: number, s: number, c: string, dir: number) => {
      g.save();
      g.translate(x, y);
      g.scale(dir * s, s);
      g.beginPath();
      g.moveTo(-60, 0);
      g.lineTo(-95, -30);
      g.lineTo(-95, 30);
      g.closePath();
      paint(g, c, OUTLINE, 5);
      ellipse(g, 0, 0, 70, 42);
      paint(g, c, OUTLINE, 5);
      circle(g, 35, -8, 9);
      paint(g, '#fff', OUTLINE, 3);
      circle(g, 37, -8, 4);
      paint(g, '#000', null);
      g.restore();
    };
    fish(250, 300, 1, '#ff7043', 1);
    fish(950, 520, 0.8, '#ffd54f', -1);
    fish(820, 220, 0.6, '#f06292', -1);
    fish(330, 760, 0.7, '#ba68c8', 1);
    // bubbles
    const r = rng(9);
    for (let i = 0; i < 30; i++) {
      circle(g, r() * N, r() * 900, 6 + r() * 16);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 3;
      g.stroke();
    }
    // starfish
    starPath(g, 900, 1120, 50, 5, 0.45);
    paint(g, '#ff7043', OUTLINE, 5);
  });

const rainbowLand = () =>
  mk(N, N, (g) => {
    g.fillStyle = lin(g, 0, 0, 0, N, [
      [0, '#81d4fa'],
      [1, '#e1f5fe'],
    ]);
    g.fillRect(0, 0, N, N);
    const cols = ['#ff1744', '#ff9100', '#ffea00', '#00e676', '#2979ff', '#d500f9'];
    cols.forEach((c, i) => {
      g.strokeStyle = c;
      g.lineWidth = 55;
      g.beginPath();
      g.arc(600, 980, 620 - i * 55, Math.PI, 0);
      g.stroke();
    });
    circle(g, 1050, 160, 90);
    paint(g, rad(g, 1050, 160, 10, 120, [
      [0, '#fffde7'],
      [1, '#ffd600'],
    ]), null);
    cloud(g, 160, 260, 80);
    cloud(g, 760, 140, 60);
    cloud(g, 100, 940, 100);
    cloud(g, 1100, 940, 100);
    g.fillStyle = '#66bb6a';
    g.beginPath();
    g.moveTo(0, 1000);
    g.quadraticCurveTo(300, 880, 600, 1000);
    g.quadraticCurveTo(900, 1100, N, 980);
    g.lineTo(N, N);
    g.lineTo(0, N);
    g.fill();
    const r = rng(4);
    for (let i = 0; i < 40; i++) {
      const x = r() * N;
      const y = 1040 + r() * 150;
      g.fillStyle = cols[i % cols.length];
      circle(g, x, y, 9);
      g.fill();
    }
  });

const candy = () =>
  mk(N, N, (g) => {
    g.fillStyle = lin(g, 0, 0, N, N, [
      [0, '#ff9ecf'],
      [1, '#b388ff'],
    ]);
    g.fillRect(0, 0, N, N);
    const r = rng(2);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.25})`;
      heartPath(g, r() * N, r() * N, 20 + r() * 40);
      g.fill();
    }
    const lolly = (x: number, y: number, s: number, c1: string, c2: string) => {
      g.strokeStyle = '#fff';
      g.lineWidth = 18 * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 330 * s);
      g.stroke();
      circle(g, x, y, 110 * s);
      paint(g, c1, OUTLINE, 6);
      g.strokeStyle = c2;
      g.lineWidth = 22 * s;
      g.beginPath();
      for (let a = 0; a < 18; a += 0.2) {
        const rr = (a / 18) * 100 * s;
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.stroke();
    };
    lolly(170, 820, 1, '#ff4081', '#fff');
    lolly(1040, 760, 1.1, '#7c4dff', '#ffeb3b');
    lolly(1000, 200, 0.6, '#00e5ff', '#fff');
    lolly(200, 220, 0.7, '#ffd740', '#ff4081');
    // sprinkles
    const cols = ['#ff1744', '#00e676', '#ffea00', '#2979ff', '#fff'];
    for (let i = 0; i < 150; i++) {
      g.save();
      g.translate(r() * N, r() * N);
      g.rotate(r() * Math.PI);
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.roundRect(-12, -4, 24, 8, 4);
      g.fill();
      g.restore();
    }
  });

const snowy = () =>
  mk(N, N, (g) => {
    g.fillStyle = lin(g, 0, 0, 0, N, [
      [0, '#1a237e'],
      [0.7, '#5c6bc0'],
      [1, '#c5cae9'],
    ]);
    g.fillRect(0, 0, N, N);
    stars(g, 120, 6, 600);
    circle(g, 950, 220, 90);
    paint(g, rad(g, 950, 220, 20, 120, [
      [0, '#ffffff'],
      [1, '#e3f2fd'],
    ]), null);
    const tree = (x: number, y: number, s: number) => {
      g.fillStyle = '#5d4037';
      g.fillRect(x - 14 * s, y, 28 * s, 60 * s);
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(x, y - 260 * s + i * 80 * s);
        g.lineTo(x + (110 - i * -20) * s, y - 60 * s + i * 50 * s);
        g.lineTo(x - (110 - i * -20) * s, y - 60 * s + i * 50 * s);
        g.closePath();
        g.fillStyle = '#1b5e20';
        g.fill();
        g.fillStyle = '#fff';
        g.beginPath();
        g.moveTo(x, y - 260 * s + i * 80 * s);
        g.lineTo(x + 40 * s, y - 200 * s + i * 80 * s);
        g.lineTo(x - 40 * s, y - 200 * s + i * 80 * s);
        g.fill();
      }
    };
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, 900);
    g.quadraticCurveTo(400, 780, 800, 900);
    g.quadraticCurveTo(1000, 960, N, 880);
    g.lineTo(N, N);
    g.lineTo(0, N);
    g.fill();
    tree(150, 900, 1.2);
    tree(330, 860, 0.8);
    tree(1050, 900, 1.1);
    // snowman
    circle(g, 760, 1010, 110);
    paint(g, '#fff', '#90a4ae', 4);
    circle(g, 760, 860, 75);
    paint(g, '#fff', '#90a4ae', 4);
    circle(g, 735, 845, 9);
    paint(g, '#212121', null);
    circle(g, 785, 845, 9);
    paint(g, '#212121', null);
    g.beginPath();
    g.moveTo(760, 865);
    g.lineTo(820, 880);
    g.lineTo(760, 885);
    paint(g, '#ff7043', null);
    const r = rng(8);
    for (let i = 0; i < 140; i++) {
      circle(g, r() * N, r() * N, 2 + r() * 5);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fill();
    }
  });

const beach = () =>
  mk(N, N, (g) => {
    g.fillStyle = lin(g, 0, 0, 0, 700, [
      [0, '#ff8a65'],
      [0.5, '#ffb74d'],
      [1, '#fff59d'],
    ]);
    g.fillRect(0, 0, N, 700);
    circle(g, 600, 640, 170);
    paint(g, rad(g, 600, 640, 20, 180, [
      [0, '#fffde7'],
      [1, '#ffca28'],
    ]), null);
    g.fillStyle = lin(g, 0, 640, 0, 900, [
      [0, '#26c6da'],
      [1, '#00838f'],
    ]);
    g.fillRect(0, 640, N, 280);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(80 + i * 190, 700 + (i % 3) * 60);
      g.lineTo(180 + i * 190, 700 + (i % 3) * 60);
      g.stroke();
    }
    g.fillStyle = lin(g, 0, 880, 0, N, [
      [0, '#ffe0b2'],
      [1, '#ffcc80'],
    ]);
    g.beginPath();
    g.moveTo(0, 900);
    g.quadraticCurveTo(600, 840, N, 910);
    g.lineTo(N, N);
    g.lineTo(0, N);
    g.fill();
    // palm tree
    g.strokeStyle = '#795548';
    g.lineWidth = 46;
    g.beginPath();
    g.moveTo(1000, N);
    g.quadraticCurveTo(1060, 700, 960, 330);
    g.stroke();
    g.fillStyle = '#2e7d32';
    for (let i = 0; i < 6; i++) {
      g.save();
      g.translate(960, 330);
      g.rotate(-Math.PI / 2 + (i - 2.5) * 0.55);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(160, -70, 330, 40);
      g.quadraticCurveTo(160, -10, 0, 0);
      g.fill();
      g.restore();
    }
    for (const [x, y] of [
      [940, 350],
      [985, 360],
    ]) {
      circle(g, x, y, 26);
      paint(g, '#6d4c41', null);
    }
    // beach ball
    circle(g, 230, 1080, 80);
    paint(g, '#fff', OUTLINE, 5);
    for (const [a, c] of [
      [0, '#f44336'],
      [2.1, '#2196f3'],
      [4.2, '#ffeb3b'],
    ] as const) {
      g.beginPath();
      g.moveTo(230, 1080);
      g.arc(230, 1080, 80, a, a + 1.05);
      g.closePath();
      g.fillStyle = c;
      g.fill();
    }
  });

export const SCENES: Record<string, () => HTMLCanvasElement> = {
  space,
  ocean,
  rainbow: rainbowLand,
  candy,
  snowy,
  beach,
};
