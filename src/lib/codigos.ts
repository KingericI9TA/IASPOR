import { createServerFn } from "@tanstack/react-start";
import { isStaticHost } from "./static-host";
import { normalize } from "./utils";

export type CodeSource = {
  id: "a" | "b";
  name: string;
  sheetId: string;
  gid?: string;
};

export type CodeRow = {
  sourceId: "a" | "b" | "local";
  sourceName: string;
  values: Record<string, string>;
};

export type CodeTable = {
  sourceId: "a" | "b" | "local";
  sourceName: string;
  headers: string[];
  rows: CodeRow[];
  error?: string;
};

export const CODE_SOURCES: CodeSource[] = [
  {
    id: "a",
    name: "CODIGOS",
    sheetId: "1HR_xZnUQiSfCQtJp1_3ChJLwfF48ab9C",
  },
  {
    id: "b",
    name: "CODIGOS HASTA 99",
    sheetId: "150u0gSM43ZE9NqfMWEdCTHnjZzNDMWUt",
    gid: "63387844",
  },
];

export function sheetUrl(id: string) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit?usp=drivesdk`;
}

export function csvUrl(id: string, gid?: string) {
  const gidQ = gid ? `&gid=${gid}` : "";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gidQ}`;
}

export function isCodigosFileName(name: string) {
  const n = normalize(name.replace(/\.(xlsx|xlsm|xls|csv|tsv|txt)$/i, ""));
  if (!n.includes("codigos")) return false;
  return true;
}

export function sourceIdForFileName(name: string): "a" | "b" | "local" {
  const n = normalize(name);
  if (!n.includes("codigos")) return "local";
  if (n.includes("hasta") && n.includes("99")) return "b";
  return "a";
}

export function displayCodigosName(name: string) {
  const id = sourceIdForFileName(name);
  if (id === "a") return "CODIGOS";
  if (id === "b") return "CODIGOS HASTA 99";
  return name.replace(/\.(xlsx|xlsm|xls|csv|tsv|txt)$/i, "").slice(0, 80);
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const first = cleaned.split("\n").find((l) => l.trim()) ?? "";
  const commas = (first.match(/,/g) ?? []).length;
  const semis = (first.match(/;/g) ?? []).length;
  const tabs = (first.match(/\t/g) ?? []).length;
  const sep = tabs > commas && tabs > semis ? "\t" : semis > commas ? ";" : ",";

  const lines: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let quoted = false;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (quoted) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === sep) {
      row.push(cell.trim());
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c)) lines.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((c) => c)) lines.push(row);
  }

  const headers = (lines[0] ?? []).map((h, idx) => h || `Columna ${idx + 1}`);
  const rows = lines.slice(1, 5000).map((cols) => {
    const values: Record<string, string> = {};
    headers.forEach((h, idx) => {
      values[h] = cols[idx] ?? "";
    });
    return values;
  });
  return { headers, rows: rows.filter(rowHasData) };
}

function rowHasData(values: Record<string, string>) {
  return Object.values(values).some((v) => v.trim().length > 0);
}

function looksLikeTable(text: string) {
  const t = text.trim();
  if (!t || t.length < 12) return false;
  if (/<!doctype html/i.test(t.slice(0, 160)) || /accounts\.google/i.test(t.slice(0, 500))) return false;
  const first = t.split("\n").find((l) => l.trim()) ?? "";
  return /[,;\t]/.test(first) && /codigo|nombre|ot|id|emisor|numero/i.test(first);
}

function unwrapReader(text: string) {
  const t = text.trim();
  if (!t) return t;
  const marker = "Markdown Content:";
  const i = t.indexOf(marker);
  const body = i >= 0 ? t.slice(i + marker.length).trim() : t;
  return body.replace(/^```(?:csv|tsv|text)?\s*/i, "").replace(/\s*```$/, "").trim();
}

const LOCAL_KEY = "iaspor:codigos-local";
const CACHE_KEY = "iaspor:codigos-cache";
const CACHE_MS = 24 * 60 * 60 * 1000;

type LocalTable = { name: string; sourceId: "a" | "b" | "local"; headers: string[]; rows: Record<string, string>[] };

export function ingestLocalCodes(fileName: string, text: string) {
  const parsed = parseCsv(text);
  if (parsed.rows.length === 0) return 0;
  const sourceId = sourceIdForFileName(fileName);
  const name = displayCodigosName(fileName);
  const tables: LocalTable[] = loadLocalTables().filter((t) => t.name !== name && t.name !== fileName);
  tables.unshift({
    name,
    sourceId,
    headers: parsed.headers,
    rows: parsed.rows,
  });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(tables.slice(0, 6)));
  return parsed.rows.length;
}

