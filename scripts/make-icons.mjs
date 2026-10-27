// Renders the app icon (pure SVG, no external assets) to PNGs using the preinstalled Chromium.
// Usage: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node-tools/node_modules/playwright');
}

const heart = (x, y, s) =>
  `M ${x} ${y + s * 0.95} C ${x - s * 1.5} ${y + s * 0.1} ${x - s * 1.1} ${y - s * 1.05} ${x} ${y - s * 0.45} C ${x + s * 1.1} ${y - s * 1.05} ${x + s * 1.5} ${y + s * 0.1} ${x} ${y + s * 0.95} Z`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#7c4dff"/>
    </linearGradient>
    <radialGradient id="face" cx="0.4" cy="0.35" r="0.7">
      <stop offset="0" stop-color="#fff59d"/><stop offset="1" stop-color="#ffc107"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="276" r="170" fill="url(#face)" stroke="#2b1d2e" stroke-width="12"/>
  <path d="M 176 330 Q 256 410 336 330" fill="none" stroke="#2b1d2e" stroke-width="16" stroke-linecap="round"/>
  <path d="M 196 240 Q 256 220 316 240" fill="none" stroke="#ff3d9a" stroke-width="14"/>
  <path d="${heart(190, 250, 62)}" fill="#ff3d9a" stroke="#c2185b" stroke-width="8"/>
  <path d="${heart(322, 250, 62)}" fill="#ff3d9a" stroke="#c2185b" stroke-width="8"/>
  <ellipse cx="170" cy="222" rx="20" ry="10" fill="#fff" opacity="0.7" transform="rotate(-30 170 222)"/>
  <ellipse cx="302" cy="222" rx="20" ry="10" fill="#fff" opacity="0.7" transform="rotate(-30 302 222)"/>
  <path d="M 400 70 L 412 108 L 450 120 L 412 132 L 400 170 L 388 132 L 350 120 L 388 108 Z" fill="#fff"/>
  <path d="M 110 70 L 117 92 L 139 99 L 117 106 L 110 128 L 103 106 L 81 99 L 103 92 Z" fill="#fff" opacity="0.85"/>
</svg>`;

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
for (const [size, name] of [
  [512, 'icon-512.png'],
  [192, 'icon-192.png'],
  [180, 'apple-touch-icon.png'],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false });
}
await browser.close();
console.log('icons written');
