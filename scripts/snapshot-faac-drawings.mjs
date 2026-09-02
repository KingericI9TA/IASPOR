import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://spareparts.faacgroup.com/accessautomation/spareparts";
const UA = "IASPOR/1.0 (manual technician catalog)";
const MODELS = [
  "746",
  "413",
  "560",
  "740",
  "741",
  "844",
  "C720",
  "C721",
  "E024S",
  "400",
  "414",
  "415",
  "S418",
  "391",
  "455",
  "620",
  "640",
  "615",
  "390",
  "402",
  "412",
  "770",
  "760",
  "580",
  "884",
  "S450",
  "610",
];
const MAX_DRAWINGS = 64;
const MAX_PER_MODEL = 4;
const BUDGET_MS = 200_000;

function tokens(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function nameMatches(name, query) {
  const nt = tokens(name);
  const qt = tokens(query);
  return qt.length > 0 && qt.every((t) => nt.includes(t));
}

async function getText(url, ms = 18_000) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function searchModel(query) {
  const raw = await getText(`${BASE}/searchJson?query=${encodeURIComponent(query)}`, 15_000);
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row?.type === "gruppi" && nameMatches(row.name || "", query));
}

function drawingIdFromGroupHtml(html) {
  const m = html.match(/drawingPage\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function extractSvg(html) {
  const m = html.match(/<svg\b[\s\S]*?<\/svg>/i);
  return m ? m[0] : null;
}

function drawingTitle(html, fallback) {
  const m = html.match(/>\s*([^<]+?)\s*-\s*Clicca sulla posizione/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : fallback;
}

async function pool(items, limit, worker) {
  const out = [];
  let i = 0;
  async function run() {
    while (i < items.length) {
      const cur = items[i++];
      out.push(await worker(cur));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

export async function snapshotFaacDrawings(outDir) {
  const started = Date.now();
  const dest = join(outDir, "faac-drawings");
  mkdirSync(dest, { recursive: true });

  const groups = [];
  const seenGroup = new Set();
  for (const model of MODELS) {
    if (Date.now() - started > BUDGET_MS) break;
    if (groups.length >= MAX_DRAWINGS) break;
    try {
      const hits = await searchModel(model);
      let n = 0;
      for (const hit of hits) {
        if (seenGroup.has(hit.id)) continue;
        seenGroup.add(hit.id);
        groups.push({ groupId: hit.id, name: String(hit.name || model).trim(), model });
        n += 1;
        if (n >= MAX_PER_MODEL || groups.length >= MAX_DRAWINGS) break;
      }
      console.log(`[faac-drawings] ${model}: ${n} despieces`);
    } catch (err) {
      console.warn(`[faac-drawings] búsqueda ${model}:`, err instanceof Error ? err.message : err);
    }
  }

  const index = {};
  await pool(groups, 4, async (group) => {
    if (Date.now() - started > BUDGET_MS) return;
    try {
      const card = await getText(`${BASE}/group/card/${group.groupId}`, 12_000);
      const drawingId = drawingIdFromGroupHtml(card);
      if (!drawingId) return;
      const page = await getText(`${BASE}/drawingPage/${drawingId}`, 20_000);
      const svg = extractSvg(page);
      if (!svg || !/data-custom/i.test(svg)) return;
      const gz = gzipSync(Buffer.from(svg), { level: 9 });
      writeFileSync(join(dest, `${drawingId}.svg.gz`), gz);
      index[String(drawingId)] = {
        title: drawingTitle(page, group.name),
        groupId: group.groupId,
        model: group.model,
      };
      console.log(`[faac-drawings] ${drawingId} ${group.name} ${gz.length}b`);
    } catch (err) {
      console.warn(`[faac-drawings] ${group.name}:`, err instanceof Error ? err.message : err);
    }
  });

  writeFileSync(join(dest, "index.json"), JSON.stringify(index));
  console.log(`[faac-drawings] ${Object.keys(index).length} esquemas en ${Date.now() - started}ms`);
  return index;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dest = process.argv[2] || "/tmp/faac-drawings-out";
  await snapshotFaacDrawings(dest);
}
