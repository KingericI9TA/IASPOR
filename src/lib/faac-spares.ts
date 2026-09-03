import { createServerFn } from "@tanstack/react-start";
import { isStaticHost } from "@/lib/static-host";
import { publicUrl } from "@/lib/utils";

const BASE = "https://spareparts.faacgroup.com/accessautomation/spareparts";
export const FAAC_SPARES_HOME = `${BASE}/faac?lang=en-US`;
const JINA = "https://r.jina.ai/";

export type SpareKind = "despiece" | "recambio" | "familia";

export type SpareHit = {
  id: number;
  kind: SpareKind;
  code: string;
  name: string;
  url: string;
  drawingId?: number;
};

export type DrawingPart = {
  id: number;
  pos: string;
  code: string;
  name: string;
  qty: number;
  ean: string;
  altCode: string;
};

export type SpareSearchResult =
  | { ok: true; hits: SpareHit[] }
  | { ok: false; error: string };

export type DrawingResult =
  | { ok: true; title: string; svg: string | null; parts: DrawingPart[]; url: string }
  | { ok: false; error: string };

export const FAAC_FAMILIES: { id: number; name: string }[] = [
  { id: 85, name: "Cancelas batientes" },
  { id: 87, name: "Cancelas correderas" },
  { id: 89, name: "Puertas de garaje" },
  { id: 91, name: "Puertas industriales" },
  { id: 93, name: "Puertas plegables" },
  { id: 94, name: "Persianas enrollables" },
  { id: 95, name: "Puertas automáticas" },
  { id: 96, name: "Barreras" },
  { id: 98, name: "Accesorios y electrónica" },
  { id: 99, name: "Bolardos" },
  { id: 100, name: "Automatismos de shutter" },
  { id: 102, name: "Control de acceso" },
];

export const FAAC_MODELS = [
  "400",
  "401",
  "413",
  "414",
  "415",
  "S418",
  "391",
  "560",
  "740",
  "741",
  "C720",
  "C721",
  "844",
  "E024S",
  "455",
  "620",
  "640",
  "615",
];

type Remote = {
  id?: number;
  type?: string;
  name?: string;
  fullname?: string;
  import_code?: string;
};

type GetText = (url: string) => Promise<string>;

function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function nameMatchesModel(name: string, query: string) {
  const nameTokens = tokens(name);
  const queryTokens = tokens(query);
  if (queryTokens.length === 0 || nameTokens.length === 0) return false;
  return queryTokens.every((qt) => nameTokens.includes(qt));
}

function kindOf(type: string | undefined): SpareKind {
  if (type === "gruppi") return "despiece";
  if (type === "categorie") return "familia";
  return "recambio";
}

function itemUrl(row: Remote, kind: SpareKind) {
  const id = row.id;
  if (kind === "despiece" && id) return `${BASE}/group/card/${id}`;
  if (kind === "familia" && id) {
    const known = FAAC_FAMILIES.some((f) => f.id === id);
    return known
      ? `${BASE}/category/${id}`
      : `${BASE}/search?query=${encodeURIComponent(row.name || String(id))}`;
  }
  const q = encodeURIComponent(String(row.import_code || row.name || "").trim());
  return `${BASE}/search?query=${q}`;
}

export function familyUrl(id: number) {
  return `${BASE}/category/${id}`;
}

export function drawingPageUrl(drawingId: number) {
  return `${BASE}/drawingPage/${drawingId}`;
}

function unwrapReader(text: string) {
  const t = text.trim();
  if (!t) return t;
  if (t.startsWith("{") || t.startsWith("[")) return t;
  const marker = "Markdown Content:";
  const i = t.indexOf(marker);
  if (i >= 0) return t.slice(i + marker.length).trim();
  return t;
}

