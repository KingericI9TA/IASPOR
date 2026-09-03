import { isTallerFile, kindOfFile, mimeForKind } from "@/lib/office-text";
import { applyEstado, buildEstado, isTrustedEstado, estadoNeedsConfirm, type IasporEstado } from "@/lib/backup";
import { unzipZip } from "@/lib/zip-store";
import { peekNextAlbaranNumber, restoreAlbaranBackup } from "@/lib/albaran";

const STATE_FILE = "IASPOR-estado.json";
const SEQ_FILE = "IASPOR-albaran-n.txt";
const ALBARANES_DIR = "albaranes";
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
  for (const e of await unzipZip(buf)) {
    if (!e.name || e.name.endsWith("/")) continue;
    const parts = e.name.split("/").filter((p) => p && !SKIP_DIR.test(p));
    if (parts.length !== e.name.split("/").filter(Boolean).length) continue;
    const base = parts[parts.length - 1];
    if (base.startsWith(".")) continue;
    const file = new File([e.data as BlobPart], base);
    const kind = kindOfFile(file);
    if (!kind) continue;
    const typed = new File([e.data as BlobPart], base, { type: mimeForKind(kind) });
    const path = [prefix, ...parts].filter(Boolean).join("/");
    out.push(withPath(typed, path));
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
          if (!isTallerFile(raw) && !/codigos/i.test(raw.name)) continue;
          if (seen.has(rel)) continue;
          seen.add(rel);
          const next = withPath(raw, rel);
          if (/codigos/i.test(raw.name)) files.unshift(next);
          else files.push(next);
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

export async function collectMatchingFiles(
  root: FileSystemDirectoryHandle,
  match: (file: File) => boolean,
  limit = 8,
) {
  const files: File[] = [];
  const seen = new Set<string>();
  const stack: { dir: FileSystemDirectoryHandle; path: string; depth: number }[] = [
    { dir: root, path: root.name || "", depth: 0 },
  ];

  while (stack.length && files.length < limit) {
    const cur = stack.pop()!;
    if (cur.depth > MAX_DEPTH) continue;
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
            /* archivo */
          }
        }
        try {
          const handle = (
            entry?.kind === "file" ? entry : await cur.dir.getFileHandle(name)
          ) as FileSystemFileHandle;
          const raw = await handle.getFile();
          const next = withPath(raw, rel);
          if (!match(next) || seen.has(rel)) continue;
          seen.add(rel);
          files.push(next);
          if (files.length >= limit) break;
        } catch {
          /* bloqueado */
        }
      }
    } catch {
      /* ilegible */
    }
  }
  return files;
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

export const ESQUEMAS_FOLDER = "esquemas de IASPOR";

async function putHandle(key: string, dir: FileSystemDirectoryHandle) {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("kv").put(dir, key);
  });
}

async function getHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDb();
    const tx = db.transaction("kv", "readonly");
    const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
      const req = tx.objectStore("kv").get(key);
      req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined);
      req.onerror = () => reject(req.error);
    });
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function saveTallerHandle(dir: FileSystemDirectoryHandle) {
  await putHandle("taller", dir);
}

export async function loadTallerHandle(): Promise<FileSystemDirectoryHandle | null> {
  return getHandle("taller");
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

export async function restoreFolderEstado(
  dir: FileSystemDirectoryHandle,
  mode: "boot" | "pick" = "boot",
) {
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
    if (!isTrustedEstado(estado)) return false;
    if (mode === "boot" && estadoNeedsConfirm(estado)) return false;
    const last = Math.max(Number(estado.lastAlbaran) || 0, nFile);
    if (last > (estado.lastAlbaran || 0)) {
      estado.lastAlbaran = last;
      estado.albaranSeq = { year: estado.albaranSeq?.year ?? new Date().getFullYear(), last };
    }
    return applyEstado(estado, { confirm: mode === "pick" });
  }
  if (mode === "boot") return false;
  if (nFile > 0) {
    return applyEstado(
      { app: "IASPOR", v: 2, lastAlbaran: nFile, albaranSeq: { year: new Date().getFullYear(), last: nFile } },
      { confirm: true },
    );
  }
  return false;
}

export async function writeFileToTallerFolder(file: File, subdir?: string) {
  try {
    const handle = await loadTallerHandle();
    if (!handle) return false;
    if (!(await ensureMode(handle, "readwrite"))) return false;
    let dir = handle;
    if (subdir) {
      try {
        dir = await handle.getDirectoryHandle(subdir, { create: true });
      } catch {
        dir = handle;
      }
    }
    return writeFileToDirectory(dir, file);
  } catch {
    return false;
  }
}

export async function writeFileToDirectory(dir: FileSystemDirectoryHandle, file: File) {
  try {
    if (!(await ensureMode(dir, "readwrite"))) return false;
    const safe = file.name.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120) || "manual.pdf";
    const fh = await dir.getFileHandle(safe, { create: true });
    const w = await fh.createWritable();
    await w.write(await file.arrayBuffer());
    await w.close();
    return true;
  } catch {
    return false;
  }
}

export async function ensureEsquemasFolder(root?: FileSystemDirectoryHandle | null) {
  const remembered = await getHandle("esquemas");
  if (remembered && (await ensureMode(remembered, "readwrite"))) return remembered;
  const base = root ?? (await loadTallerHandle());
  if (!base) return null;
  if (!(await ensureMode(base, "readwrite"))) return null;
  try {
    const dir = await base.getDirectoryHandle(ESQUEMAS_FOLDER, { create: true });
    await putHandle("esquemas", dir);
    return dir;
  } catch {
    return base;
  }
}

