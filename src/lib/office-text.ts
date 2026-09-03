import { unzipStore, unzipZip } from "@/lib/zip-store";
import { extractPdfText } from "@/lib/pdf-text";

export type DocKind = "pdf" | "word" | "excel" | "csv";

const MIME: Record<DocKind, string[]> = {
  pdf: ["application/pdf"],
  word: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  excel: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
  csv: ["text/csv", "text/plain", "application/vnd.ms-excel"],
};

export function mimeForKind(kind: DocKind) {
  if (kind === "pdf") return "application/pdf";
  if (kind === "word") return MIME.word[0];
  if (kind === "excel") return MIME.excel[0];
  return "text/csv";
}

export function kindOfFile(file: File): DocKind | null {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (n.endsWith(".docx")) return "word";
  if (n.endsWith(".xlsx") || n.endsWith(".xlsm")) return "excel";
  if (n.endsWith(".csv") || n.endsWith(".tsv") || n.endsWith(".txt")) return "csv";
  if (n.endsWith(".doc") || n.endsWith(".xls")) return null;
  if (MIME.pdf.includes(file.type)) return "pdf";
  if (MIME.word.includes(file.type)) return "word";
  if (MIME.excel.includes(file.type)) return "excel";
  return null;
}

export function isTallerFile(file: File) {
  return kindOfFile(file) !== null;
}

function decodeXml(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripXml(xml: string) {
  return decodeXml(
    xml
      .replace(/<w:tab\b[^/]*\/>/g, "\t")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function colIndex(ref: string) {
  let n = 0;
  for (let i = 0; i < ref.length; i += 1) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return Math.max(0, n - 1);
}

function sharedStrings(xml: string) {
  const out: string[] = [];
  for (const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
    const inner = (m[1] ?? "").replace(/<rPh\b[\s\S]*?<\/rPh>/gi, "");
    out.push([...inner.matchAll(/<t\b[^>]*>([^<]*)<\/t>/gi)].map((t) => decodeXml(t[1] ?? "")).join(""));
  }
  return out;
}

const MAX_EXCEL_ROWS = 5_000;

function sheetRows(xml: string, strings: string[]) {
  const rows: string[][] = [];
  for (const row of xml.split(/<row\b/i).slice(1)) {
    if (rows.length >= MAX_EXCEL_ROWS) break;
    const cells: string[] = [];
    for (const cm of row.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/gi)) {
      const attrs = cm[1] ?? "";
      const inner = cm[2] ?? "";
      const letters = /r="([A-Z]+)\d+"/i.exec(attrs)?.[1];
      const t = /t="([^"]+)"/i.exec(attrs)?.[1] ?? "";
      let val = "";
      if (t === "s") {
        const v = /<v>([^<]*)<\/v>/i.exec(inner)?.[1] ?? "";
        val = strings[Number(v)] ?? "";
      } else if (t === "inlineStr" || t === "str") {
        val = [...inner.matchAll(/<t\b[^>]*>([^<]*)<\/t>/gi)].map((m) => decodeXml(m[1] ?? "")).join("");
        if (!val) val = /<v>([^<]*)<\/v>/i.exec(inner)?.[1] ?? "";
      } else {
        val = /<v>([^<]*)<\/v>/i.exec(inner)?.[1] ?? "";
      }
      const idx = letters ? colIndex(letters) : cells.length;
      while (cells.length < idx) cells.push("");
      cells[idx] = val;
    }
    if (cells.some((c) => c.trim())) rows.push(cells);
  }
  return rows;
}

function xlsxToText(files: { name: string; data: Uint8Array }[]) {
  const dec = new TextDecoder();
  const ss = files.find((f) => /sharedstrings\.xml$/i.test(f.name));
  const strings = ss ? sharedStrings(dec.decode(ss.data)) : [];
  const sheets = files
    .filter((f) => /worksheets\/[^/]+\.xml$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const lines: string[] = [];
  for (const sh of sheets) {
    if (lines.length >= MAX_EXCEL_ROWS) break;
    for (const row of sheetRows(dec.decode(sh.data), strings)) {
      if (row.some((c) => c.trim())) lines.push(row.join("\t"));
      if (lines.length >= MAX_EXCEL_ROWS) break;
    }
  }
  return lines.join("\n");
}

const EXCEL_PART = /xl\/(sharedStrings\.xml|worksheets\/[^/]+\.xml)$/i;
const WORD_PART = /word\/document\.xml$/i;

export async function extractOfficeText(file: File, onProgress?: (pct: number) => void) {
  const kind = kindOfFile(file);
  if (kind === "pdf") {
    try {
      return await extractPdfText(file, onProgress);
    } catch (e) {
      if (e instanceof Error && e.message === "NO_PDF") {
        throw new Error(`${file.name} no es un PDF válido (puede ser un Word o un HTML de Drive).`);
      }
      return file.name.replace(/\.pdf$/i, "");
    }
  }
  if (kind === "csv") {
    onProgress?.(100);
    return (await file.text()).slice(0, 1_200_000);
  }
  if (kind === "word" || kind === "excel") {
    onProgress?.(15);
    const buf = await file.arrayBuffer();
    onProgress?.(40);
    const want = kind === "excel" ? (n: string) => EXCEL_PART.test(n) : (n: string) => WORD_PART.test(n);
    let entries = await unzipZip(buf, want);
    if (!entries.length) entries = unzipStore(buf);
    onProgress?.(75);
    if (kind === "excel") {
      const text = xlsxToText(entries);
      onProgress?.(100);
      if (!text.trim()) throw new Error(`${file.name}: Excel vacío o no se pudo leer`);
      return text.slice(0, 1_200_000);
    }
    const doc = entries.find((e) => WORD_PART.test(e.name));
    onProgress?.(100);
    if (!doc) return file.name;
    return stripXml(new TextDecoder().decode(doc.data)).slice(0, 220_000);
  }
  throw new Error(`${file.name}: guarda como PDF, DOCX, XLSX o CSV`);
}

export async function runPool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let i = 0;
  const n = Math.min(Math.max(1, size), Math.max(1, items.length));
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const cur = i;
        i += 1;
        const item = items[cur];
        if (item === undefined) break;
        await fn(item, cur);
      }
    }),
  );
}