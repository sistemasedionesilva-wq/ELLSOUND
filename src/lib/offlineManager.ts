import { Track } from "./music.shared";

const DB_NAME = "ellsound_offline";
const DB_VERSION = 1;
const STORE_NAME = "tracks";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export type OfflineTrack = Track & {
  audioBlob: Blob;
  downloadedAt: string;
};

// Salva a música em disco local (IndexedDB)
export async function saveTrackOffline(track: Track, preloadedBlob?: Blob): Promise<void> {
  if (!track.previewUrl) {
    throw new Error("Não é possível baixar esta música: prévia do áudio não disponível.");
  }

  try {
    const blob =
      preloadedBlob ??
      (await (async () => {
        const res = await fetch(track.previewUrl!);
        if (!res.ok) throw new Error("Falha ao baixar arquivo de áudio do servidor.");
        return res.blob();
      })());

    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const offlineTrack: OfflineTrack = {
      ...track,
      audioBlob: blob,
      downloadedAt: new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(offlineTrack);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("Erro ao salvar música offline:", error);
    throw error;
  }
}

// ---------- Pasta do dispositivo (File System Access API) ----------

type WritableLike = {
  write: (data: BlobPart) => Promise<void>;
  close: () => Promise<void>;
};

type FileHandleLike = {
  createWritable: () => Promise<WritableLike>;
};

export type DirHandleLike = {
  name: string;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileHandleLike>;
  queryPermission: (opts: { mode: "readwrite" }) => Promise<string>;
  requestPermission: (opts: { mode: "readwrite" }) => Promise<string>;
};

const HANDLE_DB_NAME = "ellsound_fs";
const HANDLE_STORE = "handles";
const HANDLE_KEY = "musicDir";

function getHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSavedDir(): Promise<DirHandleLike | null> {
  try {
    const db = await getHandleDB();
    return await new Promise<DirHandleLike | null>((resolve) => {
      const tx = db.transaction(HANDLE_STORE, "readonly");
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as DirHandleLike) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setSavedDir(handle: DirHandleLike): Promise<void> {
  const db = await getHandleDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, "readwrite");
    const req = tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function getDirectoryPicker() {
  return (
    window as unknown as {
      showDirectoryPicker?: (opts?: {
        mode?: string;
        id?: string;
        startIn?: string;
      }) => Promise<DirHandleLike>;
    }
  ).showDirectoryPicker;
}

export function isDeviceFolderSupported(): boolean {
  return typeof getDirectoryPicker() === "function";
}

// Pede ao usuário para escolher/criar a pasta do app (uma única vez)
export async function pickDeviceFolder(): Promise<boolean> {
  const picker = getDirectoryPicker();
  if (!picker) return false;
  try {
    const handle = await picker({ mode: "readwrite", id: "ellsound-music", startIn: "music" });
    await setSavedDir(handle);
    return true;
  } catch {
    return false;
  }
}

// Garante pasta escolhida e permissão concedida (chamar dentro do clique)
export async function ensureDeviceFolder(): Promise<boolean> {
  let dir = await getSavedDir();
  if (!dir) {
    const picked = await pickDeviceFolder();
    if (!picked) return false;
    dir = await getSavedDir();
    if (!dir) return false;
  }
  try {
    const q = await dir.queryPermission({ mode: "readwrite" });
    if (q === "granted") return true;
    const r = await dir.requestPermission({ mode: "readwrite" });
    return r === "granted";
  } catch {
    return false;
  }
}

function deviceFileName(track: Track, blobType: string): string {
  const base = `${track.artist} - ${track.title}`
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const ext =
    track.previewUrl?.toLowerCase().endsWith(".mp3") || blobType.includes("mpeg")
      ? ".mp3"
      : ".m4a";
  return `${base}${ext}`;
}

// Escreve o arquivo de áudio na pasta escolhida no dispositivo
export async function saveBlobToDevice(track: Track, blob: Blob): Promise<boolean> {
  try {
    const dir = await getSavedDir();
    if (!dir) return false;
    const q = await dir.queryPermission({ mode: "readwrite" });
    if (q !== "granted") return false;
    const fileHandle = await dir.getFileHandle(deviceFileName(track, blob.type), {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    console.error("Erro ao salvar na pasta do dispositivo:", error);
    return false;
  }
}

// Verifica se a música já existe offline
export async function isTrackDownloaded(trackId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return await new Promise<boolean>((resolve) => {
      const req = store.get(trackId);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// Busca e retorna o Blob offline da música
export async function getOfflineTrack(trackId: string): Promise<OfflineTrack | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return await new Promise<OfflineTrack | null>((resolve) => {
      const req = store.get(trackId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Lista todas as músicas armazenadas offline
export async function listOfflineTracks(): Promise<Track[]> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    return await new Promise<Track[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        resolve(results.map(({ audioBlob, downloadedAt, ...track }) => track));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

// Deleta a música salva
export async function deleteOfflineTrack(trackId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const req = store.delete(trackId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.error("Erro ao deletar música offline:", error);
    throw error;
  }
}
