import { isTallerFile, kindOfFile } from "@/lib/office-text";
import { applyEstado, buildEstado, type IasporEstado } from "@/lib/backup";
import { unzipStore } from "@/lib/zip-store";

const STATE_FILE = "IASPOR-estado.json";
const SEQ_FILE = "IASPOR-albaran-n.txt";
const SKIP_FILE = /^IASPOR[-_]/i;
const KEY = "iaspor:taller-folder";
const SKIP_DIR = /^(node_modules|\.git|\.trash|__macosx|\.ds_store)$/i;
const MAX_FILES = 120;
const MAX_DEPTH = 16;

export type TallerFolder = {
  name: string;
  at: number;
  files: number;
  folders?: number;
};

export function loadTallerFolder(): TallerFolder | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as TallerFolder;
    if (!p?.name) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveTallerFolder(name: string, files: number, folders = 1) {
  const next: TallerFolder = { name: name.slice(0, 80), at: Date.now(), files, folders };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function folderNameFromFiles(files: File[]) {
  const rel = files
    .map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || "")
    .find((p) => p.includes("/"));
  if (rel) return rel.split("/")[0] || "Carpeta";
  return "Carpeta del teléfono";
}

export function subfolderCount(files: File[]) {
  const set = new Set<string>();
  for (const f of files) {
    const p = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    const parts = p.split("/").filter(Boolean);
    if (parts.length <= 1) {
      set.add(".");
      continue;
    }
    set.add(parts.slice(0, -1).join("/"));
  }
  return Math.max(1, set.size);
}

function withPath(file: File, path: string) {
  try {
    const next = new File([file], file.name, { type: file.type, lastModified: file.lastModified });
    Object.defineProperty(next, "webkitRelativePath", { value: path.replace(/^\/+/, "") });
    return next;
  } catch {
    return file;
  }
}

type DirHandle = FileSystemDirectoryHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
  entries?: () => AsyncIterable<[string, FileSystemHandle]>;
  keys?: () => AsyncIterable<string>;
};

async function* listDir(dir: DirHandle): AsyncGenerator<[string, FileSystemHandle | null]> {
  if (typeof dir.entries === "function") {
    for await (const pair of dir.entries()) yield pair;
    return;
  }
  if (typeof dir.values === "function") {
    for await (const entry of dir.values()) yield [entry.name, entry];
    return;
  }
  if (typeof dir.keys === "function") {
    for await (const name of dir.keys()) yield [name, null];
  }
}

async function ensureRead(handle: FileSystemHandle) {
  const h = handle as FileSystemHandle & {
    queryPermission?: (o: { mode: string }) => Promise<string>;
    requestPermission?: (o: { mode: string }) => Promise<string>;
  };
  if (typeof h.queryPermission !== "function") return true;
  let s = await h.queryPermission({ mode: "read" });
  if (s !== "granted" && typeof h.requestPermission === "function") {
    s = await h.requestPermission({ mode: "read" });
  }
  return s === "granted";
}

export async function filesFromZip(buf: ArrayBuffer, prefix = "") {
  const out: File[] = [];
  for (const e of unzipStore(buf)) {
    if (!e.name || e.name.endsWith("/")) continue;
    const parts = e.name.split("/").filter((p) => p && !SKIP_DIR.test(p));
    if (parts.length !== e.name.split("/").filter(Boolean).length) continue;
    const base = parts[parts.length - 1];
    if (base.startsWith(".")) continue;
    const file = new File([e.data as BlobPart], base);
    if (!kindOfFile(file)) continue;
    const path = [prefix, ...parts].filter(Boolean).join("/");
    out.push(withPath(file, path));
  }
  return out;
}

