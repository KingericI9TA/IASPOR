import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { createServerFn } from "@tanstack/react-start";
import { ALBARAN_COMPANY, euro, parseCantidad, parseImporte, todayAlbaran } from "./albaran";
import { publicUrl } from "./utils";

export const PRE_FOLDER_ID = "13IblvhEX6yMXJKPbyb43R886fOf7w002";
export const PRE_FOLDER_URL = `https://drive.google.com/drive/folders/${PRE_FOLDER_ID}?usp=drive_link`;
export const COVER_NAME = "Presupuesto caratula";
const FILES_CACHE = "iaspor:pre-files";

export type DriveItem = {
  id: string;
  name: string;
  mime?: string;
  path?: string;
};

export type CoverInfo = {
  ok: true;
  files: DriveItem[];
  cover?: DriveItem;
  coverText: string;
  sampleAfter: string;
  summary: string;
  shared: boolean;
  foldersOpened: number;
};

export type TipoPreview = {
  ok: true;
  file: DriveItem;
  text: string;
  image?: { mime: string; b64: string };
  images: { mime: string; b64: string }[];
  sourcePdf?: string;
  cantidadesHint: string;
  totalHint: string;
};

export function cachePreFiles(files: DriveItem[]) {
  try {
    localStorage.setItem(FILES_CACHE, JSON.stringify({ at: Date.now(), files: files.slice(0, 800) }));
  } catch {
    /* quota */
  }
}

export function loadCachedPreFiles(): DriveItem[] {
  try {
    const raw = localStorage.getItem(FILES_CACHE);
    if (!raw) return [];
    const p = JSON.parse(raw) as { files?: DriveItem[] };
    return Array.isArray(p.files) ? p.files : [];
  } catch {
    return [];
  }
}

export function localTipoPreview(tipo: string): TipoPreview {
  const name = tipo.trim() || "Presupuesto";
  const tpl = matchLocalTipo(name);
  if (tpl) {
    return {
      ok: true,
      file: { id: tpl.id, name: tpl.name },
      text: tpl.body,
      images: [],
      cantidadesHint: tpl.lines[0]?.desc ?? "",
      totalHint: "",
    };
  }
  return {
    ok: true,
    file: { id: "local", name },
    text: "",
    images: [],
    cantidadesHint: "",
    totalHint: "",
  };
}

export type LocalTipo = {
  id: string;
  name: string;
  body: string;
  lines: { qty: string; desc: string; amount: string }[];
};

export const LOCAL_TIPOS: LocalTipo[] = [
  {
    id: "batiente",
    name: "Cancela batiente",
    body: "Suministro e instalación de automatismo para cancela batiente, incluyendo operadores, central, fotocélulas, lámpara y mandos. Presupuesto supeditado a vista de obra.",
    lines: [
      { qty: "1", desc: "Kit motor batiente (operadores + central)", amount: "" },
      { qty: "1", desc: "Par de fotocélulas + lámpara destellante", amount: "" },
      { qty: "2", desc: "Mandos", amount: "" },
      { qty: "1", desc: "Mano de obra e instalación", amount: "" },
    ],
  },
  {
    id: "corredera",
    name: "Cancela corredera",
    body: "Suministro e instalación de motor para cancela corredera, cremallera, central, fotocélulas y mandos. Presupuesto supeditado a vista de obra.",
    lines: [
      { qty: "1", desc: "Motor corredera + central", amount: "" },
      { qty: "4", desc: "Cremallera (m)", amount: "" },
      { qty: "1", desc: "Par de fotocélulas + lámpara", amount: "" },
      { qty: "2", desc: "Mandos", amount: "" },
      { qty: "1", desc: "Mano de obra e instalación", amount: "" },
    ],
  },
  {
    id: "seccional",
    name: "Puerta seccional / garaje",
    body: "Suministro e instalación de motor de techo para puerta seccional, raíl, mandos y fotocélulas si procede.",
    lines: [
      { qty: "1", desc: "Motor de techo + raíl", amount: "" },
      { qty: "2", desc: "Mandos", amount: "" },
      { qty: "1", desc: "Mano de obra e instalación", amount: "" },
    ],
  },
  {
    id: "barrera",
    name: "Barrera",
    body: "Suministro e instalación de barrera automática, brazo, loop o fotocélulas y semáforo si procede.",
    lines: [
      { qty: "1", desc: "Barrera + brazo", amount: "" },
      { qty: "1", desc: "Accesorios de seguridad", amount: "" },
      { qty: "1", desc: "Mano de obra e instalación", amount: "" },
    ],
  },
  {
    id: "videoportero",
    name: "Videoportero / acceso",
    body: "Suministro e instalación de videoportero o control de acceso (placa, monitor, cerradero).",
    lines: [
      { qty: "1", desc: "Placa de calle", amount: "" },
      { qty: "1", desc: "Monitor / terminal", amount: "" },
      { qty: "1", desc: "Cerradero / electroimán", amount: "" },
      { qty: "1", desc: "Mano de obra e instalación", amount: "" },
    ],
  },
  {
    id: "mantenimiento",
    name: "Mantenimiento anual",
    body: "Contrato de mantenimiento: revisión de operadores, central, fotocélulas, mandos y engrase. Una visita anual salvo aviso contrario.",
    lines: [{ qty: "1", desc: "Mantenimiento anual de automatismo", amount: "" }],
  },
  {
    id: "recambios",
    name: "Recambios / reparación",
    body: "Suministro de recambios e intervención de reparación. Detallar códigos FAAC en las líneas.",
    lines: [
      { qty: "1", desc: "Recambio (código / descripción)", amount: "" },
      { qty: "1", desc: "Mano de obra", amount: "" },
    ],
  },
];

export function matchLocalTipo(q: string): LocalTipo | undefined {
  const n = norm(q);
  if (!n) return undefined;
  return LOCAL_TIPOS.find(
    (t) => n.includes(norm(t.name)) || norm(t.name).includes(n) || n === t.id || n.includes(t.id),
  );
}

