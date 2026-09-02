import type { WebHit } from "./google-search";

const JINA = "https://r.jina.ai/";
const MAX_HITS = 8;
const MAX_BYTES = 8_000_000;

function unwrap(url: string): string {
  try {
    const u = new URL(url.trim().replace(/[),.;]+$/, ""));
    const inner = u.searchParams.get("uddg") || u.searchParams.get("q") || u.searchParams.get("url");
    if (inner && /^https?:/i.test(inner)) return unwrap(inner);
    if (/drive\.google\.com/i.test(u.hostname)) {
      const id = u.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || u.searchParams.get("id");
      if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    }
    return u.href;
  } catch {
    return url;
  }
}

function isPdfUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "");
    if (/(google|bing|duckduckgo|facebook|instagram)\./i.test(host)) return false;
    return /\.pdf$/i.test(u.pathname) || /[?&](?:format|type|output|export)=(?:pdf|download)\b/i.test(u.search);
  } catch {
    return false;
  }
}

function titleFromPdf(url: string, fallback: string) {
  try {
    const file = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    const name = file.replace(/\.pdf$/i, "").replace(/[_+]+/g, " ").replace(/\s+/g, " ").trim();
    return (name || fallback).slice(0, 160);
  } catch {
    return fallback.slice(0, 160);
  }
}

function parseHits(md: string, query: string): WebHit[] {
  const seen = new Set<string>();
  const hits: WebHit[] = [];
  const add = (title: string, raw: string) => {
    const url = unwrap(raw);
    if (!isPdfUrl(url) || seen.has(url)) return;
    seen.add(url);
    hits.push({
      title: titleFromPdf(url, title),
      url,
      kind: "pdf",
      snippet: `PDF encontrado para “${query}”.`,
    });
  };
  const re = /\[([^\]]{3,120})\]\((https?:\/\/[^)\s]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) add(m[1].replace(/\s+/g, " ").trim(), m[2]);
  for (const raw of md.match(/https?:\/\/[^\s)"']+/gi) ?? []) add("Manual PDF", raw);
  return hits.slice(0, MAX_HITS);
}

async function readSearch(url: string) {
  const res = await fetch(`${JINA}${url}`, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return "";
  return res.text();
}

export async function findWebPdfs(query: string): Promise<WebHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const encoded = encodeURIComponent(`${q} filetype:pdf`);
  const pages = [
    `https://html.duckduckgo.com/html/?q=${encoded}`,
    `https://www.bing.com/search?q=${encoded}&setlang=es`,
  ];
  const texts = await Promise.allSettled(pages.map(readSearch));
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  for (const result of texts) {
    if (result.status !== "fulfilled" || !result.value) continue;
    for (const hit of parseHits(result.value, q)) {
      if (seen.has(hit.url)) continue;
      seen.add(hit.url);
      hits.push(hit);
    }
  }
  return hits.slice(0, MAX_HITS);
}

function looksLikePdf(buf: ArrayBuffer) {
  if (buf.byteLength < 8) return false;
  const m = new Uint8Array(buf, 0, 4);
  return m[0] === 0x25 && m[1] === 0x50 && m[2] === 0x44 && m[3] === 0x46;
}

export async function downloadPdfBytes(url: string): Promise<ArrayBuffer> {
  const clean = unwrap(url);
  const sources = [clean, `https://proxy.corsfix.com/?${clean}`];

  const pull = async (src: string) => {
    const res = await fetch(src, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`No se pudo descargar (${res.status})`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("PDF demasiado grande (máx. 8 MB).");
    if (!looksLikePdf(buf)) throw new Error("El enlace no devolvió un PDF.");
    return buf;
  };

  try {
    return await Promise.any(sources.map(pull));
  } catch {
    throw new Error("No se pudo descargar el PDF. Ábrelo y pulsa Añadir archivos.");
  }
}

export function pdfFileName(url: string, title: string) {
  const base = titleFromPdf(url, title)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${base || "manual"}.pdf`;
}
