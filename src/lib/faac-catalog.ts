import pages from "./faac-catalog-pages.json";

export const FAAC_CATALOG_ID = "1U7go0gu7qpVPJwSmxiCKMHphPt86aLw-";
export const FAAC_CATALOG_VIEW = `https://drive.google.com/file/d/${FAAC_CATALOG_ID}/view?usp=drivesdk`;
export const FAAC_CATALOG_PDF = "/catalogos/faac-2025.pdf";
export const FAAC_CATALOG_TITLE = "Catálogo general FAAC 2025";

export function faacCatalogPageUrl(pdfPage: number) {
  return `${FAAC_CATALOG_PDF}#page=${pdfPage}`;
}


export type FaacCatalogHit = {
  page: number;
  print: number;
  title: string;
  snippet: string;
  score: number;
};

type Page = { page: number; print: number; title: string; text: string };

const INDEX = pages as Page[];

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleanFaacTitle(title: string) {
  return title.replace(/\s*Tensi\w*$/i, "").replace(/\s+/g, " ").trim();
}

function snippetAround(text: string, query: string) {
  const q = query.trim();
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 180).trim();
  const from = Math.max(0, i - 50);
  const slice = text.slice(from, i + q.length + 110).trim();
  return `${from > 0 ? "…" : ""}${slice}…`;
}

export function searchFaacCatalog(query: string, limit = 24): FaacCatalogHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = q.split(" ").filter((w) => w.length > 1);
  return INDEX.map((p) => {
    const title = cleanFaacTitle(p.title);
    const hay = norm(`${title} ${p.text}`);
    let score = 0;
    if (hay.includes(q)) score += 55;
    if (norm(title).includes(q)) score += 40;
    score += words.filter((w) => hay.includes(w)).length * 14;
    if (words.length > 1 && words.every((w) => hay.includes(w))) score += 20;
    return {
      page: p.page,
      print: p.print,
      title,
      snippet: snippetAround(p.text, query.trim()),
      score,
    };
  })
    .filter((h) => h.score >= 14)
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, limit);
}