const PRE_HIST = "iaspor:pre-hist";
const PRE_SEQ = "iaspor:pre-seq";

export type PresupuestoRecord = {
  numero: number;
  at: number;
  cliente: string;
  concepto: string;
  total: number;
};

export function peekPresupuestoNumero() {
  const n = Number(localStorage.getItem(PRE_SEQ) || "0");
  return (Number.isFinite(n) ? n : 0) + 1;
}

export function takePresupuestoNumero() {
  const n = peekPresupuestoNumero();
  localStorage.setItem(PRE_SEQ, String(n));
  return n;
}

export function loadPresupuestoHistory(): PresupuestoRecord[] {
  try {
    const raw = localStorage.getItem(PRE_HIST);
    if (!raw) return [];
    const p = JSON.parse(raw) as PresupuestoRecord[];
    return Array.isArray(p) ? p.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function recordPresupuesto(rec: Omit<PresupuestoRecord, "numero" | "at"> & { numero?: number }) {
  const numero = rec.numero ?? takePresupuestoNumero();
  const row: PresupuestoRecord = { numero, at: Date.now(), cliente: rec.cliente, concepto: rec.concepto, total: rec.total };
  localStorage.setItem(PRE_HIST, JSON.stringify([row, ...loadPresupuestoHistory()].slice(0, 20)));
  return row;
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(docx|doc|pdf|odt)$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function decodeJs(s: string) {
  return s
    .replace(/\\u0027/g, "'")
    .replace(/\\u0022/g, '"')
    .replace(/\\u003d/g, "=")
    .replace(/\\x27/g, "'")
    .replace(/\\\//g, "/")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"');
}

type DriveEntry = { id: string; name: string; folder: boolean };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function parseDriveHtml(html: string): DriveEntry[] {
  const map = new Map<string, DriveEntry>();
  const re = /id="entry-([\w-]+)"([\s\S]{0,1600}?class="flip-entry-title">([^<]{1,180}))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1];
    const chunk = m[2];
    const name = decodeJs(m[3] ?? "").replace(/\\/g, "").trim();
    if (!id || id.length < 20 || id === PRE_FOLDER_ID || !name || name === id || name.length > 180) continue;
    const href = (chunk.match(/href="([^"]+)"/) ?? [])[1] ?? "";
    const folder = /\/folders\//.test(href);
    const prev = map.get(id);
    if (prev && prev.name.length >= name.length) continue;
    map.set(id, { id, name, folder });
  }
  return [...map.values()];
}

function isYearOrMonthFolder(name: string) {
  const n = name.trim();
  return (
    /^(20\d{2})$/.test(n) ||
    /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(n) ||
    /^(ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)[.\s-]?\s*\d{2,4}$/i.test(n) ||
    /\b20\d{2}\b/.test(n) ||
    /\b(0?[9]|1[0-9]|2[0-6])$/.test(n)
  );
}

async function fetchEmbedded(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (/accounts\.google\.com\/v3\/signin/.test(res.url) || /ServiceLogin/.test(html.slice(0, 1500))) return null;
    return html;
  } catch {
    return null;
  }
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const cur = items[i++];
      if (cur === undefined) break;
      out.push(await fn(cur));
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()));
  return out;
}

type CrawlResult = { files: DriveItem[]; shared: boolean; foldersOpened: number };

let crawlCache: { at: number; result: CrawlResult } | null = null;
const CRAWL_TTL = 45 * 60_000;

async function crawlPresupuestos(): Promise<CrawlResult> {
  if (crawlCache && Date.now() - crawlCache.at < CRAWL_TTL) return crawlCache.result;

  const rootHtml = await fetchEmbedded(PRE_FOLDER_ID);
  if (!rootHtml) {
    const empty = { files: [] as DriveItem[], shared: false, foldersOpened: 0 };
    return empty;
  }

  const files: DriveItem[] = [];
  const seenFile = new Set<string>();
  const seenFolder = new Set<string>([PRE_FOLDER_ID]);

  const take = (entries: DriveEntry[], path: string) => {
    const folders: { id: string; name: string; path: string }[] = [];
    for (const e of entries) {
      if (e.folder) {
        folders.push({ id: e.id, name: e.name, path: path ? `${path} / ${e.name}` : e.name });
      } else if (!seenFile.has(e.id)) {
        seenFile.add(e.id);
        files.push({ id: e.id, name: e.name, path: path || undefined });
      }
    }
    return folders;
  };

  let queue = take(parseDriveHtml(rootHtml), "");
  let foldersOpened = 0;
  let depth = 0;

  while (queue.length && depth < 3 && foldersOpened < 280) {
    const batch = queue.filter((f) => !seenFolder.has(f.id));
    for (const f of batch) seenFolder.add(f.id);
    queue = [];
    const next: { id: string; name: string; path: string }[] = [];
    await mapPool(batch, 10, async (folder) => {
      foldersOpened += 1;
      const html = await fetchEmbedded(folder.id);
      if (!html) return;
      const kids = take(parseDriveHtml(html), folder.path);
      const enterAll = depth < 2 || isYearOrMonthFolder(folder.name);
      for (const k of kids) {
        if (enterAll || isYearOrMonthFolder(k.name)) next.push(k);
      }
    });
    queue = next;
    depth += 1;
  }

  const result = { files, shared: true, foldersOpened };
  crawlCache = { at: Date.now(), result };
  return result;
}

async function listRoot(): Promise<CrawlResult> {
  const html = await fetchEmbedded(PRE_FOLDER_ID);
  if (!html) return { files: [], shared: false, foldersOpened: 0 };
  const files: DriveItem[] = [];
  for (const e of parseDriveHtml(html)) {
    if (!e.folder) files.push({ id: e.id, name: e.name });
  }
  return { files, shared: true, foldersOpened: 0 };
}

