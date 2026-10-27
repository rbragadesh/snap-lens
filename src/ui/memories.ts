import { deleteItem, listItems, type MediaItem } from '../storage/db';
import type { Settings } from '../storage/settings';
import { $, ask, el, info, toast } from './dom';
import { requirePin } from './parent';

let urls: string[] = [];
const keep = (u: string) => (urls.push(u), u);
const releaseAll = () => {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
};

export async function openMemories(settings: Settings): Promise<void> {
  const root = $('#memories');
  const grid = $('.grid', root);
  const empty = $('.empty', root);
  const count = $('.count', root);
  root.hidden = false;

  const render = async () => {
    releaseAll();
    const items = await listItems();
    grid.replaceChildren();
    empty.hidden = items.length > 0;
    count.textContent = items.length ? `${items.length} ${items.length === 1 ? 'thing' : 'things'}` : '';
    items.forEach((it, i) => {
      const img = el('img', { src: keep(URL.createObjectURL(it.thumb)), alt: '' });
      const b = el('button', { className: 'thumb' }, [img]);
      if (it.kind === 'video') b.append(el('span', { className: 'play', textContent: '▶ video' }));
      b.onclick = async () => {
        await openViewer(items, i, settings);
        await render();
      };
      grid.append(b);
    });
  };
  await render();

  return new Promise((resolve) => {
    root.onclick = (e) => {
      if ((e.target as HTMLElement).closest('[data-act="close"]')) {
        root.onclick = null;
        root.hidden = true;
        grid.replaceChildren();
        releaseAll();
        resolve();
      }
    };
  });
}

function openViewer(items: MediaItem[], start: number, settings: Settings): Promise<void> {
  const root = $('#viewer');
  const frame = $('.frame', root);
  const area = $('.media-area', root);
  let i = start;
  let url = '';
  root.hidden = false;
  ($('[data-act="export"]', root) as HTMLElement).hidden = !settings.allowExport;

  const show = () => {
    if (url) URL.revokeObjectURL(url);
    const it = items[i];
    url = URL.createObjectURL(it.blob);
    frame.replaceChildren();
    const r = area.getBoundingClientRect();
    const node =
      it.kind === 'photo'
        ? el('img', { src: url, alt: '' })
        : (() => {
            const v = el('video', { src: url, controls: true, loop: true, playsInline: true, autoplay: true });
            v.setAttribute('playsinline', '');
            return v;
          })();
    node.style.maxWidth = `${r.width}px`;
    node.style.maxHeight = `${r.height}px`;
    frame.append(node);
    ($('[data-act="prev"]', root) as HTMLElement).style.visibility = i > 0 ? 'visible' : 'hidden';
    ($('[data-act="next"]', root) as HTMLElement).style.visibility = i < items.length - 1 ? 'visible' : 'hidden';
  };
  show();

  return new Promise((resolve) => {
    const close = () => {
      root.onclick = null;
      root.hidden = true;
      frame.replaceChildren();
      if (url) URL.revokeObjectURL(url);
      resolve();
    };
    root.onclick = async (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
      if (act === 'close') close();
      else if (act === 'prev' && i > 0) {
        i--;
        show();
      } else if (act === 'next' && i < items.length - 1) {
        i++;
        show();
      } else if (act === 'delete') {
        if (await ask('Delete this?', 'It will be gone forever.', 'Delete', 'Keep', true)) {
          await deleteItem(items[i].id);
          items.splice(i, 1);
          if (!items.length) close();
          else {
            i = Math.min(i, items.length - 1);
            show();
          }
        }
      } else if (act === 'export') {
        await exportItem(items[i], settings);
      }
    };
  });
}

/** Hands the file to iPadOS (Save to Photos / Files). Grown-ups only. */
async function exportItem(it: MediaItem, settings: Settings) {
  if (!settings.pinHash) {
    await info('Ask a grown-up 🙂', 'A grown-up needs to set up a PIN in ⚙️ before pictures can leave this app.');
    return;
  }
  if (!(await requirePin(settings, 'Grown-ups: enter PIN to save to the iPad Photos'))) return;
  const ext = it.kind === 'photo' ? 'jpg' : it.blob.type.includes('webm') ? 'webm' : 'mp4';
  const name = `snaplens-${new Date(it.created).toISOString().replace(/[:.]/g, '-')}.${ext}`;
  const file = new File([it.blob], name, { type: it.blob.type || (it.kind === 'photo' ? 'image/jpeg' : 'video/mp4') });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return;
  }
  const a = el('a', { href: URL.createObjectURL(file), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 4000);
  toast('Saved to Downloads 📁');
}
