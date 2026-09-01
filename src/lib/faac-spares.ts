import { createServerFn } from "@tanstack/react-start";

const BASE = "https://spareparts.faacgroup.com/accessautomation/spareparts";
export const FAAC_SPARES_HOME = `${BASE}/faac?lang=en-US`;

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
  "414",
  "415",
  "S418",
  "391",
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

async function drawingUrlForGroup(groupId: number) {
  try {
    const res = await fetch(`${BASE}/group/card/${groupId}`, {
      headers: { "User-Agent": "ASPOR-AI/1.0 (manual technician catalog)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/drawingPage\/(\d+)/);
    return match ? `${BASE}/drawingPage/${match[1]}` : null;
  } catch {
    return null;
  }
}

export const searchFaacSpares = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => {
    const query = input.query.trim().slice(0, 80);
    if (query.length < 2) throw new Error("Indica modelo o código FAAC");
    return { query };
  })
  .handler(async ({ data }) => {
    const q = data.query.replace(/\s+/g, " ");
    const url = `${BASE}/searchJson?query=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ASPOR-AI/1.0 (manual technician catalog)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { ok: false as const, error: `Catálogo FAAC no disponible (${res.status})` };
    }
    let rows: Remote[] = [];
    try {
      rows = (await res.json()) as Remote[];
    } catch {
      return { ok: false as const, error: "No se pudo leer el catálogo de recambios." };
    }
    if (!Array.isArray(rows)) {
      return { ok: false as const, error: "Respuesta inesperada del catálogo FAAC." };
    }

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

    const drawings = await Promise.all(
      hits
        .filter((h) => h.kind === "despiece")
        .slice(0, 8)
        .map(async (h) => [h.id, await drawingUrlForGroup(h.id)] as const),
    );
    const drawingMap = new Map(drawings);
    for (const hit of hits) {
      if (hit.kind !== "despiece") continue;
      const drawing = drawingMap.get(hit.id);
      if (drawing) {
        hit.url = drawing;
        const m = drawing.match(/drawingPage\/(\d+)/);
        if (m) hit.drawingId = Number(m[1]);
      }
    }

    const order: Record<SpareKind, number> = { despiece: 0, familia: 1, recambio: 2 };
    hits.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
    return { ok: true as const, hits: hits.slice(0, 40) };
  });

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
    return `<g data-pos="${pos}" class="faac-hotspot"${cleaned}>${inner}</g>`;
  });
  return svg;
}

function drawingTitle(html: string) {
  const m = html.match(/>\s*([^<]+?)\s*-\s*Clicca sulla posizione/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "Despiece FAAC";
}

export const fetchFaacDrawing = createServerFn({ method: "POST" })
  .validator((input: { drawingId: number }) => {
    const drawingId = Number(input.drawingId);
    if (!Number.isInteger(drawingId) || drawingId < 1) throw new Error("Despiece no válido");
    return { drawingId };
  })
  .handler(async ({ data }) => {
    const id = data.drawingId;
    try {
      const [pageRes, partsRes] = await Promise.all([
        fetch(`${BASE}/drawingPage/${id}`, {
          headers: { "User-Agent": "IASPOR/1.0 (manual technician catalog)" },
          signal: AbortSignal.timeout(18_000),
        }),
        fetch(`${BASE}/parts/${id}`, {
          headers: {
            Accept: "application/json",
            "User-Agent": "IASPOR/1.0 (manual technician catalog)",
          },
          signal: AbortSignal.timeout(12_000),
        }),
      ]);
      if (!pageRes.ok) {
        return { ok: false as const, error: `No se pudo abrir el esquema (${pageRes.status})` };
      }
      const html = await pageRes.text();
      const svg = extractDrawingSvg(html);
      if (!svg) return { ok: false as const, error: "El despiece no trae esquema." };
      let parts: DrawingPart[] = [];
      if (partsRes.ok) {
        const body = (await partsRes.json()) as {
          data?: {
            id?: number;
            code?: string;
            name?: string;
            position?: string | number;
            quantity?: number;
            ean?: string;
            substitutive_code?: string;
          }[];
        };
        parts = (body.data ?? []).map((p) => ({
          id: Number(p.id) || 0,
          pos: String(p.position ?? "").trim(),
          code: String(p.code ?? "").trim(),
          name: String(p.name ?? "Recambio FAAC").trim().slice(0, 180),
          qty: Math.max(1, Number(p.quantity) || 1),
          ean: String(p.ean ?? "").trim(),
          altCode: String(p.substitutive_code ?? "").trim(),
        }));
      }
      if (parts.length === 0) {
        return { ok: false as const, error: "Sin piezas en este esquema." };
      }
      return {
        ok: true as const,
        title: drawingTitle(html),
        svg,
        parts,
        url: `${BASE}/drawingPage/${id}`,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/abort|timeout/i.test(msg)) {
        return { ok: false as const, error: "El esquema tardó demasiado." };
      }
      return { ok: false as const, error: "No se pudo cargar el despiece." };
    }
  });