async function fetchFolderHtml(): Promise<CrawlResult> {
  return crawlPresupuestos();
}

async function downloadDriveBytes(id: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const urls = [
    `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
    `https://docs.google.com/document/d/${id}/export?format=docx`,
    `https://docs.google.com/uc?export=download&id=${id}`,
    `https://docs.google.com/document/d/${id}/export?format=txt`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "ASPOR-IA/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const mime = res.headers.get("content-type") ?? "";
      if (mime.includes("text/html")) {
        const html = await res.text();
        const confirm = html.match(/confirm=([0-9A-Za-z_]+)/);
        if (confirm) {
          const again = await fetch(`https://drive.google.com/uc?export=download&id=${id}&confirm=${confirm[1]}`, {
            headers: { "User-Agent": "ASPOR-IA/1.0" },
            signal: AbortSignal.timeout(20_000),
          });
          if (again.ok && !(again.headers.get("content-type") ?? "").includes("text/html")) {
            return { bytes: new Uint8Array(await again.arrayBuffer()), mime: again.headers.get("content-type") ?? "application/octet-stream" };
          }
        }
        if (mime.includes("text/html") && html.length < 50_000 && !html.includes("<html")) {
          return { bytes: new TextEncoder().encode(html), mime: "text/plain" };
        }
        continue;
      }
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
    } catch {
      /* next */
    }
  }
  return null;
}

function u16(b: Uint8Array, o: number) {
  return b[o]! | (b[o + 1]! << 8);
}
function u32(b: Uint8Array, o: number) {
  return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
}

async function inflateRaw(data: Uint8Array) {
  try {
    const ds = new DecompressionStream("deflate-raw");
    return new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds)).arrayBuffer());
  } catch {
    const ds = new DecompressionStream("deflate");
    return new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(ds)).arrayBuffer());
  }
}

function decodeZipName(bytes: Uint8Array, start: number, len: number) {
  return new TextDecoder("utf-8").decode(bytes.subarray(start, start + len)).replace(/\\/g, "/");
}

async function inflateEntry(method: number, payload: Uint8Array) {
  const raw = method === 0 ? payload : await inflateRaw(payload);
  if (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) return new TextDecoder("utf-16le").decode(raw);
  return new TextDecoder("utf-8").decode(raw);
}

async function zipFileText(bytes: Uint8Array, want: string) {
  const wantEnd = want.replace(/^\/+/, "");
  const match = (name: string) => name === wantEnd || name.endsWith(`/${wantEnd}`);

  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65536); i -= 1) {
    if (u32(bytes, i) !== 0x06054b50) continue;
    const cdOff = u32(bytes, i + 16);
    const cdSize = u32(bytes, i + 12);
    let o = cdOff;
    const end = Math.min(bytes.length, cdOff + cdSize);
    while (o + 46 < end) {
      if (u32(bytes, o) !== 0x02014b50) break;
      const method = u16(bytes, o + 10);
      const comp = u32(bytes, o + 20);
      const nameLen = u16(bytes, o + 28);
      const extra = u16(bytes, o + 30);
      const comment = u16(bytes, o + 32);
      const localOff = u32(bytes, o + 42);
      const name = decodeZipName(bytes, o + 46, nameLen);
      if (match(name) && localOff + 30 < bytes.length && u32(bytes, localOff) === 0x04034b50) {
        const ln = u16(bytes, localOff + 26);
        const le = u16(bytes, localOff + 28);
        const start = localOff + 30 + ln + le;
        const size = comp || u32(bytes, localOff + 18);
        const payload = bytes.subarray(start, Math.min(bytes.length, start + size));
        try {
          const xml = await inflateEntry(method, payload);
          if (xml.includes("<w:")) return xml;
        } catch {
          /* siguiente */
        }
      }
      o += 46 + nameLen + extra + comment;
    }
    break;
  }

  let o = 0;
  while (o + 30 < bytes.length) {
    if (u32(bytes, o) !== 0x04034b50) {
      o += 1;
      continue;
    }
    const method = u16(bytes, o + 8);
    const comp = u32(bytes, o + 18);
    const nameLen = u16(bytes, o + 26);
    const extra = u16(bytes, o + 28);
    if (o + 30 + nameLen > bytes.length) break;
    const name = decodeZipName(bytes, o + 30, nameLen);
    const start = o + 30 + nameLen + extra;
    if (!comp) {
      o = start + 1;
      continue;
    }
    const payload = bytes.subarray(start, Math.min(bytes.length, start + comp));
    o = start + comp;
    if (!match(name)) continue;
    try {
      const xml = await inflateEntry(method, payload);
      if (xml.includes("<w:")) return xml;
    } catch {
      /* siguiente */
    }
  }
  return "";
}

async function walkZip(
  bytes: Uint8Array,
  onFile: (name: string, data: Uint8Array) => void | Promise<void>,
) {
  let o = 0;
  while (o + 30 < bytes.length) {
    if (u32(bytes, o) !== 0x04034b50) break;
    const method = u16(bytes, o + 8);
    const flags = u16(bytes, o + 6);
    const comp = u32(bytes, o + 18);
    const nameLen = u16(bytes, o + 26);
    const extra = u16(bytes, o + 28);
    const name = new TextDecoder().decode(bytes.subarray(o + 30, o + 30 + nameLen));
    const start = o + 30 + nameLen + extra;
    if (flags & 8 || comp === 0) break;
    const payload = bytes.subarray(start, start + comp);
    try {
      const raw = method === 0 ? payload : await inflateRaw(payload);
      await onFile(name, raw);
    } catch {
      /* skip */
    }
    o = start + comp;
  }
}

