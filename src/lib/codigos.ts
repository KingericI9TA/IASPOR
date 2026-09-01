import { createServerFn } from "@tanstack/react-start";
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

export const CODE_SOURCES: CodeSource[] = [
  {
    id: "a",
    name: "Códigos (archivo 1)",
    sheetId: "1HR_xZnUQiSfCQtJp1_3ChJLwfF48ab9C",
  },
  {
    id: "b",
    name: "Códigos hasta 99",
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
  const rows = lines.slice(1, 4000).map((cols) => {
    const values: Record<string, string> = {};
    headers.forEach((h, idx) => {
      values[h] = cols[idx] ?? "";
    });
    return values;
  });
  return { headers, rows };
}

const LOCAL_KEY = "iaspor:codigos-local";

type LocalTable = { name: string; headers: string[]; rows: Record<string, string>[] };

export function ingestLocalCodes(fileName: string, text: string) {
  const parsed = parseCsv(text);
  if (parsed.rows.length === 0) return parsed.rows.length;
  const tables: LocalTable[] = loadLocalTables().filter((t) => t.name !== fileName);
  tables.unshift({ name: fileName.slice(0, 80), headers: parsed.headers, rows: parsed.rows });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(tables.slice(0, 6)));
  return parsed.rows.length;
}

function loadLocalTables(): LocalTable[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as LocalTable[];
    return Array.isArray(p) ? p : [];
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
      rows.push({ sourceId: "local", sourceName: t.name, values });
    }
  }
  return { headers, rows };
}

export function searchCodeRows(
  rows: CodeRow[],
  query: string,
  field: string,
  sourceId: "all" | "a" | "b" | "local",
) {
  const q = normalize(query);
  if (!q) return [];
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

export const fetchCodeTables = createServerFn({ method: "POST" }).handler(async () => {
  const tables: {
    sourceId: "a" | "b";
    sourceName: string;
    headers: string[];
    rows: CodeRow[];
    error?: string;
  }[] = [];

  for (const source of CODE_SOURCES) {
    try {
      const res = await fetch(csvUrl(source.sheetId, source.gid), {
        headers: { "User-Agent": "ASPOR-IA/1.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 401 || res.status === 403) {
        tables.push({
          sourceId: source.id,
          sourceName: source.name,
          headers: [],
          rows: [],
          error:
            "El archivo es privado. En Drive: Compartir → Cualquiera con el enlace → Lector.",
        });
        continue;
      }
      if (!res.ok) {
        tables.push({
          sourceId: source.id,
          sourceName: source.name,
          headers: [],
          rows: [],
          error: `No se pudo abrir (${res.status}).`,
        });
        continue;
      }
      const text = await res.text();
      if (/<!doctype html/i.test(text.slice(0, 120)) || /accounts\.google/i.test(text.slice(0, 400))) {
        tables.push({
          sourceId: source.id,
          sourceName: source.name,
          headers: [],
          rows: [],
          error:
            "Google pide inicio de sesión. Comparte la hoja: Cualquiera con el enlace → Lector.",
        });
        continue;
      }
      const parsed = parseCsv(text);
      const disp = res.headers.get("content-disposition") ?? "";
      const star = disp.match(/filename\*=UTF-8''([^;]+)/i);
      const plain = disp.match(/filename="([^"]+)"/i);
      const file = decodeURIComponent((star?.[1] || plain?.[1] || "").replace(/\+/g, " "));
      const sourceName = file
        ? file.replace(/\.csv$/i, "").replace(/\.xls[xm]?$/i, "").slice(0, 80)
        : source.name;
      tables.push({
        sourceId: source.id,
        sourceName,
        headers: parsed.headers,
        rows: parsed.rows.map((values) => ({
          sourceId: source.id,
          sourceName,
          values,
        })),
      });
    } catch {
      tables.push({
        sourceId: source.id,
        sourceName: source.name,
        headers: [],
        rows: [],
        error: "Tiempo de espera o red al leer Drive.",
      });
    }
  }

  return { ok: true as const, tables };
});
