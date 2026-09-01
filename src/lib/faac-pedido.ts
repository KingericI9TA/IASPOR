import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createServerFn } from "@tanstack/react-start";
import { ALBARAN_COMPANY } from "@/lib/albaran";
import { publicUrl } from "@/lib/utils";

export const PEDIDO_KEEP_ID = "1-PmtUUoeE770a5dxUecFnXy6kcQx785w";
export const PEDIDO_KEEP_VIEW = `https://drive.google.com/file/d/${PEDIDO_KEEP_ID}/view?usp=drivesdk`;

const KEY = "iaspor:faac-pedido";
const DEST_KEY = "iaspor:faac-pedido-dest";
const SEQ_KEY = "iaspor:faac-pedido-seq";
const SENT_KEY = "iaspor:faac-pedido-sent";

export type PedidoItem = {
  id: string;
  code: string;
  name: string;
  qty: number;
};

export type PedidoDest = {
  whatsapp: string;
  email: string;
};

export type PedidoSent = {
  at: number;
  numero: number;
  count: number;
  via: "whatsapp" | "email" | "pdf" | "keep";
};

function uid() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function parsePedidoText(text: string): PedidoItem[] {
  const items: PedidoItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^\(?\s*([A-Z0-9./-]{3,})\s*\)?\s+(.+?)(?:\s+x(\d+))?$/i);
    if (m) {
      items.push({
        id: uid(),
        code: m[1].trim(),
        name: m[2].trim(),
        qty: Math.max(1, Number(m[3] || 1)),
      });
      continue;
    }
    items.push({ id: uid(), code: "", name: line, qty: 1 });
  }
  return items;
}

export function formatPedidoText(items: PedidoItem[]) {
  return items
    .map((i) => {
      const head = i.code ? `(${i.code}) ${i.name}` : i.name;
      return i.qty > 1 ? `${head} x${i.qty}` : head;
    })
    .join("\n");
}

export function pedidoFecha(d = new Date()) {
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function totalPiezas(items: PedidoItem[]) {
  return items.reduce((n, i) => n + i.qty, 0);
}

export function formatPedidoShareText(items: PedidoItem[], numero: number, fecha = pedidoFecha()) {
  const co = ALBARAN_COMPANY;
  const lines = items.map((i) => {
    const code = (i.code || "—").padEnd(12, " ");
    const qty = String(i.qty).padStart(3, " ");
    return `${code}  ${qty}  ${i.name}`;
  });
  return [
    `${co.name} — Servicio técnico FAAC`,
    `Pedido material FAAC nº ${numero} · ${fecha}`,
    `${co.phone} · ${co.email}`,
    "",
    "CÓDIGO        UDS  MATERIAL",
    ...lines,
    "",
    `Total líneas: ${items.length} · Total uds: ${totalPiezas(items)}`,
    "",
    "Pedido generado con IASPOR.",
  ].join("\n");
}

export function loadPedido(): PedidoItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PedidoItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((i) => i && i.name).map((i) => ({
      id: i.id || uid(),
      code: String(i.code || "").trim(),
      name: String(i.name).trim().slice(0, 160),
      qty: Math.max(1, Number(i.qty) || 1),
    }));
  } catch {
    return [];
  }
}

export function savePedido(items: PedidoItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 80)));
}

export function loadDest(): PedidoDest {
  try {
    const raw = localStorage.getItem(DEST_KEY);
    if (!raw) return { whatsapp: "", email: "" };
    const p = JSON.parse(raw) as PedidoDest;
    return { whatsapp: String(p.whatsapp || ""), email: String(p.email || "") };
  } catch {
    return { whatsapp: "", email: "" };
  }
}

export function saveDest(dest: PedidoDest) {
  localStorage.setItem(DEST_KEY, JSON.stringify(dest));
}

export function peekPedidoNumero() {
  try {
    const n = Number(localStorage.getItem(SEQ_KEY) || "0");
    return (Number.isFinite(n) ? n : 0) + 1;
  } catch {
    return 1;
  }
}

export function takePedidoNumero() {
  const n = peekPedidoNumero();
  localStorage.setItem(SEQ_KEY, String(n));
  return n;
}

