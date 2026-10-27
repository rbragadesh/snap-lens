// End-to-end smoke test in headless Chromium with a fake camera.
// 1. npm run build && npx vite preview --port 4173
// 2. node scripts/e2e.mjs <face.y4m> <outDir> [twoFaces.jpg]
//    (make a y4m from any face photo: ffmpeg -loop 1 -i face.jpg -t 3 -pix_fmt yuv420p -vf scale=720:960 face.y4m)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node-tools/node_modules/playwright');
}

const [video, out = 'test-results', twoFaces] = process.argv.slice(2);
if (!video) throw new Error('usage: node scripts/e2e.mjs face.y4m outDir [twoFaces.jpg]');
mkdirSync(out, { recursive: true });
const URL_ = process.env.APP_URL ?? 'http://localhost:4173/';

const browser = await playwright.chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${video}`,
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1 });
await context.grantPermissions(['camera', 'microphone']);
const page = await context.newPage();
const problems = [];
const external = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' || /Refused|violat/i.test(t)) problems.push(`[${m.type()}] ${t}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message}`));
page.on('request', (r) => {
  const u = new URL(r.url());
  if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) external.push(r.url());
});

const step = (s) => console.log(`• ${s}`);
await page.goto(URL_);
step('waiting for model');
await page.waitForFunction(() => !document.querySelector('#btn-start').disabled, null, { timeout: 60000 });
await page.click('#btn-start');
await page.waitForFunction(() => document.querySelector('#splash').hidden, null, { timeout: 20000 });
step('camera started');
await page.waitForFunction(() => window.__snaplens.studio.status !== undefined && window.__snaplens.studio.renderer.W > 2, null, { timeout: 20000 });

// Detection only runs when a lens needs faces; pick puppy first.
const lensIds = await page.evaluate(() => [...document.querySelectorAll('#carousel .lens')].map((b) => b.dataset.id));
const select = async (id, variant = 0) => {
  await page.evaluate(
    ([id, variant]) => {
      const ui = window.__snaplens.ui;
      const idx = [...document.querySelectorAll('#carousel .lens')].findIndex((b) => b.dataset.id === id);
      ui.selectLens(idx, false);
      if (variant) document.querySelectorAll('#variants .chip')[variant]?.click();
    },
    [id, variant],
  );
};
await select('puppy');
await page.waitForFunction(() => window.__snaplens.studio.status.faces > 0, null, { timeout: 30000 });
const info = await page.evaluate(() => ({
  delegate: window.__snaplens.studio.tracker.delegate,
  out: [window.__snaplens.studio.renderer.W, window.__snaplens.studio.renderer.H],
  trackMs: window.__snaplens.studio.trackMs,
  mouth: (() => {
    const s = window.__snaplens.studio;
    const f = s.ctx.faces[0];
    return f && { mouthOpen: +f.mouthOpen.toFixed(2), jawOpen: +(f.blend.jawOpen ?? 0).toFixed(2), smile: +f.smile.toFixed(2) };
  })(),
}));
step(`face found ${JSON.stringify(info)}`);

// Force "mouth open" etc. so trigger lenses show their effect in screenshots.
const forceTriggers = async (on) =>
  page.evaluate((on) => {
    window.__snaplens.studio.__force = on;
  }, on);
await page.evaluate(() => {
  const s = window.__snaplens.studio;
  const orig = s.setLens.bind(s);
  s.setLens = (id, v) => {
    orig(id, v);
    const rt = s.runtime;
    if (!rt.__wrapped) {
      const f = rt.frame.bind(rt);
      rt.frame = (c) => {
        if (s.__force) for (const face of c.faces) Object.assign(face, { mouthOpen: 0.8, smile: 0.9, pucker: 0.8 });
        f(c);
      };
      rt.__wrapped = true;
    }
  };
});

const only = process.env.LENSES?.split(',');
const shots = [];
for (const id of only ?? lensIds) {
  await select(id);
  const nVar = await page.evaluate(() => document.querySelectorAll('#variants .chip').length);
  for (let v = 0; v < Math.max(1, nVar); v++) {
    if (v) await select(id, v);
    const trig = ['rainbow', 'dragon', 'unicorn', 'puppy', 'bubbles', 'party', 'shook', 'love', 'bunny'].includes(id);
    await forceTriggers(trig);
    if (id === 'party') {
      await forceTriggers(false);
      await page.waitForTimeout(150);
      await forceTriggers(true);
    }
    const waitMs = ['teleport', 'hair', 'hands'].includes(id) ? 2500 : 900;
    await page.waitForTimeout(waitMs);
    const file = `${out}/lens-${id}-${v}.png`;
    await page.locator('#view').screenshot({ path: file, timeout: 120000 });
    shots.push(file);
  }
}
await forceTriggers(false);
step(`${shots.length} lens screenshots`);
if (process.env.LENS_ONLY) {
  console.log(`problems: ${problems.length}`, problems.slice(0, 20));
  await browser.close();
  process.exit(problems.some((p) => /Content Security Policy/i.test(p)) || external.length ? 1 : 0);
}

// Filters
await select('glasses');
for (const f of ['cartoon', 'scribble', 'comic', 'popart', 'neon', 'kaleido']) {
  await page.evaluate((f) => (window.__snaplens.studio.filter = f), f);
  await page.waitForTimeout(300);
  await page.locator('#view').screenshot({ path: `${out}/filter-${f}.png` });
}
await page.evaluate(() => (window.__snaplens.studio.filter = 'none'));

// Photo capture -> review -> save
await select('flowers');
await page.waitForTimeout(500);
await page.click('#shutter');
await page.waitForSelector('#review:not([hidden])');
await page.click('#review [data-act="sticker"]');
await page.click('.sticker-sheet button >> nth=3');
await page.click('#review [data-act="draw"]');
const box = await page.locator('#review canvas.ink').boundingBox();
await page.mouse.move(box.x + 40, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + 200, box.y + 120, { steps: 8 });
await page.mouse.up();
await page.screenshot({ path: `${out}/review.png` });
await page.click('#review [data-act="save"]');
await page.waitForSelector('#review', { state: 'hidden' });
step('photo saved');

// Video: hold the shutter for ~2s
const sb = await page.locator('#shutter').boundingBox();
await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
await page.mouse.down();
// generous hold: on a GPU-less test machine the microphone takes a while to start
await page.waitForFunction(() => !document.querySelector('#rec-badge').hidden, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.mouse.up();
await page.waitForSelector('#review:not([hidden])', { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/review-video.png` });
await page.click('#review [data-act="save"]');
await page.waitForSelector('#review', { state: 'hidden' });
step('video saved');

