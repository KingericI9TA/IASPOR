import { loadAlbaranHistory, loadLastAlbaranNumber, currentAlbaranYear, restoreAlbaranBackup, peekNextAlbaranNumber, type AlbaranRecord } from "@/lib/albaran";
import { loadDest, loadPedido, saveDest, savePedido, type PedidoItem } from "@/lib/faac-pedido";
import { listLibrary, getBlob, savePdf } from "@/lib/library";
import { unzipStore, zipStore } from "@/lib/zip-store";

const META = "iaspor.json";

export type IasporEstado = {
  v: number;
  at: number;
  pedido: PedidoItem[];
  dest: { whatsapp: string; email: string };
  albaranSeq: { year: number; last: number };
  lastAlbaran: number;
  albaranes: AlbaranRecord[];
  recents: string[];
};

export function buildEstado(): IasporEstado {
  const last = loadLastAlbaranNumber();
  let recents: string[] = [];
  try {
    recents = JSON.parse(localStorage.getItem("puertadocs:recents") || "[]") as string[];
  } catch {
    recents = [];
  }
  return {
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

export function applyEstado(p: Partial<IasporEstado> | null | undefined) {
  if (!p) return false;
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
        if (applyEstado(p)) meta = true;
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
