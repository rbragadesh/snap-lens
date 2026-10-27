import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Content-Security-Policy injected into the built index.html.
// connect-src 'self' means the page can only talk to the origin that served it
// (a static host with no upload endpoint). No third-party server can be reached.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

/** Copies the MediaPipe runtime out of node_modules so it is served from our own origin. */
function mediapipeWasm(): Plugin {
  return {
    name: 'snaplens-mediapipe-wasm',
    buildStart() {
      const src = 'node_modules/@mediapipe/tasks-vision/wasm';
      const dst = 'public/wasm';
      mkdirSync(dst, { recursive: true });
      for (const f of WASM_FILES) cpSync(join(src, f), join(dst, f));
    },
  };
}

function csp(): Plugin {
  return {
    name: 'snaplens-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** Writes dist/sw.js with every built file precached, so the app works fully offline. */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'snaplens-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      if (!existsSync(outDir)) return;
      const files = listFiles(outDir)
        .map((p) => relative(outDir, p).split('\\').join('/'))
        .filter((p) => p !== 'sw.js');
      const hash = createHash('sha256');
      for (const f of files.sort()) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync('sw/sw.template.js', 'utf8');
      const sw = template
        .replace('__VERSION__', JSON.stringify(version))
        .replace('__FILES__', JSON.stringify(['./', ...files], null, 1));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [mediapipeWasm(), csp(), serviceWorker()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
