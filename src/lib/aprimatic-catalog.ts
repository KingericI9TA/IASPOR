import pages from "./aprimatic-catalog-pages.json";
import { type FaacCatalogHit } from "@/lib/faac-catalog";

export const APRIMATIC_CATALOG_ID = "1-JhfpHRzVdWtEP9YOzQut9Hb6wTtxhIQ";
export const APRIMATIC_CATALOG_VIEW = `https://drive.google.com/file/d/${APRIMATIC_CATALOG_ID}/view?usp=drivesdk`;
export const APRIMATIC_CATALOG_PDF = "/catalogos/aprimatic-2026.pdf";
export const APRIMATIC_CATALOG_TITLE = "Catálogo Aprimatic 2026";

export type CatalogHit = FaacCatalogHit;

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

function snippetAround(text: string, query: string) {
  const q = query.trim();
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text.slice(0, 180).trim();
  const from = Math.max(0, i - 50);
  const slice = text.slice(from, i + q.length + 110).trim();
  return `${from > 0 ? "…" : ""}${slice}…`;
}

export function searchAprimaticCatalog(query: string, limit = 24): CatalogHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = q.split(" ").filter((w) => w.length > 1);
  return INDEX.map((p) => {
    const hay = norm(`${p.title} ${p.text}`);
    let score = 0;
    if (hay.includes(q)) score += 55;
    if (norm(p.title).includes(q)) score += 40;
    score += words.filter((w) => hay.includes(w)).length * 14;
    if (words.length > 1 && words.every((w) => hay.includes(w))) score += 20;
    return {
      page: p.page,
      print: p.print,
      title: p.title.replace(/\s+/g, " ").trim(),
      snippet: snippetAround(p.text, query.trim()),
      score,
    };
  })
    .filter((h) => h.score >= 14)
    .sort((a, b) => b.score - a.score || a.page - b.page)
    .slice(0, limit);
}

export type ComparePeer = { brand: string; model: string; query?: string };

export const APRIMATIC_COMPARE: {
  family: string;
  aprimatic: string;
  hint: string;
  query: string;
  others: ComparePeer[];
}[] = [
  {
    family: "Batiente 24 V",
    aprimatic: "XT 424B / XT 524B",
    hint: "Hasta 2,5–4,5 m · residencial/comunitario",
    query: "XT 424B",
    others: [
      { brand: "FAAC", model: "415 L 24V / 413", query: "415" },
      { brand: "Nice", model: "Wingo 2024" },
      { brand: "CAME", model: "AXO" },
      { brand: "BFT", model: "Phobos BT" },
    ],
  },
  {
    family: "Batiente 230 V",
    aprimatic: "XT 2500 / R 223",
    hint: "Electromecánico de vástago · 2–2,5 m",
    query: "XT 2500",
    others: [
      { brand: "FAAC", model: "402 / 412 / 414", query: "412" },
      { brand: "Nice", model: "Toona / Pop" },
      { brand: "CAME", model: "ATI / VER" },
      { brand: "BFT", model: "Kronos" },
    ],
  },
  {
    family: "Batiente hidráulico",
    aprimatic: "FORTY 270 / 390 · SR 350",
    hint: "Uso intensivo · hojas pesadas",
    query: "FORTY",
    others: [
      { brand: "FAAC", model: "400 / 401", query: "401" },
      { brand: "Nice", model: "Hyppo" },
      { brand: "CAME", model: "Frog / A1824" },
      { brand: "BFT", model: "P7 / P4.5" },
    ],
  },
  {
    family: "Basculante",
    aprimatic: "ALZO 55 · COVER 24E",
    hint: "Torsión / eje · puertas de garaje",
    query: "ALZO 55",
    others: [
      { brand: "FAAC", model: "541 / 540", query: "541" },
      { brand: "Nice", model: "Spinbus / Ten" },
      { brand: "CAME", model: "VER / EMEGA" },
      { brand: "BFT", model: "Botticelli" },
    ],
  },
  {
    family: "Corredera 24 V",
    aprimatic: "ONDA 724 / 1024",
    hint: "Residencial · autorreverse",
    query: "ONDA 724",
    others: [
      { brand: "FAAC", model: "C720 / C721", query: "C720" },
      { brand: "Nice", model: "Robus 400/600" },
      { brand: "CAME", model: "BXV" },
      { brand: "BFT", model: "Deimos Ultra" },
    ],
  },
  {
    family: "Corredera 230 V",
    aprimatic: "AT 800 / 1800 / 2000T",
    hint: "Comunitario e industrial",
    query: "AT 800",
    others: [
      { brand: "FAAC", model: "740 / 844", query: "740" },
      { brand: "Nice", model: "Road / Robus 1000" },
      { brand: "CAME", model: "BK" },
      { brand: "BFT", model: "Ares" },
    ],
  },
  {
    family: "Barrera",
    aprimatic: "VÍA 40 / 60",
    hint: "24 V brushless · uso intensivo",
    query: "VIA 40",
    others: [
      { brand: "FAAC", model: "615 / 620 / 640", query: "620" },
      { brand: "Nice", model: "M-Bar / L-Bar" },
      { brand: "CAME", model: "GARD" },
      { brand: "BFT", model: "Maxima / Giotto" },
    ],
  },
  {
    family: "Pilona",
    aprimatic: "APRIPASS EM / HD / SA",
    hint: "Fija, automática y alta seguridad",
    query: "APRIPASS",
    others: [
      { brand: "FAAC", model: "J200 / J275", query: "J275" },
      { brand: "Nice", model: "X-Bar (acceso)" },
      { brand: "CAME", model: "BY / CSI" },
      { brand: "BFT", model: "Stoppy / Pillar" },
    ],
  },
  {
    family: "Mandos / cuadro",
    aprimatic: "TX4E · AB 124M / AB 224DG",
    hint: "433 MHz · cuadros 24 V / 230 V",
    query: "TX4E",
    others: [
      { brand: "FAAC", model: "XT2/XT4 · E024S / 455 D", query: "E024S" },
      { brand: "Nice", model: "FLO / ERA INTI · Moonkit" },
      { brand: "CAME", model: "TOP · ZL / ZM" },
      { brand: "BFT", model: "Mitto · Thalia" },
    ],
  },
];