function parseJsonPayload(text: string) {
  const raw = unwrapReader(text);
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.search(/[\[{]/);
    const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("No se pudo leer el catálogo de recambios.");
  }
}

function faacError(e: unknown, fallback: string) {
  const msg = e instanceof Error ? e.message : "";
  if (/429|rate limit/i.test(msg)) return "FAAC ocupado. Prueba en unos segundos.";
  if (/abort|timeout/i.test(msg)) return "El catálogo tardó demasiado.";
  if (/invariant failed|content-type|failed to fetch|networkerror|load failed/i.test(msg)) {
    return fallback;
  }
  return msg || fallback;
}

async function serverGet(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "IASPOR/1.0 (manual technician catalog)" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Catálogo FAAC no disponible (${res.status})`);
  return res.text();
}

async function fetchViaCors(url: string, ms: number) {
  const sources = [url, `https://proxy.cors.sh/${url}`, `https://proxy.corsfix.com/?${url}`];
  try {
    return await Promise.any(
      sources.map(async (src) => {
        const res = await fetch(src, { redirect: "follow", signal: AbortSignal.timeout(ms) });
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        if (!text) throw new Error("empty");
        return text;
      }),
    );
  } catch {
    return null;
  }
}

async function browserGet(url: string) {
  if (/\/drawingPage\//.test(url)) {
    const text = await fetchViaCors(url, 25_000);
    if (text && /<svg\b/i.test(text)) return text;
    throw new Error("No se pudo cargar el esquema.");
  }
  if (!isStaticHost()) {
    try {
      const direct = await fetch(url, { signal: AbortSignal.timeout(4_000) });
      if (direct.ok) return await direct.text();
    } catch {
      /* CORS */
    }
  }
  const jsonLike = /searchJson|\/parts\//.test(url);
  const res = await fetch(`${JINA}${url}`, {
    headers: jsonLike
      ? { "X-Return-Format": "text", "X-Locale": "it-IT", "Accept-Language": "it" }
      : { "X-Locale": "it-IT", "Accept-Language": "it" },
    signal: AbortSignal.timeout(18_000),
  });
  if (res.status === 429) throw new Error("FAAC ocupado. Prueba en unos segundos.");
  if (!res.ok) throw new Error(`Catálogo FAAC no disponible (${res.status})`);
  return unwrapReader(await res.text());
}

function hitsFromRows(rows: Remote[], q: string): SpareHit[] {
  const hits: SpareHit[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row.id !== "number") continue;
    const kind = kindOf(row.type);
    const name = (row.name || row.fullname || "Recambio FAAC").trim().slice(0, 160);
    if ((kind === "despiece" || kind === "familia") && !nameMatchesModel(name, q)) {
      continue;
    }
    const code = String(row.import_code ?? "").trim();
    const key = `${kind}-${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      id: row.id,
      kind,
      code,
      name,
      url: itemUrl(row, kind),
    });
  }
  const order: Record<SpareKind, number> = { despiece: 0, familia: 1, recambio: 2 };
  hits.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
  return hits.slice(0, 40);
}

async function attachDrawings(hits: SpareHit[], getText: GetText) {
  const drawings = await Promise.all(
    hits
      .filter((h) => h.kind === "despiece")
      .slice(0, 8)
      .map(async (h) => [h.id, await drawingIdFromGroup(h.id, getText)] as const),
  );
  const drawingMap = new Map(drawings);
  for (const hit of hits) {
    if (hit.kind !== "despiece") continue;
    const id = drawingMap.get(hit.id);
    if (id) {
      hit.drawingId = id;
      hit.url = drawingPageUrl(id);
    }
  }
}

async function drawingIdFromGroup(groupId: number, getText: GetText) {
  try {
    const html = await getText(`${BASE}/group/card/${groupId}`);
    const match = html.match(/drawingPage\/(\d+)/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

async function searchWith(query: string, getText: GetText, withDrawings: boolean): Promise<SpareSearchResult> {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 80);
  if (q.length < 2) return { ok: false, error: "Indica modelo o código FAAC" };
  try {
    const raw = await getText(`${BASE}/searchJson?query=${encodeURIComponent(q)}`);
    const rows = parseJsonPayload(raw) as Remote[];
    if (!Array.isArray(rows)) {
      return { ok: false, error: "Respuesta inesperada del catálogo FAAC." };
    }
    const hits = hitsFromRows(rows, q);
    if (withDrawings) await attachDrawings(hits, getText);
    return { ok: true, hits };
  } catch (e) {
    return { ok: false, error: faacError(e, "No se pudo consultar FAAC") };
  }
}

function extractDrawingSvg(html: string) {
  const match = html.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (!match) return null;
  let svg = match[0];
  svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  svg = svg.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_all, attrs: string, inner: string) => {
    const pos = /data-custom\s*=\s*["']?(\d+)/i.exec(attrs)?.[1] ?? "";
    const cleaned = attrs.replace(
      /\s(?:href|xlink:href|target|rel)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      "",
    );
    const padded = inner.replace(
      /<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"/i,
      (_r, x: string, y: string, w: string, h: string) => {
        const pad = 40;
        return `<rect class="faac-hit" x="${Number(x) - pad}" y="${Number(y) - pad}" width="${Number(w) + pad * 2}" height="${Number(h) + pad * 2}"`;
      },
    );
    return `<g data-pos="${pos}" class="faac-hotspot"${cleaned}>${padded}</g>`;
  });
  return svg;
}

function drawingTitle(html: string) {
  const m = html.match(/>\s*([^<]+?)\s*-\s*Clicca sulla posizione/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "Despiece FAAC";
}

function partsFromJson(body: {
  data?: {
    id?: number;
    code?: string;
    name?: string;
    position?: string | number;
    quantity?: number;
    ean?: string;
    substitutive_code?: string;
  }[];
}): DrawingPart[] {
  return (body.data ?? []).map((p) => ({
    id: Number(p.id) || 0,
    pos: String(p.position ?? "").trim(),
    code: String(p.code ?? "").trim(),
    name: String(p.name ?? "Recambio FAAC").trim().slice(0, 180),
    qty: Math.max(1, Number(p.quantity) || 1),
    ean: String(p.ean ?? "").trim(),
    altCode: String(p.substitutive_code ?? "").trim(),
  }));
}

async function drawingWith(drawingId: number, getText: GetText): Promise<DrawingResult> {
  const id = drawingId;
  const url = drawingPageUrl(id);
  try {
    const [pageText, partsText] = await Promise.all([
      getText(url).catch(() => ""),
      getText(`${BASE}/parts/${id}`),
    ]);
    const svg = pageText ? extractDrawingSvg(pageText) : null;
    let parts: DrawingPart[] = [];
    try {
      parts = partsFromJson(parseJsonPayload(partsText));
    } catch {
      parts = [];
    }
    if (!svg && parts.length === 0) {
      return { ok: false, error: "Sin piezas en este esquema." };
    }
    return {
      ok: true,
      title: pageText ? drawingTitle(pageText) : "Despiece FAAC",
      svg,
      parts,
      url,
    };
  } catch (e) {
    return { ok: false, error: faacError(e, "No se pudo cargar el despiece.") };
  }
}

export const searchFaacSpares = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => {
    const query = input.query.trim().slice(0, 80);
    if (query.length < 2) throw new Error("Indica modelo o código FAAC");
    return { query };
  })
  .handler(async ({ data }) => searchWith(data.query, serverGet, true));

export const fetchFaacDrawing = createServerFn({ method: "POST" })
  .validator((input: { drawingId: number }) => {
    const drawingId = Number(input.drawingId);
    if (!Number.isInteger(drawingId) || drawingId < 1) throw new Error("Despiece no válido");
    return { drawingId };
  })
  .handler(async ({ data }) => drawingWith(data.drawingId, serverGet));

const SPARE_CACHE = "iaspor:faac-spares-cache";
const SPARE_RECENTS = "iaspor:faac-spares-recents";
const CACHE_MS = 12 * 60 * 60 * 1000;

type SpareCacheFile = { q: string; at: number; hits: SpareHit[] };

function cacheKey(q: string) {
  return q.toLowerCase().replace(/\s+/g, " ").trim();
}

export function loadSpareRecents(): string[] {
  try {
    const raw = localStorage.getItem(SPARE_RECENTS);
    if (!raw) return [];
    const p = JSON.parse(raw) as string[];
    return Array.isArray(p) ? p.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function bumpSpareRecent(q: string) {
  const next = [q, ...loadSpareRecents().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  localStorage.setItem(SPARE_RECENTS, JSON.stringify(next));
}

export function readSpareCache(query: string): { hits: SpareHit[]; at: number } | null {
  try {
    const raw = localStorage.getItem(SPARE_CACHE);
    if (!raw) return null;
    const list = JSON.parse(raw) as SpareCacheFile[];
    const hit = list.find((x) => x.q === cacheKey(query));
    if (!hit || Date.now() - hit.at > CACHE_MS) return null;
    return { hits: hit.hits, at: hit.at };
  } catch {
    return null;
  }
}

function writeSpareCache(query: string, hits: SpareHit[]) {
  try {
    const raw = localStorage.getItem(SPARE_CACHE);
    const list: SpareCacheFile[] = raw ? (JSON.parse(raw) as SpareCacheFile[]) : [];
    const q = cacheKey(query);
    const next = [{ q, at: Date.now(), hits }, ...list.filter((x) => x.q !== q)].slice(0, 24);
    localStorage.setItem(SPARE_CACHE, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export async function queryFaacSpares(query: string): Promise<SpareSearchResult> {
  const q = query.replace(/\s+/g, " ").trim();
  const run = async (): Promise<SpareSearchResult> => {
    if (typeof window !== "undefined" && isStaticHost()) {
      return searchWith(q, browserGet, false);
    }
    try {
      return await searchFaacSpares({ data: { query: q } });
    } catch (e) {
      const fallback = await searchWith(q, browserGet, false);
      if (fallback.ok) return fallback;
      return { ok: false, error: faacError(e, fallback.error) };
    }
  };
  const res = await run();
  if (res.ok && res.hits.length) {
    writeSpareCache(q, res.hits);
    bumpSpareRecent(q);
  }
  return res;
}

export async function loadFaacDrawing(drawingId: number): Promise<DrawingResult> {
  if (typeof window !== "undefined" && isStaticHost()) {
    const bundled = await loadBundledDrawing(drawingId);
    if (bundled) return bundled;
    return drawingWith(drawingId, browserGet);
  }
  try {
    return await fetchFaacDrawing({ data: { drawingId } });
  } catch {
    const bundled = await loadBundledDrawing(drawingId);
    if (bundled) return bundled;
    return drawingWith(drawingId, browserGet);
  }
}

type DrawingIndex = Record<string, { title?: string }>;
let drawingIndex: DrawingIndex | null = null;
let drawingIndexTried = false;

async function loadDrawingIndex(): Promise<DrawingIndex> {
  if (drawingIndex) return drawingIndex;
  if (drawingIndexTried) return {};
  drawingIndexTried = true;
  try {
    const res = await fetch(publicUrl(`faac-drawings/index.json?v=${Date.now().toString(36)}`));
    if (!res.ok) return {};
    drawingIndex = (await res.json()) as DrawingIndex;
    return drawingIndex ?? {};
  } catch {
    return {};
  }
}

async function gunzipText(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  const gzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzipped) return new TextDecoder().decode(bytes);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este teléfono no puede leer el esquema empaquetado.");
  }
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

async function loadBundledDrawing(drawingId: number): Promise<DrawingResult | null> {
  try {
    const index = await loadDrawingIndex();
    const meta = index[String(drawingId)];
    if (!meta) return null;
    const [svgRes, partsText] = await Promise.all([
      fetch(publicUrl(`faac-drawings/${drawingId}.svg.gz`)),
      browserGet(`${BASE}/parts/${drawingId}`).catch(() => ""),
    ]);
    if (!svgRes.ok) return null;
    const raw = await gunzipText(await svgRes.arrayBuffer());
    const svg = extractDrawingSvg(raw);
    if (!svg) return null;
    let parts: DrawingPart[] = [];
    if (partsText) {
      try {
        parts = partsFromJson(parseJsonPayload(partsText));
      } catch {
        parts = [];
      }
    }
    return {
      ok: true,
      title: meta.title || drawingTitle(raw),
      svg,
      parts,
      url: drawingPageUrl(drawingId),
    };
  } catch {
    return null;
  }
}

export async function resolveFaacDrawingId(groupId: number): Promise<number | null> {
  return drawingIdFromGroup(groupId, browserGet);
}
