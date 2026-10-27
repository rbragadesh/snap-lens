import { addItem, newId } from '../storage/db';
import { $, ask, canvasToBlob, el, thumbnail, toast } from './dom';

export type Captured =
  | { kind: 'photo'; canvas: HTMLCanvasElement; lens: string }
  | { kind: 'video'; blob: Blob; thumb: Blob; lens: string };

const COLORS = ['#ffffff', '#111111', '#ff1744', '#ff9100', '#ffea00', '#00e676', '#2979ff', '#d500f9', '#ff4fa3'];
const SIZES = [0.008, 0.016, 0.03];
const STICKERS = '😀 😂 😍 🥳 😎 🤩 😜 🤪 🥰 😺 🐶 🐱 🐰 🦄 🐼 🐸 🦋 🐝 🌈 ⭐ 🌟 ✨ 💖 💕 💜 🎉 🎈 🎁 🍓 🍕 🍩 🍦 🧁 🍭 ⚽ 🏀 🚀 🌸 🌻 👑 🎀 🕶️ 💎 🔥 💥 💯 👍 👋 🙌 🎃 👻 ❄️ ☀️ 🌙'.split(' ');
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

interface Stroke {
  color: string;
  width: number;
  pts: [number, number][];
}

interface Sticker {
  node: HTMLDivElement;
  ch: string;
  /** centre, as a fraction of the photo */
  x: number;
  y: number;
  /** size as a fraction of the photo width */
  size: number;
  rot: number;
}

type Action = { type: 'stroke'; s: Stroke } | { type: 'sticker'; s: Sticker };