function decodeXmlEntities(s: string) {
  const amp = ["&", "amp;"].join("");
  const lt = ["&", "lt;"].join("");
  const gt = ["&", "gt;"].join("");
  const quot = ["&", "quot;"].join("");
  const apos = ["&", "apos;"].join("");
  return s
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(new RegExp(amp, "g"), "&")
    .replace(new RegExp(lt, "g"), "<")
    .replace(new RegExp(gt, "g"), ">")
    .replace(new RegExp(quot, "g"), '"')
    .replace(new RegExp(apos, "g"), "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(Number.parseInt(n, 16)));
}

function stripDrawings(xml: string) {
  return xml
    .replace(/<w:drawing[\s\S]*?<\/w:drawing>/gi, (block) => {
      const boxes = [...block.matchAll(/<w:txbxContent[\s\S]*?<\/w:txbxContent>/gi)].map((m) => m[0]);
      return boxes.join("");
    })
    .replace(/<w:pict[\s\S]*?<\/w:pict>/gi, "")
    .replace(/<w:object[\s\S]*?<\/w:object>/gi, "")
    .replace(/<v:shape[\s\S]*?<\/v:shape>/gi, (block) => {
      const boxes = [...block.matchAll(/<w:txbxContent[\s\S]*?<\/w:txbxContent>/gi)].map((m) => m[0]);
      return boxes.join("");
    });
}

function runText(xml: string) {
  const cleaned = stripDrawings(xml)
    .replace(/<w:instrText\b[\s\S]*?<\/w:instrText>/gi, "")
    .replace(/<w:delText\b[\s\S]*?<\/w:delText>/gi, "")
    .replace(/<w:sym\b[^/]*\/>/gi, "")
    .replace(/<w:tab[^/]*\/>/g, "    ")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<w:cr[^/]*\/>/g, "\n")
    .replace(/<w:numPr[\s\S]*?<\/w:numPr>/g, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/\u0000/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
  return decodeXmlEntities(cleaned);
}

function tableToText(tbl: string) {
  const rows = [...tbl.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((r) =>
    [...r[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((c) =>
      runText(c[0]).replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
    ),
  );
  if (!rows.length) return "";
  const cols = Math.max(...rows.map((r) => r.length), 1);
  const widths = Array.from({ length: cols }, (_, i) =>
    Math.min(42, Math.max(3, ...rows.map((r) => (r[i] ?? "").length))),
  );
  return rows
    .map((r) =>
      Array.from({ length: cols }, (_, i) => (r[i] ?? "").padEnd(widths[i])).join("  ").trimEnd(),
    )
    .join("\n");
}

function isTableLine(line: string) {
  return /\|/.test(line) || /\S\s{2,}\S/.test(line);
}

export function puntoAparte(text: string) {
  const skip = /^(s\.?l|s\.?a|c\.?b|sr|sra|dres?|dra|ud|uds|n[oº]|tfno|tel|etc|ej|p\.ej|avda|dpto|n[úu]m|art|ref|mod)$/i;
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim() || isTableLine(line)) return line;
      return line.replace(/(\S+)\.\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡«"])/g, (full, word: string) => {
        const token = word.replace(/^[("«]+/, "").replace(/[^A-Za-zÁÉÍÓÚÜÑºª.]+$/g, "");
        if (skip.test(token) || /^\d+[.,]?\d*$/.test(word)) return full;
        if (token.length <= 2 && token.includes(".")) return full;
        return `${word}.\n\n`;
      });
    })
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n");
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const xml = await zipFileText(bytes, "word/document.xml");
  if (!xml) return "";
  const body = xml.match(/<w:body[\s\S]*<\/w:body>/i)?.[0] ?? xml;
  const clean = stripDrawings(body);
  const parts: string[] = [];
  const re = /<w:tbl[\s>][\s\S]*?<\/w:tbl>|<w:p[\s>/][\s\S]*?(?:<\/w:p>|\/>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    if (m[0].startsWith("<w:tbl")) {
      const table = tableToText(m[0]);
      if (table) parts.push(table);
    } else {
      const para = runText(m[0]).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
      parts.push(para);
    }
  }
  let text = parts.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (text.length < 8) {
    const runs = [...clean.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)].map((x) => decodeXmlEntities(x[1]));
    text = runs.join(" ").replace(/[ \t]{2,}/g, " ").trim();
  }
  return puntoAparte(text);
}

async function bytesToText(bytes: Uint8Array, mime: string): Promise<string> {
  if (mime.includes("text/") || mime.includes("json")) return new TextDecoder("utf-8").decode(bytes).slice(0, 40_000);
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return (await extractDocxText(bytes)).slice(0, 40_000);
  try {
    const t = new TextDecoder("utf-8").decode(bytes);
    if (t.includes("<w:document") || t.includes("<w:t")) return (await extractDocxText(bytes)).slice(0, 40_000);
    if (t.includes("<html")) return "";
  } catch {
    /* binary */
  }
  return (await extractDocxText(bytes)).slice(0, 40_000);
}

function afterPresupuestoDe(text: string) {
  const m = text.match(/presupuesto\s+de\s*:?\s*([\s\S]{8,600})/i);
  return (m?.[1] ?? "").split(/\n{2,}/)[0]?.trim() ?? "";
}

function findCover(files: DriveItem[]) {
  const want = norm(COVER_NAME);
  return (
    files.find((f) => norm(f.name) === want) ??
    files.find((f) => norm(f.name).includes("caratula") && norm(f.name).includes("presupuesto")) ??
    files.find((f) => norm(f.name).includes("caratula"))
  );
}

export function matchTipoFile(files: DriveItem[], query: string) {
  const q = norm(query);
  if (q.length < 2) return undefined;
  const scored = files
    .filter((f) => !norm(f.name).includes("caratula"))
    .map((f) => {
      const n = norm(f.name);
      const p = norm(f.path ?? "");
      let score = 0;
      if (n === q) score = 100;
      else if (n.startsWith(q) || q.startsWith(n)) score = 80;
      else if (n.includes(q) || q.includes(n)) score = 60;
      else if (p.includes(q)) score = 40;
      else {
        const parts = q.split(" ").filter((w) => w.length > 2);
        score = parts.filter((w) => n.includes(w) || p.includes(w)).length * 15;
      }
      return { f, score };
    })
    .filter((x) => x.score >= 15)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.f;
}

export const inspectPresupuestoFolder = createServerFn({ method: "POST" }).handler(async (): Promise<CoverInfo> => {
  const { files, shared, foldersOpened } = await listRoot();
  const cover = findCover(files);
  let coverText = "";
  if (cover) {
    const got = await downloadDriveBytes(cover.id);
    if (got) coverText = (await bytesToText(got.bytes, got.mime)).slice(0, 12_000);
  }
  const sampleAfter = afterPresupuestoDe(coverText);
  const apiKey = process.env.XAI_API_KEY;
  let summary = shared
    ? `Carpeta lista · ${files.length} documentos en raíz, años y meses (${foldersOpened} carpetas). Portada: ${cover?.name ?? "Presupuesto caratula.docx"}.`
    : "La carpeta de Drive no es pública. Compártela: cualquier persona con el enlace puede ver.";

  if (apiKey && coverText) {
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0,
          max_tokens: 220,
          messages: [
            {
              role: "system",
              content:
                "Resume en 2 frases en español esta carátula de presupuesto ASPOR: recuadro de cliente y el epígrafe Presupuesto de. Sin markdown.",
            },
            { role: "user", content: coverText.slice(0, 3500) },
          ],
        }),
        signal: AbortSignal.timeout(18_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const s = body.choices?.[0]?.message?.content?.trim();
        if (s) summary = s.slice(0, 420);
      }
    } catch {
      /* keep default */
    }
  }

  return { ok: true, files, cover, coverText, sampleAfter, summary, shared, foldersOpened };
});

