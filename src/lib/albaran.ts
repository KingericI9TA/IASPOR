import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createServerFn } from "@tanstack/react-start";
import { publicUrl, normalize } from "@/lib/utils";

const SEQ_KEY = "puertadocs:albaran-seq";
const HIST_KEY = "puertadocs:albaran-hist";
const DOC_ID = "1RFGJ2SHa7vlP49fnRZ2Zfj91QGGfp0CC";
export const ALBARAN_DOC = `https://docs.google.com/document/d/${DOC_ID}/edit`;

export const ALBARAN_COMPANY = {
  brand: "PUERTAS AUTOMATICAS",
  name: "GRUPO ASPOR S.L.",
  subtitle: 'Servicio Tecnico de "FAAC"',
  phone: "98536 3081",
  fax: "985363940",
  address: "C/ Alarcon, 34 - Bajo   33204 - GIJON",
  web: "www.aspor.net",
  email: "info@aspor.net",
};

export const ALBARAN_TYPES = ["ENVIO", "INSTALACION", "REPARACION", "MANTENIMIENTO"] as const;
export type AlbaranType = (typeof ALBARAN_TYPES)[number];

export type AlbaranDraft = {
  cliente: string;
  direccion: string;
  telefono: string;
  concepto: string;
  cantidad: string;
  importe: string;
  tipo: AlbaranType;
};

export type AlbaranRecord = AlbaranDraft & {
  numero: number;
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
  createdAt: number;
};

const FISCAL_KEY = "puertadocs:fiscal";
const FALLBACK_LAST = 8010;
const WM_KEY = "iaspor:albaran-watermark";
const HIST_MAX = 200;

export type FiscalSettings = {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
};

export const DEFAULT_FISCAL: FiscalSettings = {
  startMonth: 1,
  startDay: 1,
  endMonth: 12,
  endDay: 31,
};

export const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

function daysInMonth(month: number) {
  return [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month] ?? 31;
}

export function clampFiscal(s: FiscalSettings): FiscalSettings {
  const startMonth = Math.min(12, Math.max(1, Math.round(s.startMonth) || 1));
  const endMonth = Math.min(12, Math.max(1, Math.round(s.endMonth) || 12));
  return {
    startMonth,
    startDay: Math.min(daysInMonth(startMonth), Math.max(1, Math.round(s.startDay) || 1)),
    endMonth,
    endDay: Math.min(daysInMonth(endMonth), Math.max(1, Math.round(s.endDay) || 31)),
  };
}

export function loadFiscal(): FiscalSettings {
  try {
    const raw = localStorage.getItem(FISCAL_KEY);
    if (!raw) return { ...DEFAULT_FISCAL };
    const parsed = JSON.parse(raw) as Partial<FiscalSettings>;
    return clampFiscal({
      startMonth: parsed.startMonth ?? 1,
      startDay: parsed.startDay ?? 1,
      endMonth: parsed.endMonth ?? 12,
      endDay: parsed.endDay ?? 31,
    });
  } catch {
    return { ...DEFAULT_FISCAL };
  }
}

export function saveFiscal(s: FiscalSettings) {
  localStorage.setItem(FISCAL_KEY, JSON.stringify(clampFiscal(s)));
}

export function formatMd(month: number, day: number) {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

export function madridParts(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { year: num("year"), month: num("month"), day: num("day") };
}

export function fiscalYearOf(at = new Date(), fiscal = loadFiscal()) {
  const { year, month, day } = madridParts(at);
  const md = month * 100 + day;
  const endMd = fiscal.endMonth * 100 + fiscal.endDay;
  return md <= endMd ? year : year + 1;
}

export function fiscalCloseLabel(fiscal = loadFiscal(), at = new Date()) {
  const fy = fiscalYearOf(at, fiscal);
  return `${formatMd(fiscal.endMonth, fiscal.endDay)}/${fy}`;
}

export function todayAlbaran(at = new Date()) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(at);
}

type AlbaranSeq = { year: number; last: number };

function loadSeq(): AlbaranSeq {
  const year = fiscalYearOf();
  try {
    const raw = localStorage.getItem(SEQ_KEY);
    if (!raw) return { year, last: FALLBACK_LAST };
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "year" in parsed && "last" in parsed) {
      const y = Number((parsed as AlbaranSeq).year);
      const last = Number((parsed as AlbaranSeq).last);
      if (Number.isFinite(y) && Number.isFinite(last)) return { year: y, last };
    }
    const n = Number.parseInt(String(parsed ?? raw), 10);
    if (Number.isFinite(n)) return { year, last: n };
  } catch {
    const n = Number.parseInt(localStorage.getItem(SEQ_KEY) ?? "", 10);
    if (Number.isFinite(n)) return { year, last: n };
  }
  return { year, last: FALLBACK_LAST };
}