function loadLocalTables(): LocalTable[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as LocalTable[];
    if (!Array.isArray(p)) return [];
    return p.map((t) => ({
      name: t.name,
      sourceId: sourceIdForFileName(t.name),
      headers: t.headers ?? [],
      rows: t.rows ?? [],
    }));
  } catch {
    return [];
  }
}

export function loadLocalCodeRows(): { headers: string[]; rows: CodeRow[] } {
  const tables = loadLocalTables();
  const headers = [...new Set(tables.flatMap((t) => t.headers))];
  const rows: CodeRow[] = [];
  for (const t of tables) {
    for (const values of t.rows) {
      rows.push({ sourceId: t.sourceId, sourceName: t.name, values });
    }
  }
  return { headers, rows };
}

/** Drive manda en CODIGOS / HASTA 99. El teléfono rellena solo si Drive no abrió, o suma tablas extra. */
export function mergeCodeSources(
  drive: CodeTable[],
  local: { headers: string[]; rows: CodeRow[] },
): { rows: CodeRow[]; headers: string[]; label: string } {
  const remoteOk = new Set(drive.filter((t) => t.rows.length).map((t) => t.sourceId));
  const driveRows = drive.flatMap((t) =>
    t.rows.map((r) => ({ ...r, sourceName: `Drive · ${t.sourceName}` })),
  );

  let held = 0;
  const phoneRows: CodeRow[] = [];
  for (const r of local.rows) {
    const official = r.sourceId === "a" || r.sourceId === "b";
    if (official && remoteOk.has(r.sourceId)) {
      held += 1;
      continue;
    }
    const name = r.sourceName.replace(/^(Drive|Teléfono) · /, "");
    phoneRows.push({ ...r, sourceName: `Teléfono · ${name}` });
  }

  const headers = [
    ...new Set([
      ...drive.filter((t) => t.rows.length).flatMap((t) => t.headers),
      ...phoneRows.flatMap((r) => Object.keys(r.values)),
    ]),
  ];
  const counts: string[] = [];
  for (const t of drive) {
    if (t.rows.length) counts.push(`Drive · ${t.sourceName} (${t.rows.length})`);
  }
  if (phoneRows.length) {
    const by = new Map<string, number>();
    for (const r of phoneRows) by.set(r.sourceName, (by.get(r.sourceName) ?? 0) + 1);
    for (const [name, n] of by) counts.push(`${name} (${n})`);
  }
  const errs = drive.filter((t) => t.error).map((t) => `${t.sourceName}: ${t.error}`);
  const heldNote = held ? "Respaldo en el teléfono, sin mezclar." : "";
  const label =
    [...(counts.length ? [counts.join(" · ")] : []), heldNote, ...errs].filter(Boolean).join(" ") ||
    "Sin datos. Añade el Excel CODIGOS o recarga.";
  return { rows: [...driveRows, ...phoneRows], headers, label };
}

export function searchCodeRows(
  rows: CodeRow[],
  query: string,
  field: string,
  sourceId: "all" | "a" | "b" | "local",
) {
  const q = normalize(query);
  if (!q) return rows.slice(0, 20);
  const parts = q.split(" ").filter(Boolean);
  const out: { row: CodeRow; score: number }[] = [];
  for (const row of rows) {
    if (sourceId !== "all" && row.sourceId !== sourceId) continue;
    const hay = field
      ? normalize(row.values[field] ?? "")
      : normalize(Object.values(row.values).join(" "));
    if (!hay) continue;
    const matched = parts.filter((p) => hay.includes(p)).length;
    if (matched === 0) continue;
    out.push({ row, score: matched * 10 + (hay.startsWith(q) ? 3 : 0) });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 80).map((x) => x.row);
}

async function serverGet(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "IASPOR/1.0 (codigos)" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("El archivo es privado. En Drive: Compartir → Cualquiera con el enlace → Lector.");
  }
  if (!res.ok) throw new Error(`No se pudo abrir (${res.status}).`);
  const text = await res.text();
  if (/<!doctype html/i.test(text.slice(0, 120)) || /accounts\.google/i.test(text.slice(0, 400))) {
    throw new Error("Google pide inicio de sesión. Comparte la hoja: Cualquiera con el enlace → Lector.");
  }
  return text;
}

async function browserGetCsv(url: string) {
  const jina = `https://r.jina.ai/${url}`;
  const cors = [`https://proxy.cors.sh/${url}`, `https://proxy.corsfix.com/?${url}`];
  const sources = typeof window !== "undefined" && isStaticHost() ? [jina, ...cors] : [url, jina, ...cors];
  try {
    return await Promise.any(
      sources.map(async (src) => {
        const res = await fetch(src, {
          redirect: "follow",
          headers: src.includes("r.jina.ai") ? { "X-Return-Format": "text" } : undefined,
          signal: AbortSignal.timeout(src.includes("r.jina.ai") ? 14_000 : 7_000),
        });
        if (!res.ok) throw new Error(String(res.status));
        const text = unwrapReader(await res.text());
        if (!looksLikeTable(text)) throw new Error("no table");
        return text;
      }),
    );
  } catch {
    throw new Error("No se pudo leer CODIGOS.");
  }
}