// Memories
await page.click('#btn-memories');
await page.waitForSelector('#memories:not([hidden])');
await page.waitForTimeout(500);
const count = await page.locator('#memories .thumb').count();
await page.screenshot({ path: `${out}/memories.png` });
await page.click('#memories .thumb >> nth=1');
await page.waitForSelector('#viewer:not([hidden])');
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/viewer.png` });
await page.click('#viewer [data-act="close"]');
await page.click('#memories [data-act="close"]');
step(`memories: ${count} items`);

// Uploaded photo with two faces -> face swap
if (twoFaces) {
  await page.setInputFiles('#file-media', twoFaces);
  await page.waitForFunction(() => window.__snaplens.studio.sourceKind === 'image');
  await select('swap');
  await page.waitForTimeout(1500);
  const faces = await page.evaluate(() => window.__snaplens.studio.status.faces);
  await page.locator('#view').screenshot({ path: `${out}/upload-swap.png` });
  await select('glasses');
  await page.waitForTimeout(600);
  await page.locator('#view').screenshot({ path: `${out}/upload-glasses.png` });
  step(`uploaded photo, faces=${faces}`);
  await page.click('#btn-back');
  await page.waitForFunction(() => window.__snaplens.studio.sourceKind === 'camera');
}

// Grown-ups area: create a PIN
await page.click('#btn-parent');
for (const k of ['1', '2', '3', '4', '1', '2', '3', '4']) {
  await page.click(`#pinpad .keys button:text-is("${k}")`);
  await page.waitForTimeout(40);
}
await page.waitForSelector('#parent:not([hidden])');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/parent.png`, fullPage: true });
step('parent area ok');
await page.click('#parent .sheet-head .round');

// Main UI screenshot
await select('puppy');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/ui.png` });

// Offline: service worker should have cached everything; reload with network off.
const swOk = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return !!reg.active;
});
step(`service worker active: ${swOk}`);
await page.waitForTimeout(4000);
await context.setOffline(true);
await page.reload();
await page.waitForFunction(() => !document.querySelector('#btn-start').disabled, null, { timeout: 60000 });
step('offline reload OK (model loaded from cache)');

writeFileSync(`${out}/report.json`, JSON.stringify({ info, problems, external, shots: shots.length, memories: count }, null, 2));
console.log(`problems: ${problems.length}`);
for (const p of problems.slice(0, 30)) console.log('  ', p);
console.log(`external requests: ${external.length}`, external.slice(0, 10));
await browser.close();
// Privacy check: nothing may try to leave the origin.
const leaks = problems.filter((p) => /Content Security Policy|Refused to connect/i.test(p));
if (external.length || leaks.length) {
  console.error('FAIL: the app tried to contact another server', external, leaks);
  process.exit(1);
}
