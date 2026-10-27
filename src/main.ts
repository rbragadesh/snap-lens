import './styles.css';
import { audioContext } from './audio/voice';
import { Studio } from './engine/studio';
import { persist } from './storage/db';
import { loadSettings } from './storage/settings';
import { CameraUI } from './ui/camera';
import { $, setSfxContext } from './ui/dom';

const settings = loadSettings();
const offline = { done: 0, total: 0, ready: false };

function offlineText() {
  if (!('serviceWorker' in navigator)) return 'Offline mode is not available in this browser.';
  if (offline.ready || navigator.serviceWorker.controller) return '✓ Everything is saved on this iPad. Works in Airplane Mode.';
  if (offline.total) return `Saving the app for offline use… ${Math.round((offline.done / offline.total) * 100)}%`;
  return 'Will be saved for offline use after the first launch.';
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data as { type: string; done?: number; total?: number };
    if (d.type === 'sw-progress') {
      offline.done = d.done ?? 0;
      offline.total = d.total ?? 0;
    } else if (d.type === 'sw-ready') offline.ready = true;
  });
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
}

// Kid-proofing: no pinch zoom, no long-press menus, no text selection.
for (const ev of ['gesturestart', 'gesturechange', 'contextmenu'] as const) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

const canvas = $('#view') as HTMLCanvasElement;
const studio = new Studio(canvas, $('#stage'), {
  maxFaces: settings.maxFaces,
  maxRes: settings.quality === 'saver' ? 960 : 1280,
  cpuOnly: settings.cpuOnly,
});

const applySettings = () =>
  studio.setOptions({ maxFaces: settings.maxFaces, maxRes: settings.quality === 'saver' ? 960 : 1280 });

const ui = new CameraUI(studio, settings, offlineText, applySettings);

// Exposed for automated tests and debugging; contains nothing that talks to the network.
(window as unknown as { __snaplens: unknown }).__snaplens = { studio, settings, ui };

const startBtn = $('#btn-start') as HTMLButtonElement;
const note = $('#splash-note');

const modelReady = studio.init().then(
  () => true,
  (e) => {
    console.error(e);
    note.textContent = 'Sorry, this iPad could not start the face tracker. It needs iPadOS 17 or newer. Close the app and try again, or ask a grown-up to update the iPad.';
    return false;
  },
);

modelReady.then((ok) => {
  startBtn.disabled = !ok;
  startBtn.textContent = ok ? "Let's go! 📸" : 'Not available';
  if (ok && !settings.pinHash) note.textContent = 'Grown-ups: tap ⚙️ in the top corner to set a PIN and see the privacy settings.';
});

startBtn.onclick = async () => {
  setSfxContext(audioContext());
  startBtn.disabled = true;
  startBtn.textContent = 'Starting camera…';
  void persist();
  try {
    await studio.startCamera('user');
  } catch (e) {
    console.error(e);
    startBtn.disabled = false;
    startBtn.textContent = 'Try again';
    note.textContent =
      (e as DOMException).name === 'NotAllowedError'
        ? 'The camera is turned off for this app. A grown-up can allow it in Settings → Safari → Camera (or in the website settings “aA” menu).'
        : 'Could not start the camera. Is another app using it?';
    return;
  }
  ui.mount();
  studio.start();
  $('#splash').hidden = true;
};
