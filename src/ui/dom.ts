export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

let toastTimer = 0;
export function toast(text: string, ms = 2200) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (t.hidden = true), ms);
}

/** Big friendly yes/no dialog. */
export function ask(title: string, body: string, yes = 'Yes', no = 'No', danger = false): Promise<boolean> {
  const d = $('#dialog');
  d.replaceChildren();
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      d.hidden = true;
      resolve(v);
    };
    const card = el('div', { className: 'card' }, [
      el('h3', { textContent: title }),
      el('p', { textContent: body }),
      el('div', { className: 'row' }, [
        el('button', { className: 'pill', textContent: no, onclick: () => done(false) }),
        el('button', { className: `pill ${danger ? 'danger' : 'ok'}`, textContent: yes, onclick: () => done(true) }),
      ]),
    ]);
    d.append(card);
    d.hidden = false;
  });
}

export function info(title: string, body: string, ok = 'OK') {
  const d = $('#dialog');
  d.replaceChildren();
  return new Promise<void>((resolve) => {
    d.append(
      el('div', { className: 'card' }, [
        el('h3', { textContent: title }),
        el('p', { textContent: body }),
        el('div', { className: 'row' }, [
          el('button', {
            className: 'pill ok',
            textContent: ok,
            onclick: () => {
              d.hidden = true;
              resolve();
            },
          }),
        ]),
      ]),
    );
    d.hidden = false;
  });
}

/** Tiny synthesized sounds (no audio files). */
let sfxCtx: AudioContext | null = null;
export function setSfxContext(ac: AudioContext) {
  sfxCtx = ac;
}

export function sfx(kind: 'shutter' | 'tick' | 'pop') {
  const ac = sfxCtx;
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime;
  const g = ac.createGain();
  g.connect(ac.destination);
  if (kind === 'shutter') {
    const len = Math.floor(ac.sampleRate * 0.12);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = ac.createBufferSource();
    src.buffer = buf;
    g.gain.value = 0.5;
    src.connect(g);
    src.start(t);
  } else {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'tick' ? 1400 : 600, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'tick' ? 900 : 1200, t + 0.08);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.12);
  }
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/jpeg', q = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, q));
}

/** Small JPEG thumbnail from any drawable. */
export async function thumbnail(src: CanvasImageSource, w: number, h: number) {
  const s = 360 / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return canvasToBlob(c, 'image/jpeg', 0.8);
}