function watermark() {
  const n = Number.parseInt(localStorage.getItem(WM_KEY) ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

function bumpWatermark(n: number) {
  if (!Number.isFinite(n) || n < 1) return;
  if (n > watermark()) localStorage.setItem(WM_KEY, String(n));
}

function saveSeq(seq: AlbaranSeq) {
  localStorage.setItem(SEQ_KEY, JSON.stringify(seq));
  bumpWatermark(seq.last);
}

export function currentAlbaranYear() {
  return fiscalYearOf();
}

export function loadLastAlbaranNumber() {
  const year = fiscalYearOf();
  const seq = loadSeq();
  if (year > seq.year) return 0;
  return Math.max(seq.last, watermark());
}

export function peekNextAlbaranNumber() {
  return loadLastAlbaranNumber() + 1;
}

function commitAlbaranNumber(n: number) {
  saveSeq({ year: fiscalYearOf(), last: n });
}

export function adoptDocLastNumber(lastFromDoc: number) {
  const year = fiscalYearOf();
  const seq = loadSeq();
  if (year > seq.year) return peekNextAlbaranNumber();
  if (lastFromDoc > seq.last) saveSeq({ year, last: lastFromDoc });
  return peekNextAlbaranNumber();
}

function mergeRecords(a: AlbaranRecord[], b: AlbaranRecord[]) {
  const map = new Map<number, AlbaranRecord>();
  for (const r of [...a, ...b]) {
    const n = Number(r?.numero);
    if (!Number.isFinite(n) || n < 1) continue;
    const prev = map.get(n);
    if (!prev || (r.createdAt || 0) >= (prev.createdAt || 0)) map.set(n, r);
  }
  return [...map.values()].sort((x, y) => y.numero - x.numero || y.createdAt - x.createdAt).slice(0, HIST_MAX);
}

export function restoreAlbaranBackup(input: {
  seq?: { year?: number; last?: number };
  records?: AlbaranRecord[];
}) {
  const yearNow = fiscalYearOf();
  const incoming = Array.isArray(input.records) ? input.records : [];
  const merged = mergeRecords(loadAlbaranHistory(), incoming);
  if (merged.length) saveHistory(merged);

  const fromHist = merged.reduce((m, r) => Math.max(m, Number(r.numero) || 0), 0);
  const lastIn = Number(input.seq?.last);
  const yearIn = Number(input.seq?.year);
  const current = loadSeq();
  let last = Math.max(
    current.year === yearNow ? current.last : 0,
    watermark(),
    fromHist,
    Number.isFinite(lastIn) ? lastIn : 0,
  );
  if (!Number.isFinite(last) || last < 0) return;

  if (Number.isFinite(yearIn) && yearIn < yearNow && last < 1) {
    saveSeq({ year: yearNow, last: 0 });
    return;
  }
  saveSeq({ year: yearNow, last });
}

export function loadAlbaranHistory(): AlbaranRecord[] {
  try {
    const raw = localStorage.getItem(HIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AlbaranRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, HIST_MAX) : [];
  } catch {
    return [];
  }
}

function saveHistory(records: AlbaranRecord[]) {
  localStorage.setItem(HIST_KEY, JSON.stringify(records.slice(0, HIST_MAX)));
  const maxN = records.reduce((m, r) => Math.max(m, Number(r.numero) || 0), 0);
  bumpWatermark(maxN);
}

export function parseImporte(raw: string) {
  const s = raw.replace(/\s/g, "").replace("€", "").replace(/EUR/i, "");
  const n = s.includes(",")
    ? Number.parseFloat(s.replace(/\./g, "").replace(",", "."))
    : Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseCantidad(raw: string) {
  const n = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function codigoVal(values: Record<string, string>, ...needles: string[]) {
  const entries = Object.entries(values);
  for (const needle of needles) {
    const n = normalize(needle);
    if (!n) continue;
    const exact = entries.find(([k, v]) => v.trim() && normalize(k) === n);
    if (exact) return exact[1].trim();
  }
  for (const needle of needles) {
    const n = normalize(needle);
    if (!n) continue;
    const part = entries.find(([k, v]) => v.trim() && normalize(k).includes(n));
    if (part) return part[1].trim();
  }
  return "";
}

/** Rellena el albarán con una fila de CODIGOS. */
export function draftFromCodigo(values: Record<string, string>): Partial<AlbaranDraft> {
  const cliente = codigoVal(values, "nombre", "cliente", "comunidad", "razon social");
  const calle = codigoVal(values, "direccion", "calle");
  const pob = codigoVal(values, "poblacion", "localidad", "municipio");
  const direccion = [calle, pob].filter(Boolean).join(", ");
  const telefono = codigoVal(values, "telefono", "tel", "movil", "mail", "email", "correo");
  const equipo = codigoVal(values, "equipo instalado", "equipo");
  const ot = codigoVal(values, "ot");
  const concepto = [equipo, ot ? `OT ${ot}` : ""].filter(Boolean).join(" · ");
  return {
    cliente,
    direccion,
    telefono,
    concepto,
    tipo: "REPARACION",
  };
}

const STASH_KEY = "iaspor:albaran-draft";

export function stashAlbaranDraft(partial: Partial<AlbaranDraft>) {
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify(partial));
  } catch {
    /* quota */
  }
}

export function takeAlbaranDraft(): Partial<AlbaranDraft> | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STASH_KEY);
    const p = JSON.parse(raw) as Partial<AlbaranDraft>;
    return p && typeof p === "object" ? p : null;
  } catch {
    return null;
  }
}