export const expandPresupuestoFolders = createServerFn({ method: "POST" }).handler(async (): Promise<CrawlResult> => {
  return crawlPresupuestos();
});

export const previewPresupuestoTipo = createServerFn({ method: "POST" })
  .validator((input: { tipo: string; files: DriveItem[] }) => ({
    tipo: input.tipo.trim().slice(0, 120),
    files: Array.isArray(input.files) ? input.files.slice(0, 800) : [],
  }))
  .handler(async ({ data }): Promise<TipoPreview | { ok: false; error: string; suggestions: string[] }> => {
    const listed = await fetchFolderHtml();
    const files = listed.files.length >= data.files.length ? listed.files : data.files;
    const file = matchTipoFile(files, data.tipo);
    if (!file) {
      return {
        ok: false,
        error: files.length
          ? `No hay un documento llamado como “${data.tipo}”.`
          : "No puedo listar la carpeta. Compártela con enlace público.",
        suggestions: files.filter((f) => !norm(f.name).includes("caratula")).map((f) => f.name).slice(0, 12),
      };
    }
    const got = await downloadDriveBytes(file.id);
    let text = got ? (await bytesToText(got.bytes, got.mime)).slice(0, 40_000) : "";
    if (text.length < 12) {
      try {
        const txt = await fetch(`https://docs.google.com/document/d/${file.id}/export?format=txt`, {
          headers: { "User-Agent": "ASPOR-IA/1.0" },
          signal: AbortSignal.timeout(15_000),
        });
        if (txt.ok) {
          const raw = await txt.text();
          if (raw && !raw.includes("<html") && raw.trim().length > text.length) text = raw.slice(0, 40_000);
        }
      } catch {
        /* keep zip text */
      }
    }
    const totalM = text.match(/(?:importe\s*total|total)\s*[:.]?\s*([\d.,]+)/i);
    const cantM = text.match(/(?:cantidad(?:es)?|uds?|unidades)\s*[:.]?\s*([^\n]{2,80})/i);
    return {
      ok: true,
      file,
      text: puntoAparte(text),
      image: undefined,
      images: [],
      sourcePdf: undefined,
      cantidadesHint: cantM?.[1]?.trim() ?? "",
      totalHint: totalM?.[1]?.trim() ?? "",
    };
  });

async function embedFonts(pdf: PDFDocument) {
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

function pdfSafe(raw: string) {
  return raw
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\u20AC/g, "EUR")
    .replace(/\u00D7/g, "x")
    .replace(/\uFFFD/g, "")
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, "");
}

