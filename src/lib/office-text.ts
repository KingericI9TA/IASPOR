import { unzipStore } from "@/lib/zip-store";
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
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
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

function xlsxToText(files: { name: string; data: Uint8Array }[]) {
  const dec = new TextDecoder();
  const ss = files.find((f) => /sharedstrings\.xml$/i.test(f.name));
  const strings: string[] = [];
  if (ss) {
    const xml = dec.decode(ss.data);
    for (const m of xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)) strings.push(decodeXml(m[1]));
  }
  const sheets = files.filter((f) => /worksheets\/sheet\d+\.xml$/i.test(f.name));
  const lines: string[] = [];
  for (const sh of sheets) {
    const xml = dec.decode(sh.data);
    for (const row of xml.split(/<row\b/i).slice(1)) {
      const cells: string[] = [];
      for (const cm of row.matchAll(/<c\b([^>]*)>(?:[\s\S]*?<v>([^<]*)<\/v>)?/gi)) {
        const v = cm[2] ?? "";
        cells.push(/\bt="s"/i.test(cm[1]) ? (strings[Number(v)] ?? "") : v);
      }
      if (cells.some((c) => c.trim())) lines.push(cells.join("\t"));
    }
  }
  return lines.join("\n");
}

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
    return (await file.text()).slice(0, 220_000);
  }
  if (kind === "word" || kind === "excel") {
    onProgress?.(20);
    const entries = unzipStore(await file.arrayBuffer());
    onProgress?.(70);
    if (kind === "excel") {
      const text = xlsxToText(entries);
      onProgress?.(100);
      return text.slice(0, 220_000);
    }
    const doc = entries.find((e) => /word\/document\.xml$/i.test(e.name));
    onProgress?.(100);
    if (!doc) return file.name;
    return stripXml(new TextDecoder().decode(doc.data)).slice(0, 220_000);
  }
  throw new Error(`${file.name}: guarda como PDF, DOCX, XLSX o CSV`);
}