export function euro(n: number) {
  return `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 6);
}

async function loadFontBytes(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fuente no disponible: ${path}`);
  return res.arrayBuffer();
}

function centerX(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, pageWidth: number) {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

export async function buildAlbaranPdf(rec: AlbaranRecord) {
  const now = new Date();
  const fecha = todayAlbaran(now);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Albarán ${rec.numero}`);
  pdf.setAuthor(ALBARAN_COMPANY.name);
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  const page = pdf.addPage([595.28, 841.89]);
  let font = await pdf.embedFont(StandardFonts.Helvetica);
  let bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  try {
    const [reg, bld] = await Promise.all([
      loadFontBytes(publicUrl("albaran/Poppins-regular.ttf")),
      loadFontBytes(publicUrl("albaran/Poppins-bold.ttf")),
    ]);
    font = await pdf.embedFont(reg);
    bold = await pdf.embedFont(bld);
  } catch {
    /* Helvetica fallback */
  }

  const { width, height } = page.getSize();
  const ink = rgb(0, 0, 0);
  const line = rgb(0.15, 0.15, 0.15);
  const pale = rgb(0.92, 0.92, 0.92);
  const left = 48;
  const right = width - 48;
  let y = height - 46;

  const drawC = (text: string, size: number, f = font, gap = 13) => {
    page.drawText(text, { x: centerX(text, f, size, width), y, size, font: f, color: ink });
    y -= gap;
  };

  drawC("ASPOR Y COSTALES S.L.", 13, bold, 14);
  drawC('Servicio Técnico de "FAAC"', 10, font, 13);
  drawC(`Tfno.: ${ALBARAN_COMPANY.phone} - Fax: ${ALBARAN_COMPANY.fax}`, 9, font, 12);
  drawC("C/ Alarcón, 34 - Bajo   33204 – GIJON", 9, font, 12);
  drawC(`${ALBARAN_COMPANY.web}   e-mail: ${ALBARAN_COMPANY.email}`, 9, font, 22);

  page.drawText("ALBARAN DE ENTREGA", { x: left + 8, y, size: 13, font: bold, color: ink });
  page.drawText(fecha, { x: right - bold.widthOfTextAtSize(fecha, 11), y, size: 11, font: bold, color: ink });
  y -= 28;

  const box = (x: number, on: boolean) => {
    page.drawRectangle({ x, y: y - 1, width: 10, height: 10, borderColor: ink, borderWidth: 0.8 });
    if (on) page.drawText("X", { x: x + 1.5, y: y, size: 9, font: bold, color: ink });
  };
  box(left + 8, rec.tipo === "ENVIO");
  page.drawText("ENVIO", { x: left + 22, y, size: 9, font, color: ink });
  box(left + 130, rec.tipo === "INSTALACION");
  page.drawText("INSTALACION", { x: left + 144, y, size: 9, font, color: ink });
  page.drawText("Albarán Nº:", { x: 390, y, size: 9, font, color: ink });
  page.drawText(String(rec.numero), { x: 470, y, size: 12, font: bold, color: ink });
  y -= 18;
  box(left + 8, rec.tipo === "REPARACION");
  page.drawText("REPARACION", { x: left + 22, y, size: 9, font, color: ink });
  box(left + 130, rec.tipo === "MANTENIMIENTO");
  page.drawText("MANTENIMIENTO", { x: left + 144, y, size: 9, font, color: ink });
  page.drawText("O.T. Nº:", { x: 390, y, size: 9, font, color: ink });
  y -= 28;

  page.drawText("CLIENTE:", { x: left, y, size: 9, font: bold, color: ink });
  page.drawText(rec.cliente.slice(0, 58), { x: left + 62, y, size: 11, font, color: ink });
  y -= 16;
  page.drawLine({ start: { x: left + 62, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 0.4, color: line });
  y -= 6;
  page.drawText("DIRECCION:", { x: left, y, size: 9, font: bold, color: ink });
  const addr = wrap(rec.direccion || "", font, 10, 400);
  addr.forEach((ln, i) => {
    page.drawText(ln, { x: left + 72, y: y - i * 12, size: 10, font, color: ink });
  });
  y -= Math.max(16, addr.length * 12) + 4;
  page.drawLine({ start: { x: left + 72, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 0.4, color: line });
  y -= 6;
  page.drawText("TEL/MAIL:", { x: left, y, size: 9, font: bold, color: ink });
  const contact = wrap(rec.telefono || "", font, 10, 390);
  contact.forEach((ln, i) => {
    page.drawText(ln, { x: left + 72, y: y - i * 12, size: 10, font, color: ink });
  });
  y -= Math.max(16, contact.length * 12) + 4;
  page.drawLine({ start: { x: left + 72, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 0.4, color: line });
  y -= 14;

  const cols = [
    { x: left, w: 62, h: "CODIGO" },
    { x: left + 62, w: 248, h: "CONCEPTO" },
    { x: left + 310, w: 42, h: "UND" },
    { x: left + 352, w: 80, h: "PRECIO UND" },
    { x: left + 432, w: 67, h: "DCTO" },
  ];
  const tableW = 499;
  const headerH = 18;
  page.drawRectangle({ x: left, y: y - headerH, width: tableW, height: headerH, borderColor: line, borderWidth: 0.7, color: pale });
  for (const c of cols) {
    page.drawText(c.h, { x: c.x + 4, y: y - 13, size: 8, font: bold, color: ink });
  }
  y -= headerH;

  const conceptLines = wrap(rec.concepto, font, 9, 236);
  const rowH = Math.max(22, 8 + conceptLines.length * 11);
  const drawRow = (vals: string[], h: number, last = false) => {
    page.drawRectangle({
      x: left,
      y: y - h,
      width: tableW,
      height: h,
      borderColor: line,
      borderWidth: 0.5,
    });
    let cx = left;
    const widths = cols.map((c) => c.w);
    vals.forEach((val, i) => {
      if (i > 0) page.drawLine({ start: { x: cx, y }, end: { x: cx, y: y - h }, thickness: 0.4, color: line });
      const lines = val.split("\n");
      lines.forEach((ln, li) => {
        page.drawText(ln, { x: cx + 4, y: y - 13 - li * 11, size: 9, font, color: ink });
      });
      cx += widths[i];
    });
    y -= h;
    if (last) return;
  };

  drawRow(["", conceptLines.join("\n"), String(rec.cantidad), euro(parseImporte(rec.importe)).replace(" EUR", " €"), ""], rowH);
  for (let i = 0; i < 5; i++) drawRow(["", "", "", "", ""], 18);

  drawRow(["", "Subtotal", "1", euro(rec.subtotal).replace(" EUR", " €"), ""], 18);
  drawRow(["", "IVA 21%", "1", euro(rec.iva).replace(" EUR", " €"), ""], 18);
  page.drawRectangle({ x: left, y: y - 20, width: tableW, height: 20, borderColor: line, borderWidth: 0.7, color: pale });
  page.drawText("Total", { x: left + 66, y: y - 14, size: 10, font: bold, color: ink });
  page.drawText("1", { x: left + 314, y: y - 14, size: 10, font: bold, color: ink });
  page.drawText(euro(rec.total).replace(" EUR", " €"), { x: left + 356, y: y - 14, size: 10, font: bold, color: ink });
  y -= 36;

  y = Math.min(y, 130);
  page.drawText("Fecha de entrega:", { x: left, y, size: 9, font, color: ink });
  page.drawLine({ start: { x: left + 95, y: y - 1 }, end: { x: 210, y: y - 1 }, thickness: 0.4, color: line });
  page.drawText(fecha, { x: left + 98, y, size: 9, font, color: ink });
  page.drawText("Realizado por:", { x: 230, y, size: 9, font, color: ink });
  page.drawLine({ start: { x: 310, y: y - 1 }, end: { x: 410, y: y - 1 }, thickness: 0.4, color: line });
  page.drawText("Horario:", { x: 430, y, size: 9, font, color: ink });
  page.drawLine({ start: { x: 476, y: y - 1 }, end: { x: right, y: y - 1 }, thickness: 0.4, color: line });
  y -= 36;
  page.drawText(`Por ${ALBARAN_COMPANY.name}`, { x: left, y, size: 9, font: bold, color: ink });
  page.drawText("Conforme el cliente", { x: 320, y, size: 9, font, color: ink });
  y -= 16;
  page.drawText("Fdo.:", { x: 320, y, size: 9, font, color: ink });
  page.drawLine({ start: { x: 348, y: y - 1 }, end: { x: 520, y: y - 1 }, thickness: 0.4, color: line });

  return { bytes: await pdf.save(), fecha };
}

export async function issueAlbaran(draft: AlbaranDraft) {
  const cantidad = parseCantidad(draft.cantidad);
  const precio = parseImporte(draft.importe);
  const subtotal = Math.round(cantidad * precio * 100) / 100;
  const iva = Math.round(subtotal * 0.21 * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;
  const numero = peekNextAlbaranNumber();
  const rec: AlbaranRecord = {
    ...draft,
    cliente: draft.cliente.trim(),
    direccion: draft.direccion.trim(),
    telefono: draft.telefono.trim(),
    concepto: draft.concepto.trim(),
    cantidad: String(cantidad),
    importe: String(precio),
    numero,
    fecha: todayAlbaran(),
    subtotal,
    iva,
    total,
    createdAt: Date.now(),
  };
  const { bytes, fecha } = await buildAlbaranPdf(rec);
  rec.fecha = fecha;
  rec.createdAt = Date.now();
  commitAlbaranNumber(numero);
  saveHistory([rec, ...loadAlbaranHistory()]);
  return { rec, bytes };
}

export const analyzeAlbaranTemplate = createServerFn({ method: "POST" }).handler(async () => {
  const apiKey = process.env.XAI_API_KEY;
  let text = "";
  try {
    const res = await fetch(`https://docs.google.com/document/d/${DOC_ID}/export?format=txt`, {
      headers: { "User-Agent": "ASPOR-IA/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) text = (await res.text()).slice(0, 8000);
  } catch {
    /* use fallback */
  }
  const nums = [...text.matchAll(/Albar[aá]n\s*N[ºo°.:]*\s*(\d+)/gi)].map((m) => Number.parseInt(m[1], 10));
  const scanned = nums.filter((n) => Number.isFinite(n));
  const lastFromDoc = scanned.length ? Math.max(...scanned) : FALLBACK_LAST;

  if (!apiKey || !text) {
    return {
      ok: true as const,
      lastFromDoc,
      summary:
        "Plantilla ASPOR, S.L. (Servicio Tecnico FAAC, Gijon). Albaran de entrega con cliente, direccion, telefono, concepto, unidades e importe.",
    };
  }

  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0,
        max_tokens: 280,
        messages: [
          {
            role: "system",
            content:
              "Resume en 2 frases en espanol la plantilla de albaran. Incluye empresa y el numero de albaran mas alto. Sin markdown.",
          },
          { role: "user", content: text.slice(0, 3500) },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: true as const, lastFromDoc, summary: "Plantilla ASPOR, S.L. lista para rellenar." };
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const summary = body.choices?.[0]?.message?.content?.trim() || "Plantilla ASPOR lista.";
    return { ok: true as const, lastFromDoc, summary: summary.slice(0, 400) };
  } catch {
    return { ok: true as const, lastFromDoc, summary: "Plantilla ASPOR, S.L. lista para rellenar." };
  }
});