export function openReview(item: Captured): Promise<'saved' | 'discarded'> {
  const root = $('#review');
  const frame = $('.frame', root);
  const area = $('.media-area', root);
  const palette = $('.palette', root);
  const sheet = $('.sticker-sheet', root);
  frame.replaceChildren();
  palette.replaceChildren();
  sheet.replaceChildren();
  palette.hidden = true;
  sheet.hidden = true;
  root.hidden = false;
  root.querySelectorAll<HTMLElement>('.photo-only').forEach((n) => (n.hidden = item.kind !== 'photo'));

  const cleanups: (() => void)[] = [];
  let mode: 'none' | 'draw' | 'sticker' = 'none';
  const history: Action[] = [];
  const strokes: Stroke[] = [];
  const stickers: Sticker[] = [];
  let color = COLORS[2];
  let sizeIdx = 1;
  let W = 1;
  let H = 1;
  let ink: HTMLCanvasElement | null = null;
  let layer: HTMLDivElement | null = null;

  const fit = () => {
    const r = area.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    frame.style.width = `${W * s}px`;
    frame.style.height = `${H * s}px`;
    for (const st of stickers) place(st);
  };

  if (item.kind === 'photo') {
    W = item.canvas.width;
    H = item.canvas.height;
    const base = item.canvas;
    base.className = 'base';
    base.style.width = '100%';
    base.style.height = '100%';
    ink = el('canvas', { className: 'ink', width: W, height: H });
    layer = el('div', { className: 'stickers' });
    frame.append(base, ink, layer);
    setupDrawing(ink);
    buildPalette();
    buildStickerSheet();
  } else {
    const url = URL.createObjectURL(item.blob);
    const v = el('video', { src: url, loop: true, playsInline: true, autoplay: true });
    v.setAttribute('playsinline', '');
    v.style.width = '100%';
    v.style.height = '100%';
    frame.append(v);
    cleanups.push(() => {
      v.pause();
      URL.revokeObjectURL(url);
    });
    v.addEventListener('loadedmetadata', () => {
      W = v.videoWidth || 3;
      H = v.videoHeight || 4;
      fit();
    });
    v.play().catch(() => {
      v.muted = true;
      void v.play();
      toast('Tap the video to hear it 🔊');
    });
    v.onclick = () => {
      v.muted = !v.muted;
    };
  }
  fit();
  window.addEventListener('resize', fit);
  cleanups.push(() => window.removeEventListener('resize', fit));

  function setMode(m: typeof mode) {
    mode = mode === m ? 'none' : m;
    palette.hidden = mode !== 'draw';
    sheet.hidden = mode !== 'sticker';
    if (ink) ink.style.pointerEvents = mode === 'draw' ? 'auto' : 'none';
    root.querySelector('[data-act="draw"]')?.classList.toggle('sel', mode === 'draw');
    root.querySelector('[data-act="sticker"]')?.classList.toggle('sel', mode === 'sticker');
  }
  setMode('none');

  function buildPalette() {
    for (const c of COLORS) {
      const b = el('button', { className: `dot${c === color ? ' sel' : ''}` });
      b.style.background = c;
      b.onclick = () => {
        color = c;
        palette.querySelectorAll('.dot').forEach((d) => d.classList.toggle('sel', d === b));
      };
      palette.append(b);
    }
    SIZES.forEach((_, i) => {
      const dot = el('i');
      dot.style.width = dot.style.height = `${8 + i * 9}px`;
      const b = el('button', { className: `size${i === sizeIdx ? ' sel' : ''}` }, [dot]);
      b.onclick = () => {
        sizeIdx = i;
        palette.querySelectorAll('.size').forEach((d) => d.classList.toggle('sel', d === b));
      };
      palette.append(b);
    });
  }

  function buildStickerSheet() {
    for (const ch of STICKERS) {
      const b = el('button', { textContent: ch });
      b.onclick = () => {
        addSticker(ch);
        setMode('none');
      };
      sheet.append(b);
    }
  }

  function redrawInk() {
    if (!ink) return;
    const g = ink.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of strokes) {
      g.strokeStyle = s.color;
      g.lineWidth = s.width;
      g.beginPath();
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      if (s.pts.length === 1) g.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      g.stroke();
    }
  }

  function setupDrawing(c: HTMLCanvasElement) {
    let cur: Stroke | null = null;
    const toPx = (e: PointerEvent): [number, number] => {
      const r = c.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    };
    c.addEventListener('pointerdown', (e) => {
      if (mode !== 'draw') return;
      c.setPointerCapture(e.pointerId);
      cur = { color, width: SIZES[sizeIdx] * W, pts: [toPx(e)] };
      strokes.push(cur);
      history.push({ type: 'stroke', s: cur });
      redrawInk();
    });
    c.addEventListener('pointermove', (e) => {
      if (!cur) return;
      cur.pts.push(toPx(e));
      redrawInk();
    });
    const end = () => (cur = null);
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  function place(st: Sticker) {
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const px = st.size * fw;
    st.node.style.fontSize = `${px}px`;
    st.node.style.transform = `translate(${st.x * fw - px / 2 - 6}px, ${st.y * fh - px / 2 - 6}px) rotate(${st.rot}rad)`;
  }

  function select(st: Sticker | null) {
    for (const s of stickers) {
      s.node.classList.toggle('sel', s === st);
      s.node.querySelector('.x')?.toggleAttribute('hidden', s !== st);
    }
  }

  function addSticker(ch: string) {
    if (!layer) return;
    const node = el('div', { className: 'sticker' }, [ch]);
    const x = el('button', { className: 'x', textContent: '✖' });
    node.append(x);
    const st: Sticker = { node, ch, x: 0.5, y: 0.5, size: 0.22, rot: 0 };
    x.onpointerdown = (e) => {
      e.stopPropagation();
      node.remove();
      stickers.splice(stickers.indexOf(st), 1);
      const hi = history.findIndex((a) => a.type === 'sticker' && a.s === st);
      if (hi >= 0) history.splice(hi, 1);
    };
    // drag with one finger, pinch/turn with two
    const pts = new Map<number, [number, number]>();
    let start: { x: number; y: number; size: number; rot: number; d: number; a: number; cx: number; cy: number } | null = null;
    const snapshot = () => {
      const p = [...pts.values()];
      const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
      const cy = p.reduce((s, q) => s + q[1], 0) / p.length;
      const d = p.length > 1 ? Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) : 1;
      const a = p.length > 1 ? Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]) : 0;
      start = { x: st.x, y: st.y, size: st.size, rot: st.rot, d, a, cx, cy };
    };
    node.addEventListener('pointerdown', (e) => {
      if (mode === 'draw') return;
      e.stopPropagation();
      node.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      select(st);
      snapshot();
    });
    node.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !start) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const p = [...pts.values()];
      const cx = p.reduce((s, q) => s + q[0], 0) / p.length;
      const cy = p.reduce((s, q) => s + q[1], 0) / p.length;
      st.x = Math.min(1, Math.max(0, start.x + (cx - start.cx) / frame.clientWidth));
      st.y = Math.min(1, Math.max(0, start.y + (cy - start.cy) / frame.clientHeight));
      if (p.length > 1) {
        const d = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
        const a = Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]);
        st.size = Math.min(1, Math.max(0.05, start.size * (d / start.d)));
        st.rot = start.rot + (a - start.a);
      }
      place(st);
    });
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size) snapshot();
      else start = null;
    };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    layer.append(node);
    stickers.push(st);
    history.push({ type: 'sticker', s: st });
    place(st);
    select(st);
  }

  const frameTap = (e: PointerEvent) => {
    if (e.target === frame || e.target === layer || e.target === ink) select(null);
  };
  frame.addEventListener('pointerdown', frameTap);
  cleanups.push(() => frame.removeEventListener('pointerdown', frameTap));

  function undo() {
    const a = history.pop();
    if (!a) return;
    if (a.type === 'stroke') {
      strokes.splice(strokes.indexOf(a.s), 1);
      redrawInk();
    } else {
      a.s.node.remove();
      stickers.splice(stickers.indexOf(a.s), 1);
    }
  }

  async function compose(): Promise<HTMLCanvasElement> {
    if (item.kind !== 'photo') throw new Error('not a photo');
    const out = el('canvas', { width: W, height: H });
    const g = out.getContext('2d')!;
    g.drawImage(item.canvas, 0, 0);
    if (ink) g.drawImage(ink, 0, 0);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const s of stickers) {
      g.save();
      g.translate(s.x * W, s.y * H);
      g.rotate(s.rot);
      g.font = `${Math.round(s.size * W * 0.86)}px ${EMOJI_FONT}`;
      g.fillText(s.ch, 0, s.size * W * 0.04);
      g.restore();
    }
    return out;
  }

  return new Promise((resolve) => {
    const finish = (r: 'saved' | 'discarded') => {
      root.onclick = null;
      root.hidden = true;
      cleanups.forEach((f) => f());
      frame.replaceChildren();
      resolve(r);
    };
    root.onclick = async (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'draw') setMode('draw');
      else if (act === 'sticker') setMode('sticker');
      else if (act === 'undo') undo();
      else if (act === 'discard') {
        if (await ask('Throw it away?', 'This picture will be gone.', 'Throw away', 'Keep it', true)) finish('discarded');
      } else if (act === 'save') {
        const btn = e.target as HTMLButtonElement;
        btn.disabled = true;
        try {
          if (item.kind === 'photo') {
            const c = await compose();
            const blob = await canvasToBlob(c);
            const thumb = await thumbnail(c, W, H);
            await addItem({ id: newId(), kind: 'photo', blob, thumb, created: Date.now(), lens: item.lens });
          } else {
            await addItem({ id: newId(), kind: 'video', blob: item.blob, thumb: item.thumb, created: Date.now(), lens: item.lens });
          }
          toast('Saved to Memories ✨');
          finish('saved');
        } catch (err) {
          console.error(err);
          toast('Could not save — the iPad may be full 😕', 3500);
        } finally {
          btn.disabled = false;
        }
      }
    };
  });
}