function wrap(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  max: number,
) {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const width = (t: string) => {
    try {
      return font.widthOfTextAtSize(t, size);
    } catch {
      return t.length * size * 0.5;
    }
  };
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (width(next) <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export type CaratulaDraft = {
  cliente: string;
  direccion: string;
  localidad: string;
  telefono: string;
  concepto: string;
};

const NAVY = rgb(0.09, 0.15, 0.27);
const SILVER = rgb(0.45, 0.5, 0.56);
const PALE = rgb(0.94, 0.95, 0.96);
const RULE = rgb(0.72, 0.75, 0.8);
const INK = rgb(0.08, 0.09, 0.1);
const A4: [number, number] = [595.28, 841.89];
const ML = 50;
const MR = 50;
const FOOT = 42;

function money(n: number) {
  return pdfSafe(euro(n).replace(" EUR", " euros"));
}

function widthOf(
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  t: string,
  size: number,
) {
  const s = pdfSafe(t);
  try {
    return font.widthOfTextAtSize(s, size);
  } catch {
    return s.length * size * 0.5;
  }
}

export async function buildCaratulaPdf(draft: CaratulaDraft) {
  const now = new Date();
  const fecha = todayAlbaran(now);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Caratula");
  pdf.setAuthor(ALBARAN_COMPANY.name);
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  const page = pdf.addPage(A4);
  const { font, bold } = await embedFonts(pdf);
  const { width, height } = page.getSize();
  const right = width - MR;
  let y = height - 28;

  page.drawRectangle({ x: 0, y: height - 22, width, height: 22, color: NAVY });
  page.drawText(pdfSafe(`${ALBARAN_COMPANY.name}  ·  Servicio tecnico de puertas automaticas`), {
    x: ML,
    y: height - 15,
    size: 8,
    font,
    color: rgb(1, 1, 1),
  });

  y = height - 48;
  const cx = (t: string, size: number, f = font, gap = 13) => {
    const s = pdfSafe(t);
    page.drawText(s, { x: (width - widthOf(f, s, size)) / 2, y, size, font: f, color: INK });
    y -= gap;
  };
  cx("PUERTAS AUTOMATICAS  (R)", 10, bold, 13);
  cx(ALBARAN_COMPANY.name, 14, bold, 14);
  cx('Servicio Tecnico de "FAAC"', 10, font, 12);
  cx(`Tfno.: ${ALBARAN_COMPANY.phone}  ·  Fax: ${ALBARAN_COMPANY.fax}`, 9, font, 11);
  cx("C/ Alarcon, 34 - Bajo   33204 - GIJON", 9, font, 11);
  cx(`${ALBARAN_COMPANY.web}   e-mail: ${ALBARAN_COMPANY.email}`, 9, font, 16);

  page.drawLine({ start: { x: ML, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 1.1, color: NAVY });
  y -= 8;
  page.drawText("PRESUPUESTO", { x: ML, y, size: 16, font: bold, color: NAVY });
  page.drawText(fecha, { x: right - widthOf(bold, fecha, 11), y, size: 11, font: bold, color: INK });
  y -= 18;

  const boxH = 98;
  page.drawRectangle({ x: ML, y: y - boxH, width: right - ML, height: boxH, color: PALE });
  page.drawRectangle({ x: ML, y: y - boxH, width: 4, height: boxH, color: NAVY });
  let by = y - 18;
  const row = (label: string, value: string) => {
    page.drawText(pdfSafe(label), { x: ML + 14, y: by, size: 8, font: bold, color: SILVER });
    page.drawText(pdfSafe(value).slice(0, 64), { x: ML + 90, y: by, size: 10, font, color: INK });
    by -= 16;
  };
  row("Cliente", draft.cliente.trim());
  row("Direccion", draft.direccion.trim());
  row("Localidad", draft.localidad.trim());
  row("TEL/MAIL", draft.telefono.trim());
  row("Fecha", fecha);
  y -= boxH + 24;

  page.drawText("Muy Sres. Nuestros:", { x: ML, y, size: 11, font, color: INK });
  y -= 20;
  page.drawText("A continuacion le detallamos el presupuesto de:", { x: ML, y, size: 11, font, color: INK });
  y -= 18;
  const concept = wrap(draft.concepto.trim(), bold, 12, right - ML);
  page.drawRectangle({
    x: ML,
    y: y - concept.length * 16 - 10,
    width: right - ML,
    height: concept.length * 16 + 14,
    borderColor: RULE,
    borderWidth: 0.5,
  });
  for (const ln of concept) {
    page.drawText(pdfSafe(ln), { x: ML + 10, y: y - 4, size: 12, font: bold, color: NAVY });
    y -= 16;
  }
  y -= 18;
  const close = wrap(
    "Sin otro particular, esperando merezca su interes, poniendonos para cuanto desee a su disposicion, aprovechamos la ocasion para enviarle un cordial saludo.",
    font,
    9,
    right - ML,
  );
  for (const ln of close) {
    page.drawText(pdfSafe(ln), { x: ML, y, size: 9, font, color: INK });
    y -= 12;
  }
  y -= 10;
  page.drawText(ALBARAN_COMPANY.name, { x: ML, y, size: 10, font: bold, color: NAVY });
  y -= 22;
  const spec = wrap(
    "ESPECIFICACIONES AL CLIENTE: EN CASO DE ACEPTACION ROGAMOS NOS REMITAN EL PRESUPUESTO FIRMADO Y LOS DATOS PARA PROCEDER A LA FACTURACION. PRESUPUESTO SUPEDITADO A VISTA DE OBRA.",
    font,
    7,
    right - ML,
  );
  for (const ln of spec) {
    page.drawText(pdfSafe(ln), { x: ML, y, size: 7, font, color: SILVER });
    y -= 10;
  }
  y -= 20;
  page.drawRectangle({ x: ML, y: y - 70, width: 220, height: 70, borderColor: RULE, borderWidth: 0.6 });
  page.drawRectangle({ x: 325, y: y - 70, width: right - 325, height: 70, borderColor: RULE, borderWidth: 0.6 });
  page.drawText("REVISADO Y APROBADO", { x: ML + 10, y: y - 14, size: 8, font: bold, color: NAVY });
  page.drawText("ACEPTADO POR EL CLIENTE", { x: 335, y: y - 14, size: 8, font: bold, color: NAVY });
  page.drawText("Fecha y firma", { x: 335, y: y - 58, size: 8, font, color: SILVER });
  y -= 88;
  page.drawLine({ start: { x: ML, y: 36 }, end: { x: right, y: 36 }, thickness: 0.6, color: NAVY });
  page.drawText("ASPOR-PG-3.1.2  Ed. 0  ·  www.aspor.net", { x: ML, y: 24, size: 7, font, color: SILVER });

  return { bytes: await pdf.save(), fecha, fileName: "Caratula.pdf" };
}

export type PreLine = { qty: string; desc: string; amount: string };

export type TipoDraft = CaratulaDraft & {
  tipoName: string;
  cantidades: string;
  importe: string;
  epigrafeCantidades?: string;
  epigrafeImporte?: string;
  lines?: PreLine[];
  images?: { mime: string; b64: string }[];
  sourcePdf?: string;
  bodyText?: string;
};

export function lineBase(line: PreLine) {
  return parseCantidad(line.qty) * parseImporte(line.amount);
}

export function linesTotal(lines: PreLine[]) {
  return lines.reduce((s, l) => s + lineBase(l), 0);
}

export function conIva(n: number) {
  return Math.round(n * 1.21 * 100) / 100;
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function embedPreviewImages(
  pdf: PDFDocument,
  page: PDFPage,
  images: { mime: string; b64: string }[],
  box: { left: number; right: number; y: number },
) {
  let y = box.y;
  const maxW = box.right - box.left;
  for (const img of images.slice(0, 4)) {
    try {
      const bytes = b64ToBytes(img.b64);
      const embedded = img.mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scale = Math.min(maxW / embedded.width, 280 / embedded.height, 1);
      const w = embedded.width * scale;
      const h = embedded.height * scale;
      if (y - h < 80) break;
      y -= h + 8;
      page.drawImage(embedded, { x: box.left + (maxW - w) / 2, y, width: w, height: h });
    } catch {
      /* imagen no embebible */
    }
  }
  return y;
}

export async function buildTipoPdf(draft: TipoDraft) {
  const now = new Date();
  const fecha = todayAlbaran(now);
  const rows =
    draft.lines?.filter((l) => l.qty.trim() || l.desc.trim() || l.amount.trim()) ??
    [
      {
        qty: draft.cantidades.trim() || "1",
        desc: draft.concepto.trim() || draft.tipoName,
        amount: draft.importe,
      },
    ];
  const neto = linesTotal(rows) || parseImporte(draft.importe);
  const total = conIva(neto);
  const pdf = await PDFDocument.create();
  const titleName = draft.tipoName.replace(/\.(docx|doc|pdf)$/i, "") || "Presupuesto";
  pdf.setTitle(titleName);
  pdf.setAuthor(ALBARAN_COMPANY.name);
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  const { font, bold } = await embedFonts(pdf);
  const pageW = A4[0];
  const pageH = A4[1];
  const inner = pageW - ML - MR;
  let page = pdf.addPage(A4);
  const pages: ReturnType<PDFDocument["addPage"]>[] = [page];
  let y = pageH - 36;

  const write = (
    t: string,
    opts: { x: number; y: number; size: number; font: typeof font; color?: ReturnType<typeof rgb> },
  ) => {
    const s = pdfSafe(t);
    if (!s) return;
    try {
      page.drawText(s, { color: INK, ...opts });
    } catch {
      try {
        page.drawText(s.replace(/[^\x20-\x7E]/g, "?"), { color: INK, ...opts });
      } catch {
        /* skip */
      }
    }
  };

  const band = (p: typeof page, first: boolean) => {
    p.drawRectangle({ x: 0, y: pageH - 22, width: pageW, height: 22, color: NAVY });
    p.drawText(
      pdfSafe(
        first
          ? `${ALBARAN_COMPANY.name}  ·  Presupuesto`
          : `${ALBARAN_COMPANY.name}  ·  ${draft.cliente.slice(0, 40)}`,
      ),
      { x: ML, y: pageH - 15, size: 8, font, color: rgb(1, 1, 1) },
    );
    p.drawText(fecha, { x: pageW - MR - widthOf(font, fecha, 8), y: pageH - 15, size: 8, font, color: rgb(1, 1, 1) });
  };

  const ensure = (need: number) => {
    if (y - need > FOOT + 18) return;
    page = pdf.addPage(A4);
    pages.push(page);
    band(page, false);
    y = pageH - 40;
  };

  band(page, true);
  y = pageH - 44;
  write(ALBARAN_COMPANY.name, { x: ML, y, size: 13, font: bold, color: NAVY });
  write('Servicio tecnico de "FAAC"', { x: ML, y: y - 14, size: 8, font, color: SILVER });
  write("PRESUPUESTO", { x: pageW - MR - widthOf(bold, "PRESUPUESTO", 16), y: y - 4, size: 16, font: bold, color: NAVY });
  y -= 28;
  page.drawLine({ start: { x: ML, y }, end: { x: pageW - MR, y }, thickness: 1.2, color: NAVY });
  y -= 16;

  page.drawRectangle({ x: ML, y: y - 62, width: inner, height: 62, color: PALE });
  page.drawRectangle({ x: ML, y: y - 62, width: 4, height: 62, color: NAVY });
  write(draft.cliente || "Cliente", { x: ML + 14, y: y - 16, size: 11, font: bold, color: INK });
  write(draft.direccion || "", { x: ML + 14, y: y - 30, size: 8, font, color: SILVER });
  write(draft.localidad || "", { x: ML + 14, y: y - 42, size: 8, font, color: SILVER });
  write(draft.telefono || "", { x: ML + 14, y: y - 54, size: 8, font, color: SILVER });
  y -= 76;
  const conceptBits = wrap(`Presupuesto de: ${draft.concepto}`, bold, 10, inner);
  for (const ln of conceptBits) {
    ensure(14);
    write(ln, { x: ML, y, size: 10, font: bold, color: NAVY });
    y -= 13;
  }
  y -= 8;

  const body = puntoAparte((draft.bodyText ?? "").trim());
  if (body) {
    const flushTable = (block: string[]) => {
      if (!block.length) return;
      const grid = block.map((ln) =>
        ln.includes("|") ? ln.split("|").map((c) => c.trim()) : ln.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean),
      );
      const cols = Math.max(...grid.map((r) => r.length), 1);
      const colW = inner / cols;
      const rowH = 16;
      ensure(22 + grid.length * rowH);
      page.drawRectangle({ x: ML, y: y - 16, width: inner, height: 16, color: NAVY });
      grid[0]?.forEach((c, i) => {
        write(c, { x: ML + 6 + i * colW, y: y - 12, size: 7, font: bold, color: rgb(1, 1, 1) });
      });
      y -= 16;
      grid.slice(1).forEach((r, ri) => {
        ensure(rowH + 4);
        if (ri % 2 === 0) page.drawRectangle({ x: ML, y: y - rowH, width: inner, height: rowH, color: PALE });
        page.drawRectangle({ x: ML, y: y - rowH, width: inner, height: rowH, borderColor: RULE, borderWidth: 0.3 });
        r.forEach((c, i) => write(c, { x: ML + 6 + i * colW, y: y - 12, size: 8, font, color: INK }));
        y -= rowH;
      });
      y -= 10;
    };

    let tableBuf: string[] = [];
    const isTable = (raw: string) => /\|/.test(raw) || /\S\s{2,}\S/.test(raw);
    for (const raw of body.split("\n")) {
      const line = pdfSafe(raw).replace(/\t/g, "    ");
      if (isTable(raw) && line) {
        tableBuf.push(line);
        continue;
      }
      if (tableBuf.length) {
        flushTable(tableBuf);
        tableBuf = [];
      }
      if (!line) {
        y -= 8;
        continue;
      }
      const bits = wrap(line, font, 10, inner);
      for (const ln of bits.length ? bits : [line]) {
        ensure(14);
        write(ln, { x: ML + 8, y, size: 10, font, color: INK });
        y -= 13;
      }
      y -= 3;
    }
    if (tableBuf.length) flushTable(tableBuf);
    y -= 8;
  }

  ensure(36);
  page.drawLine({ start: { x: ML, y }, end: { x: pageW - MR, y }, thickness: 0.5, color: RULE });
  y -= 16;
  write("Detalle economico", { x: ML, y, size: 9, font: bold, color: NAVY });
  y -= 8;
  const colQ = ML + 8;
  const colD = ML + 52;
  const colI = pageW - MR - 88;
  ensure(22);
  page.drawRectangle({ x: ML, y: y - 18, width: inner, height: 18, color: NAVY });
  write("Ud.", { x: colQ, y: y - 13, size: 8, font: bold, color: rgb(1, 1, 1) });
  write(draft.epigrafeCantidades?.trim() || "Concepto", { x: colD, y: y - 13, size: 8, font: bold, color: rgb(1, 1, 1) });
  write("Importe", { x: colI, y: y - 13, size: 8, font: bold, color: rgb(1, 1, 1) });
  y -= 18;

  rows.slice(0, 16).forEach((row, ri) => {
    const descLines = wrap(row.desc.trim() || "-", font, 9, colI - colD - 8);
    const h = Math.max(20, 8 + descLines.length * 12);
    ensure(h + 4);
    if (ri % 2 === 0) page.drawRectangle({ x: ML, y: y - h, width: inner, height: h, color: PALE });
    page.drawRectangle({ x: ML, y: y - h, width: inner, height: h, borderColor: RULE, borderWidth: 0.35 });
    write(row.qty.trim() || "1", { x: colQ, y: y - 14, size: 10, font, color: INK });
    descLines.forEach((ln, i) => write(ln, { x: colD, y: y - 14 - i * 12, size: 9, font, color: INK }));
    const amt = money(lineBase(row));
    write(amt, { x: pageW - MR - 8 - widthOf(font, amt, 10), y: y - 14, size: 10, font, color: INK });
    y -= h;
  });

  y -= 12;
  ensure(86);
  const boxW = 220;
  const boxX = pageW - MR - boxW;
  page.drawRectangle({ x: boxX, y: y - 70, width: boxW, height: 70, color: PALE });
  page.drawRectangle({ x: boxX, y: y - 70, width: 4, height: 70, color: NAVY });
  write("Base imponible", { x: boxX + 12, y: y - 16, size: 8, font, color: SILVER });
  write(money(neto), { x: boxX + boxW - 12 - widthOf(font, money(neto), 10), y: y - 16, size: 10, font, color: INK });
  write("IVA 21%", { x: boxX + 12, y: y - 32, size: 8, font, color: SILVER });
  write(money(total - neto), {
    x: boxX + boxW - 12 - widthOf(font, money(total - neto), 10),
    y: y - 32,
    size: 10,
    font,
    color: INK,
  });
  page.drawLine({ start: { x: boxX + 12, y: y - 40 }, end: { x: boxX + boxW - 12, y: y - 40 }, thickness: 0.5, color: RULE });
  const epi = (draft.epigrafeImporte?.trim() || "Importe total").slice(0, 28);
  write(epi, { x: boxX + 12, y: y - 58, size: 9, font: bold, color: NAVY });
  write(money(total), { x: boxX + boxW - 12 - widthOf(bold, money(total), 12), y: y - 58, size: 12, font: bold, color: NAVY });
  y -= 88;

  ensure(70);
  write("Validez 30 dias. IVA 21% incluido. Presupuesto supeditado a vista de obra.", {
    x: ML,
    y,
    size: 8,
    font,
    color: SILVER,
  });
  y -= 28;
  page.drawRectangle({ x: ML, y: y - 56, width: 220, height: 56, borderColor: RULE, borderWidth: 0.6 });
  page.drawRectangle({ x: pageW - MR - 220, y: y - 56, width: 220, height: 56, borderColor: RULE, borderWidth: 0.6 });
  write(`Por ${ALBARAN_COMPANY.name}`, { x: ML + 10, y: y - 14, size: 8, font: bold, color: NAVY });
  write("Acepto el presupuesto", { x: pageW - MR - 210, y: y - 14, size: 8, font: bold, color: NAVY });
  write("Fecha y firma", { x: pageW - MR - 210, y: y - 46, size: 7, font, color: SILVER });

  pages.forEach((p, i) => {
    p.drawLine({ start: { x: ML, y: 32 }, end: { x: pageW - MR, y: 32 }, thickness: 0.7, color: NAVY });
    p.drawText(pdfSafe(`${ALBARAN_COMPANY.name}  ·  www.aspor.net  ·  C/ Alarcon, 34  ·  Gijon`), {
      x: ML,
      y: 20,
      size: 7,
      font,
      color: SILVER,
    });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: pageW - MR - widthOf(font, pn, 7), y: 20, size: 7, font, color: SILVER });
  });

  return { bytes: await pdf.save(), fecha, fileName: `${titleName}.pdf` };
}
