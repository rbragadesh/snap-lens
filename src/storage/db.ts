// Memories are stored only in this browser's IndexedDB on the iPad. Nothing is uploaded anywhere.
export interface MediaItem {
  id: string;
  kind: 'photo' | 'video';
  blob: Blob;
  thumb: Blob;
  created: number;
  lens: string;
}

const DB = 'snaplens';
const STORE = 'media';
let dbp: Promise<IDBDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const s = req.result.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('created', 'created');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const r = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(r.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export async function addItem(item: MediaItem) {
  await tx('readwrite', (s) => s.put(item));
}

export async function listItems(): Promise<MediaItem[]> {
  const all = await tx<MediaItem[]>('readonly', (s) => s.getAll());
  return all.sort((a, b) => b.created - a.created);
}

export async function deleteItem(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}

export async function clearAll() {
  await tx('readwrite', (s) => s.clear());
}

/** Ask the browser not to evict our data under storage pressure. */
export async function persist() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function usage() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { used: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