export function loadSent(): PedidoSent[] {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as PedidoSent[];
    return Array.isArray(p) ? p.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function recordSent(via: PedidoSent["via"], numero: number, count: number) {
  const next: PedidoSent[] = [{ at: Date.now(), numero, count, via }, ...loadSent()].slice(0, 12);
  localStorage.setItem(SENT_KEY, JSON.stringify(next));
  return next;
}

export function addPedidoItem(list: PedidoItem[], input: { code: string; name: string; qty?: number }): PedidoItem[] {
  const code = input.code.trim();
  const name = input.name.trim().slice(0, 160);
  const qty = Math.max(1, input.qty ?? 1);
  if (!name && !code) return list;
  const match = list.find((i) =>
    code ? i.code.toLowerCase() === code.toLowerCase() : i.name.toLowerCase() === name.toLowerCase(),
  );
  if (match) {
    return list.map((i) => (i.id === match.id ? { ...i, qty: i.qty + qty } : i));
  }
  return [...list, { id: uid(), code, name: name || code, qty }];
}

export function mergeKeepItems(local: PedidoItem[], keep: PedidoItem[]) {
  let next = [...local];
  for (const item of keep) {
    const exists = next.some((i) =>
      item.code
        ? i.code.toLowerCase() === item.code.toLowerCase()
        : i.name.toLowerCase() === item.name.toLowerCase(),
    );
    if (!exists) next = [...next, { ...item, id: uid() }];
  }
  return next;
}

export function digitsPhone(raw: string) {
  const d = raw.replace(/\D+/g, "");
  if (d.length === 9) return `34${d}`;
  return d;
}

export function whatsappHref(phone: string, text: string) {
  const n = digitsPhone(phone);
  const q = encodeURIComponent(text);
  return n ? `https://wa.me/${n}?text=${q}` : `https://wa.me/?text=${q}`;
}

export function mailtoHref(email: string, subject: string, body: string) {
  const to = email.trim();
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function embedPedidoFonts(pdf: PDFDocument) {
  let font = await pdf.embedFont(StandardFonts.Helvetica);
  let bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  try {
    const [reg, bld] = await Promise.all([
      fetch(publicUrl("albaran/Poppins-regular.ttf")).then((r) => r.arrayBuffer()),
      fetch(publicUrl("albaran/Poppins-bold.ttf")).then((r) => r.arrayBuffer()),
    ]);
    font = await pdf.embedFont(reg);
    bold = await pdf.embedFont(bld);
  } catch {
    /* Helvetica */
  }
  return { font, bold };
}

export async function buildPedidoPdf(items: PedidoItem[], numero: number, fecha = pedidoFecha()) {
  const pdf = await PDFDocument.create();
  const co = ALBARAN_COMPANY;
  pdf.setTitle(`Pedido FAAC ${numero}`);
  pdf.setAuthor(co.name);
  const page = pdf.addPage([595.28, 841.89]);
  const { font, bold } = await embedPedidoFonts(pdf);
  const ink = rgb(0.05, 0.08, 0.12);
  const muted = rgb(0.35, 0.4, 0.45);
  const line = rgb(0.75, 0.8, 0.85);
  const left = 48;
  const right = 547;
  let y = 792;

  const write = (t: string, x: number, size: number, f = font, c = ink) => {
    page.drawText(t, { x, y, size, font: f, color: c });
  };

  write(co.name, left, 14, bold);
  write("Pedido material FAAC", left, 10, font, muted);
  y -= 18;
  write(`Tfno. ${co.phone}  ·  ${co.email}`, left, 9, font, muted);
  y -= 28;
  write(`PEDIDO Nº ${numero}`, left, 16, bold);
  write(fecha, right - bold.widthOfTextAtSize(fecha, 11), 11, bold);
  y -= 22;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 18;
  write("CÓDIGO", left, 8, bold, muted);
  write("UDS", 150, 8, bold, muted);
  write("MATERIAL", 190, 8, bold, muted);
  y -= 14;
  page.drawLine({ start: { x: left, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 0.5, color: line });

  for (const item of items) {
    if (y < 70) break;
    write((item.code || "—").slice(0, 16), left, 10, bold);
    write(String(item.qty), 150, 10, font);
    write(item.name.slice(0, 52), 190, 10, font);
    y -= 16;
  }

  y -= 8;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: line });
  y -= 18;
  write(`Líneas: ${items.length}    Unidades: ${totalPiezas(items)}`, left, 11, bold);
  y -= 28;
  write("Generado con IASPOR · by Jan", left, 8, font, muted);
  write("Pegar también en la nota Keep Pedir FAAC si aplica.", left, 8, font, muted);

  return pdf.save();
}

export const fetchPedidoKeep = createServerFn({ method: "POST" }).handler(async () => {
  const res = await fetch(
    `https://drive.usercontent.google.com/download?id=${PEDIDO_KEEP_ID}&export=download&confirm=t`,
    {
      headers: { "User-Agent": "IASPOR/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!res.ok) {
    return { ok: false as const, error: `No se pudo leer la nota (${res.status})` };
  }
  const text = (await res.text()).trim();
  if (!text) return { ok: false as const, error: "La nota de Keep está vacía." };
  return { ok: true as const, text, items: parsePedidoText(text) };
});
