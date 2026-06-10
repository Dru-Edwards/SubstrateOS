/**
 * Persistent VM snapshot store (Phase 2 / Gate G2).
 *
 * v86 `save_state()` returns a full VM image (~73 MB raw at 256 MB RAM), which is
 * far too large to write to IndexedDB on every save. VM RAM is mostly zero/sparse,
 * so we gzip via CompressionStream before storing and gunzip on load — typically
 * shrinking it to single-digit MB.
 */

const DB_NAME = 'substrateos';
const STORE = 'snapshots';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'));
  });
}

async function gzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(buf).body!.pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new Response(buf).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

/** Compress and persist a VM snapshot under `key`. */
export async function saveSnapshot(key: string, bytes: ArrayBuffer): Promise<void> {
  const compressed = await gzip(bytes);
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(compressed, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('snapshot put failed'));
    });
  } finally {
    db.close();
  }
}

/** Load and decompress a VM snapshot, or null if none stored under `key`. */
export async function loadSnapshot(key: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  try {
    const stored = await new Promise<ArrayBuffer | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined);
      req.onerror = () => reject(req.error ?? new Error('snapshot get failed'));
    });
    if (!stored) return null;
    return gunzip(stored);
  } finally {
    db.close();
  }
}

/** Remove a stored snapshot (e.g. a "reset" affordance). */
export async function clearSnapshot(key: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('snapshot delete failed'));
    });
  } finally {
    db.close();
  }
}
