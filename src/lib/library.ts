import { detectBrandFromText } from "./brands";
import { normalize } from "./utils";
import type { DocKind } from "./office-text";

const DB_NAME = "puertadocs";
const DB_VER = 1;

export type LibraryDoc = {
  id: string;
  name: string;
  brandId?: string;
  size: number;
  addedAt: number;
  text: string;
  favorite: boolean;
  kind?: DocKind;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("blobs")) {
        db.createObjectStore("blobs");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listLibrary(): Promise<LibraryDoc[]> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const all = await reqToPromise(tx.objectStore("meta").getAll() as IDBRequest<LibraryDoc[]>);
  return (all ?? []).sort((a, b) => b.addedAt - a.addedAt);
}

export async function getBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  const tx = db.transaction("blobs", "readonly");
  return reqToPromise(tx.objectStore("blobs").get(id) as IDBRequest<Blob | undefined>);
}

export function libraryKey(name: string, size: number) {
  return `${name.toLowerCase()}|${size}`;
}

export async function savePdf(file: File, text: string, kind: DocKind = "pdf"): Promise<LibraryDoc> {
  const name = file.name.replace(/\.(pdf|docx|xlsx|xlsm|csv|tsv|txt)$/i, "");
  const id = crypto.randomUUID();
  const brand = detectBrandFromText(`${file.name} ${text.slice(0, 4000)}`);
  const doc: LibraryDoc = {
    id,
    name,
    brandId: brand?.id,
    size: file.size,
    addedAt: Date.now(),
    text: text.slice(0, 80_000),
    favorite: false,
    kind,
  };
  const typed =
    kind === "pdf" && file.type !== "application/pdf"
      ? new File([file], file.name, { type: "application/pdf" })
      : file;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["meta", "blobs"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("meta").put(doc);
    tx.objectStore("blobs").put(typed, id);
  });
  return doc;
}

export async function toggleFavorite(id: string): Promise<LibraryDoc | undefined> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  const store = tx.objectStore("meta");
  const doc = await reqToPromise(store.get(id) as IDBRequest<LibraryDoc | undefined>);
  if (!doc) return undefined;
  doc.favorite = !doc.favorite;
  store.put(doc);
  return doc;
}

export async function removeDoc(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["meta", "blobs"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore("meta").delete(id);
    tx.objectStore("blobs").delete(id);
  });
}

export function searchLibrary(docs: LibraryDoc[], query: string): LibraryDoc[] {
  const q = normalize(query);
  if (!q) return docs;
  const parts = q.split(" ").filter(Boolean);
  return docs
    .map((d) => {
      const hay = normalize(`${d.name} ${d.brandId ?? ""} ${d.text.slice(0, 40_000)}`);
      const hits = parts.filter((p) => hay.includes(p)).length;
      return { d, hits };
    })
    .filter((x) => x.hits === parts.length)
    .sort((a, b) => b.hits - a.hits)
    .map((x) => x.d);
}
