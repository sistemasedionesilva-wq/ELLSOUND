const DB_NAME = "ellsound-local-tracks";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalFile(
  id: string,
  payload: { file: File; title: string; artist: string },
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(payload, id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalFile(
  id: string,
): Promise<{ file: File; title: string; artist: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as { file: File; title: string; artist: string }) ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalFile(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export const LOCAL_TRACK_PREFIX = "local:";

export const LOCAL_ARTWORK =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#2196f3'/><stop offset='100%' stop-color='#102540'/></linearGradient></defs><rect width='300' height='300' fill='url(#g)'/><text x='150' y='185' font-size='110' text-anchor='middle' fill='rgba(255,255,255,0.9)' font-family='Arial'>♪</text></svg>",
  );
