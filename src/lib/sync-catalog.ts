import { BRANDS } from "./brands";
import { CATALOG, type CatalogDoc, type DocKind } from "./catalog";
import { publicUrl } from "./utils";

type RemoteDoc = {
  id?: string;
  brand?: string;
  brandId?: string;
  title?: string;
  model?: string;
  kind?: string;
  keywords?: string[];
  hint?: string;
  url?: string;
};

const KINDS: DocKind[] = ["esquema", "manual", "receptor", "central", "kit"];
const JINA = "https://r.jina.ai/";

const HOMES: Record<string, string> = {
  faac: "https://www.faac.es",
  nice: "https://www.niceforyou.com/es",
  came: "https://www.came.com/es",
  bft: "https://www.bft-automation.com/es-es",
  beninca: "https://www.beninca.com/es",
  erreka: "https://www.erreka.com/es",
  v2: "https://www.v2.es",
  motorline: "https://www.motorline.pt",
  pujol: "https://www.pujol.es",
  clemsa: "https://www.clemsa.es",
  cdvi: "https://www.cdvi.es",
  aprimatic: "https://www.aprimatic.es",
  visiotech: "https://www.visiotechsecurity.com",
  safire: "https://www.visiotechsecurity.com",
  nivian: "https://www.visiotechsecurity.com",
};

const LIVE_PAGES = [
  { brandId: "visiotech", url: "https://support.visiotechsecurity.com" },
  { brandId: "visiotech", url: "https://www.visiotechsecurity.com" },
  { brandId: "faac", url: "https://www.faac.es" },
];

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function mapKind(k: string | undefined): DocKind {
  if (k && (KINDS as string[]).includes(k)) return k as DocKind;
  return "manual";
}

function resolveBrandId(name: string | undefined) {
  if (!name) return undefined;
  const n = name.toLowerCase();
  return BRANDS.find(
    (b) =>
      b.id === n ||
      b.name.toLowerCase() === n ||
      b.aliases.some((a) => n.includes(a) || a.includes(n)),
  )?.id;
}

function toDoc(item: RemoteDoc, fallbackBrand = "faac"): CatalogDoc | null {
  const title = item.title?.trim();
  if (!title) return null;
  const brandId = item.brandId || resolveBrandId(item.brand) || fallbackBrand;
  const model = (item.model ?? title).slice(0, 80);
  const url = (item.url || HOMES[brandId] || "").slice(0, 400);
  if (url && !/^https?:\/\//i.test(url) && !url.startsWith("/")) return null;
  return {
    id: item.id || `sync-${brandId}-${slug(model || title)}`,
    brandId,
    title: title.slice(0, 160),
    model,
    kind: mapKind(item.kind),
    keywords: Array.isArray(item.keywords)
      ? item.keywords.map((k) => String(k).slice(0, 40)).slice(0, 8)
      : [model],
    hint: (item.hint ?? "Ficha de catálogo.").slice(0, 220),
    url: url || undefined,
    synced: true,
  };
}

function bundled(): CatalogDoc[] {
  const extras: CatalogDoc[] = [
    {
      id: "sync-faac-catalogo-2025",
      brandId: "faac",
      title: "Catálogo general FAAC 2025",
      model: "Catálogo 2025",
      kind: "manual",
      keywords: ["faac", "catalogo", "2025"],
      hint: "Catálogo general FAAC incluido en IASPOR.",
      url: publicUrl("catalogos/faac-2025.pdf"),
      synced: true,
    },
    {
      id: "sync-aprimatic-catalogo-2026",
      brandId: "aprimatic",
      title: "Catálogo Aprimatic 2026",
      model: "Catálogo 2026",
      kind: "manual",
      keywords: ["aprimatic", "catalogo", "2026"],
      hint: "Catálogo Aprimatic incluido en IASPOR.",
      url: publicUrl("catalogos/aprimatic-2026.pdf"),
      synced: true,
    },
  ];
  return [
    ...CATALOG.map((d) => ({
      ...d,
      synced: true,
      url: d.url || HOMES[d.brandId],
    })),
    ...extras,
  ];
}

async function fetchJsonDocs(url: string): Promise<CatalogDoc[]> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = (await res.json()) as RemoteDoc[] | { docs?: RemoteDoc[] };
  const rows = Array.isArray(data) ? data : data.docs;
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => toDoc(row)).filter((d): d is CatalogDoc => Boolean(d));
}

function parseMarkdownLinks(md: string, brandId: string): CatalogDoc[] {
  const docs: CatalogDoc[] = [];
  const re = /\[([^\]]{3,80})\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const title = m[1].replace(/\s+/g, " ").trim();
    const url = m[2].split(" ")[0];
    if (!/manual|ficha|datasheet|pdf|soporte|support|download|descarga/i.test(`${title} ${url}`)) {
      continue;
    }
    const doc = toDoc({ title, url, brandId, kind: /esquema|wiring/i.test(title) ? "esquema" : "manual" }, brandId);
    if (doc) docs.push(doc);
    if (docs.length >= 10) break;
  }
  return docs;
}

async function pullLive(brandId: string, page: string): Promise<CatalogDoc[]> {
  const res = await fetch(`${JINA}${page}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const text = await res.text();
  return parseMarkdownLinks(text, brandId);
}

export async function syncRemoteCatalog(): Promise<
  { ok: true; docs: CatalogDoc[] } | { ok: false; error: string }
> {
  const byId = new Map<string, CatalogDoc>();
  const add = (doc: CatalogDoc) => {
    if (!byId.has(doc.id)) byId.set(doc.id, doc);
  };

  for (const doc of bundled()) add(doc);

  try {
    const packed = await fetchJsonDocs(`${publicUrl("catalogos/remote.json")}?t=${Date.now()}`);
    packed.forEach(add);
  } catch {
    /* usa el catálogo incluido */
  }

  const live = await Promise.allSettled(
    LIVE_PAGES.map((p) => pullLive(p.brandId, p.url)),
  );
  for (const result of live) {
    if (result.status === "fulfilled") result.value.forEach(add);
  }

  const docs = [...byId.values()].slice(0, 80);
  if (!docs.length) return { ok: false, error: "No se pudo actualizar el catálogo." };
  return { ok: true, docs };
}