async function tableFromSource(source: CodeSource, getText: (url: string) => Promise<string>): Promise<CodeTable> {
  try {
    const text = await getText(csvUrl(source.sheetId, source.gid));
    const parsed = parseCsv(text);
    return {
      sourceId: source.id,
      sourceName: source.name,
      headers: parsed.headers,
      rows: parsed.rows.map((values) => ({
        sourceId: source.id,
        sourceName: source.name,
        values,
      })),
    };
  } catch (e) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      headers: [],
      rows: [],
      error: e instanceof Error ? e.message : "No se pudo leer.",
    };
  }
}

export const fetchCodeTables = createServerFn({ method: "POST" }).handler(async () => {
  const tables = await Promise.all(CODE_SOURCES.map((s) => tableFromSource(s, serverGet)));
  return { ok: true as const, tables };
});

type CacheFile = { at: number; tables: CodeTable[] };

export function peekCodeCache(): CacheFile | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as CacheFile;
    if (!p?.tables?.length) return null;
    return p;
  } catch {
    return null;
  }
}

function readCodeCache(): CacheFile | null {
  const p = peekCodeCache();
  if (!p || Date.now() - p.at > CACHE_MS) return null;
  return p;
}

function writeCodeCache(tables: CodeTable[]) {
  try {
    const usable = tables.filter((t) => t.rows.length);
    if (!usable.length) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), tables: usable } satisfies CacheFile));
  } catch {
    /* quota */
  }
}

export async function queryCodeTables(opts?: {
  force?: boolean;
}): Promise<{ ok: true; tables: CodeTable[]; cached?: boolean }> {
  const cached = typeof window !== "undefined" ? readCodeCache() : null;
  if (cached && !opts?.force) return { ok: true, tables: cached.tables, cached: true };

  const stale = typeof window !== "undefined" ? peekCodeCache() : null;
  const run = async () => {
    if (typeof window !== "undefined" && isStaticHost()) {
      return {
        ok: true as const,
        tables: await Promise.all(CODE_SOURCES.map((s) => tableFromSource(s, browserGetCsv))),
      };
    }
    try {
      return await fetchCodeTables();
    } catch {
      return {
        ok: true as const,
        tables: await Promise.all(CODE_SOURCES.map((s) => tableFromSource(s, browserGetCsv))),
      };
    }
  };

  try {
    const res = await run();
    if (res.tables.some((t) => t.rows.length)) writeCodeCache(res.tables);
    if (res.tables.every((t) => t.error) && stale?.tables.length) {
      return { ok: true, tables: stale.tables, cached: true };
    }
    return res;
  } catch {
    if (stale?.tables.length) return { ok: true, tables: stale.tables, cached: true };
    throw new Error("No se pudo leer CODIGOS ni CODIGOS HASTA 99");
  }
}

const SEEN_EXCEL = "iaspor:excel-seen";

function excelSeenKey(file: File) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function loadExcelSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_EXCEL);
    const p = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function markExcelSeen(file: File) {
  const next = [excelSeenKey(file), ...loadExcelSeen().filter((k) => k !== excelSeenKey(file))].slice(0, 40);
  try {
    localStorage.setItem(SEEN_EXCEL, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function alreadyIngestedExcel(file: File) {
  return loadExcelSeen().includes(excelSeenKey(file));
}

export async function ingestCodigosFromFolder(dir: FileSystemDirectoryHandle) {
  const { extractOfficeText, kindOfFile } = await import("./office-text");
  const { collectMatchingFiles } = await import("./taller-folder");
  const files = await collectMatchingFiles(dir, (file) => isCodigosFileName(file.name), 8);
  let total = 0;
  const extracted: { file: File; text: string }[] = [];
  await Promise.all(
    files.map(async (file) => {
      if (alreadyIngestedExcel(file)) return;
      try {
        const kind = kindOfFile(file);
        const text =
          kind === "csv" ? await file.text() : kind ? await extractOfficeText(file) : await file.text();
        extracted.push({ file, text });
      } catch {
        /* xls binario: Drive cubre esos dos archivos */
      }
    }),
  );
  for (const { file, text } of extracted) {
    const n = ingestLocalCodes(file.name, text);
    if (n) {
      total += n;
      markExcelSeen(file);
    }
  }
  return { files: files.length, rows: total };
}