export async function pickEsquemasFolder(): Promise<FileSystemDirectoryHandle | null> {
  const startIn = await ensureEsquemasFolder();
  const picker = (
    window as Window & {
      showDirectoryPicker?: (opts?: {
        id?: string;
        mode?: string;
        startIn?: FileSystemHandle | string;
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) return startIn;
  try {
    const dir = await picker.call(window, {
      id: "iaspor-esquemas",
      mode: "readwrite",
      startIn: startIn ?? "documents",
    });
    await putHandle("esquemas", dir);
    return dir;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    return startIn;
  }
}

export async function writeAlbaranPdfToFolder(file: File) {
  const n = Number.parseInt(/(\d{2,})/.exec(file.name)?.[1] ?? "", 10);
  return commitAlbaranToFolder(file, Number.isFinite(n) ? n : 0);
}

export function canPickTallerDirectory() {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function"
  );
}

export async function pickTallerDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (
    window as Window & {
      showDirectoryPicker?: (opts?: {
        id?: string;
        mode?: string;
        startIn?: FileSystemHandle | string;
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) return null;
  try {
    const dir = await picker.call(window, {
      id: "iaspor-taller",
      mode: "readwrite",
      startIn: "documents",
    });
    await saveTallerHandle(dir);
    saveTallerFolder(dir.name || "Carpeta del taller", 0);
    void requestDurableStorage();
    return dir;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    return null;
  }
}

async function readSeqFile(dir: FileSystemDirectoryHandle): Promise<number> {
  try {
    if (!(await ensureMode(dir, "read"))) return 0;
    const f = await dir.getFileHandle(SEQ_FILE);
    return Number.parseInt(await (await f.getFile()).text(), 10) || 0;
  } catch {
    return 0;
  }
}

async function scanAlbaranesPdfMax(root: FileSystemDirectoryHandle): Promise<number> {
  let max = 0;
  try {
    if (!(await ensureMode(root, "read"))) return 0;
    const dir = await root.getDirectoryHandle(ALBARANES_DIR);
    for await (const [name] of listDir(dir as DirHandle)) {
      const m = /albaran[-_\s]*(\d{2,})/i.exec(name);
      if (m) max = Math.max(max, Number.parseInt(m[1], 10) || 0);
    }
  } catch {
    /* sin carpeta albaranes */
  }
  return max;
}

/** Último número visto en la carpeta (txt + PDFs). null si no hay carpeta. */
export async function readFolderAlbaranLast(): Promise<number | null> {
  try {
    const handle = await loadTallerHandle();
    if (!handle) return null;
    if (!(await ensureMode(handle, "read"))) return null;
    const fromTxt = await readSeqFile(handle);
    const fromPdf = await scanAlbaranesPdfMax(handle);
    const fromEstado = Number((await readFolderEstado(handle))?.lastAlbaran) || 0;
    return Math.max(fromTxt, fromPdf, fromEstado);
  } catch {
    return null;
  }
}

export async function syncAlbaranNumberFromFolder(): Promise<{ next: number; fromFolder: boolean }> {
  try {
    const handle = await loadTallerHandle();
    if (!handle) return { next: peekNextAlbaranNumber(), fromFolder: false };
    if (!(await ensureMode(handle, "read"))) return { next: peekNextAlbaranNumber(), fromFolder: false };
    const fromTxt = await readSeqFile(handle);
    const fromPdf = await scanAlbaranesPdfMax(handle);
    const estado = await readFolderEstado(handle);
    const fromEstado = Number(estado?.lastAlbaran) || 0;
    const last = Math.max(fromTxt, fromPdf, fromEstado);
    const records = Array.isArray(estado?.albaranes) ? estado.albaranes : undefined;
    if (last > 0 || records?.length) {
      restoreAlbaranBackup({
        seq: last > 0 ? { last } : undefined,
        records,
      });
    }
    return { next: peekNextAlbaranNumber(), fromFolder: true };
  } catch {
    return { next: peekNextAlbaranNumber(), fromFolder: false };
  }
}

async function writeSeqFile(dir: FileSystemDirectoryHandle, n: number) {
  const nf = await dir.getFileHandle(SEQ_FILE, { create: true });
  const nw = await nf.createWritable();
  await nw.write(String(Math.max(0, n)));
  await nw.close();
}

export async function commitAlbaranToFolder(file: File, numero: number) {
  try {
    const handle = await loadTallerHandle();
    if (!handle) return false;
    if (!(await ensureMode(handle, "readwrite"))) return false;
    if (numero > 0) {
      try {
        await writeSeqFile(handle, numero);
      } catch {
        /* PDF igual */
      }
    }
    let dir = handle;
    try {
      dir = await handle.getDirectoryHandle(ALBARANES_DIR, { create: true });
    } catch {
      dir = handle;
    }
    const name = numero > 0 ? `Albaran-${numero}.pdf` : file.name;
    const named = name === file.name ? file : new File([file], name, { type: "application/pdf" });
    const ok = await writeFileToDirectory(dir, named);
    if (ok) await writeFolderEstado(handle);
    return ok;
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