export async function collectTallerFiles(root: FileSystemDirectoryHandle) {
  const files: File[] = [];
  const seen = new Set<string>();
  let folders = 0;
  const stack: { dir: FileSystemDirectoryHandle; path: string; depth: number }[] = [
    { dir: root, path: root.name || "", depth: 0 },
  ];

  while (stack.length && files.length < MAX_FILES) {
    const cur = stack.pop()!;
    if (cur.depth > MAX_DEPTH) continue;
    folders += 1;
    try {
      if (!(await ensureRead(cur.dir))) continue;
    } catch {
      continue;
    }

    try {
      for await (const [name, entry] of listDir(cur.dir as DirHandle)) {
        if (!name || name.startsWith(".") || SKIP_DIR.test(name) || SKIP_FILE.test(name)) continue;
        const rel = cur.path ? `${cur.path}/${name}` : name;

        if (entry?.kind === "directory") {
          stack.push({ dir: entry as FileSystemDirectoryHandle, path: rel, depth: cur.depth + 1 });
          continue;
        }

        if (!entry) {
          try {
            const sub = await cur.dir.getDirectoryHandle(name);
            stack.push({ dir: sub, path: rel, depth: cur.depth + 1 });
            continue;
          } catch {
            /* no es carpeta */
          }
        }

        try {
          const handle = (
            entry?.kind === "file" ? entry : await cur.dir.getFileHandle(name)
          ) as FileSystemFileHandle;
          const raw = await handle.getFile();
          if (/\.zip$/i.test(raw.name)) {
            const inner = await filesFromZip(await raw.arrayBuffer(), rel.replace(/\.zip$/i, ""));
            for (const f of inner) {
              if (files.length >= MAX_FILES) break;
              const key = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
              if (seen.has(key)) continue;
              seen.add(key);
              files.push(f);
            }
            continue;
          }
          if (!isTallerFile(raw)) continue;
          if (seen.has(rel)) continue;
          seen.add(rel);
          files.push(withPath(raw, rel));
        } catch {
          /* archivo bloqueado */
        }
      }
    } catch {
      /* carpeta ilegible */
    }
  }

  return { files, folders };
}

export function isMobileChrome() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad/i.test(navigator.userAgent);
}

const HANDLE_DB = "iaspor-fs";

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTallerHandle(dir: FileSystemDirectoryHandle) {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("kv").put(dir, "taller");
  });
}

export async function loadTallerHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb();
    const tx = db.transaction("kv", "readonly");
    const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      const req = tx.objectStore("kv").get("taller");
      req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
      req.onerror = () => reject(req.error);
    });
    return handle ?? null;
  } catch {
    return null;
  }
}

async function ensureMode(handle: FileSystemHandle, mode: "read" | "readwrite") {
  const h = handle as FileSystemHandle & {
    queryPermission?: (o: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (o: { mode: string }) => Promise<PermissionState>;
  };
  if (typeof h.queryPermission !== "function") return true;
  let s = await h.queryPermission({ mode });
  if (s !== "granted" && typeof h.requestPermission === "function") {
    s = await h.requestPermission({ mode });
  }
  return s === "granted";
}

export async function writeFolderEstado(dir?: FileSystemDirectoryHandle | null) {
  try {
    const handle = dir ?? (await loadTallerHandle());
    if (!handle) return false;
    if (!(await ensureMode(handle, "readwrite"))) return false;
    const file = await handle.getFileHandle(STATE_FILE, { create: true });
    const w = await file.createWritable();
    const estado = buildEstado();
    await w.write(JSON.stringify(estado));
    await w.close();
    const nf = await handle.getFileHandle(SEQ_FILE, { create: true });
    const nw = await nf.createWritable();
    await nw.write(String(estado.lastAlbaran || 0));
    await nw.close();
    return true;
  } catch {
    return false;
  }
}

export async function readFolderEstado(dir: FileSystemDirectoryHandle): Promise<IasporEstado | null> {
  try {
    if (!(await ensureMode(dir, "read"))) return null;
    const file = await dir.getFileHandle(STATE_FILE);
    const text = await (await file.getFile()).text();
    const p = JSON.parse(text) as IasporEstado;
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}

export async function restoreFolderEstado(dir: FileSystemDirectoryHandle) {
  const estado = await readFolderEstado(dir);
  let nFile = 0;
  try {
    if (await ensureMode(dir, "read")) {
      const f = await dir.getFileHandle(SEQ_FILE);
      nFile = Number.parseInt(await (await f.getFile()).text(), 10) || 0;
    }
  } catch {
    nFile = 0;
  }
  if (estado) {
    const last = Math.max(Number(estado.lastAlbaran) || 0, nFile);
    if (last > (estado.lastAlbaran || 0)) {
      estado.lastAlbaran = last;
      estado.albaranSeq = { year: estado.albaranSeq?.year ?? new Date().getFullYear(), last };
    }
    return applyEstado(estado);
  }
  if (nFile > 0) return applyEstado({ lastAlbaran: nFile, albaranSeq: { year: new Date().getFullYear(), last: nFile } });
  return false;
}

export async function writeAlbaranPdfToFolder(file: File) {
  try {
    const handle = await loadTallerHandle();
    if (!handle) return false;
    if (!(await ensureMode(handle, "readwrite"))) return false;
    let dir = handle;
    try {
      dir = await handle.getDirectoryHandle("albaranes", { create: true });
    } catch {
      dir = handle;
    }
    const fh = await dir.getFileHandle(file.name, { create: true });
    const w = await fh.createWritable();
    await w.write(await file.arrayBuffer());
    await w.close();
    await writeFolderEstado(handle);
    return true;
  } catch {
    return false;
  }
}

export async function requestDurableStorage() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
