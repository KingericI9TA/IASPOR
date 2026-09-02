import { loadAlbaranHistory, loadLastAlbaranNumber, currentAlbaranYear, restoreAlbaranBackup, peekNextAlbaranNumber, type AlbaranRecord } from "@/lib/albaran";
import { loadDest, loadPedido, saveDest, savePedido, type PedidoItem } from "@/lib/faac-pedido";
import { listLibrary, getBlob, savePdf } from "@/lib/library";
import { unzipStore, zipStore } from "@/lib/zip-store";

const META = "iaspor.json";
const APP = "IASPOR";
const DEVICE_KEY = "iaspor:device";

export type IasporEstado = {
  app?: string;
  device?: string;
  v: number;
  at: number;
  pedido: PedidoItem[];
  dest: { whatsapp: string; email: string };
  albaranSeq: { year: number; last: number };
  lastAlbaran: number;
  albaranes: AlbaranRecord[];
  recents: string[];
};

export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function isEstadoShape(p: Partial<IasporEstado>) {
  if (p.v !== 1 && p.v !== 2) return false;
  if (p.pedido && !Array.isArray(p.pedido)) return false;
  if (p.albaranes && !Array.isArray(p.albaranes)) return false;
  if (p.dest && (typeof p.dest !== "object" || Array.isArray(p.dest))) return false;
  if (p.app && p.app !== APP) return false;
  return true;
}

export function isTrustedEstado(p: Partial<IasporEstado> | null | undefined): p is Partial<IasporEstado> {
  return !!p && isEstadoShape(p);
}

export function estadoNeedsConfirm(p: Partial<IasporEstado>) {
  if (p.app !== APP) return true;
  if (p.device && p.device !== deviceId()) return true;
  return false;
}

export function buildEstado(): IasporEstado {
  const last = loadLastAlbaranNumber();
  let recents: string[] = [];
  try {
    recents = JSON.parse(localStorage.getItem("puertadocs:recents") || "[]") as string[];
  } catch {
    recents = [];
  }
  return {
    app: APP,
    device: deviceId(),
    v: 2,
    at: Date.now(),
    pedido: loadPedido(),
    dest: loadDest(),
    albaranSeq: { year: currentAlbaranYear(), last },
    lastAlbaran: last,
    albaranes: loadAlbaranHistory(),
    recents: Array.isArray(recents) ? recents.slice(0, 12) : [],
  };
}

export function applyEstado(
  p: Partial<IasporEstado> | null | undefined,
  opts?: { confirm?: boolean },
) {
  if (!isTrustedEstado(p)) return false;
  if (opts?.confirm === false && estadoNeedsConfirm(p)) return false;
  if (opts?.confirm !== false && estadoNeedsConfirm(p)) {
    if (typeof window === "undefined") return false;
    if (!window.confirm("Esta carpeta trae pedido y albaranes. ¿Ponerlos en este teléfono?")) {
      return false;
    }
  }
  let used = false;
  if (Array.isArray(p.pedido)) {
    savePedido(p.pedido);
    used = true;
  }
  if (p.dest) {
    saveDest({ whatsapp: p.dest.whatsapp ?? "", email: p.dest.email ?? "" });
    used = true;
  }
  if (Array.isArray(p.recents)) {
    localStorage.setItem("puertadocs:recents", JSON.stringify(p.recents.slice(0, 12)));
    used = true;
  }
  if (p.albaranSeq || p.albaranes || Number.isFinite(Number(p.lastAlbaran))) {
    restoreAlbaranBackup({
      seq: p.albaranSeq ?? (Number.isFinite(Number(p.lastAlbaran)) ? { last: Number(p.lastAlbaran) } : undefined),
      records: Array.isArray(p.albaranes) ? p.albaranes : undefined,
    });
    used = true;
  }
  return used;
}

export async function exportTallerZip() {
  const enc = new TextEncoder();
  const meta = buildEstado();
  const files: { name: string; data: Uint8Array }[] = [
    { name: META, data: enc.encode(JSON.stringify(meta)) },
  ];
  const docs = await listLibrary();
  for (const doc of docs.slice(0, 80)) {
    const blob = await getBlob(doc.id);
    if (!blob) continue;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const safe = `${doc.name.replace(/[^\w.-]+/g, "_").slice(0, 80)}.pdf`;
    files.push({ name: `pdf/${safe}`, data: buf });
  }
  return zipStore(files);
}

export function zipFileName(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `IASPOR-taller-${y}-${m}-${day}.zip`;
}

export async function downloadTallerZip() {
  const blob = await exportTallerZip();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipFileName();
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return a.download;
}

export async function importTallerZip(file: Blob) {
  const entries = unzipStore(await file.arrayBuffer());
  let pdfs = 0;
  let meta = false;
  const dec = new TextDecoder();
  for (const e of entries) {
    if (e.name === META) {
      try {
        const p = JSON.parse(dec.decode(e.data)) as Partial<IasporEstado>;
        if (applyEstado(p, { confirm: true })) meta = true;
      } catch {
        /* ignore */
      }
      continue;
    }
    if (/\.pdf$/i.test(e.name)) {
      const name = e.name.split("/").pop() || "manual.pdf";
      const blob = new File([e.data as BlobPart], name, { type: "application/pdf" });
      await savePdf(blob, "");
      pdfs += 1;
    }
  }
  return { pdfs, meta, nextAlbaran: peekNextAlbaranNumber() };
}
