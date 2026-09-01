import { createServerFn } from "@tanstack/react-start";
import { BRANDS, detectBrandFromText, type Brand } from "./brands";
import {
  googlePdfQuery,
  googleSimpleQuery,
  webEngineHits,
  type WebHit,
} from "./google-search";

export type { WebHit } from "./google-search";
export { webEngineHits } from "./google-search";

type Source = { type?: string; url?: string; title?: string };
type OutputItem = {
  type?: string;
  url?: string;
  sources?: Source[];
  content?: {
    type?: string;
    text?: string;
    annotations?: { type?: string; url?: string; title?: string }[];
  }[];
  action?: { query?: string; sources?: Source[] };
};

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function cleanUrl(url: string) {
  const raw = url
    .trim()
    .replace(/&/gi, "&")
    .replace(/\\u0026/g, "&")
    .replace(/\\u002f/gi, "/")
    .replace(/["'<>].*$/, "");
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href;
  } catch {
    return "";
  }
}

function isPdfUrl(url: string) {
  try {
    const u = new URL(url);
    return /\.pdf$/i.test(u.pathname) || /[?&](?:format|type)=pdf\b/i.test(u.search);
  } catch {
    return false;
  }
}

function isOfficialHost(url: string, brand?: Brand) {
  const h = hostOf(url);
  if (!h) return false;
  const hosts = brand
    ? [brand.site, brand.manuals].map(hostOf).filter(Boolean)
    : BRANDS.flatMap((b) => [hostOf(b.site), hostOf(b.manuals)]).filter(Boolean);
  return hosts.some((site) => h === site || h.endsWith(`.${site}`));
}

function titleFromPdf(url: string) {
  try {
    const file = decodeURIComponent(new URL(url).pathname.split("/").pop() || "manual.pdf");
    return file
      .replace(/\.pdf$/i, "")
      .replace(/[_+]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
  } catch {
    return "Manual PDF";
  }
}

function parseHits(raw: string): WebHit[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const data = JSON.parse(match[0]) as WebHit[];
    return data
      .filter((h) => h && typeof h.title === "string" && typeof h.url === "string")
      .map((h) => ({ ...h, url: cleanUrl(h.url) }))
      .filter((h) => h.url)
      .map((h) => ({
        title: h.title.slice(0, 160),
        url: h.url,
        brand: h.brand,
        kind: h.kind === "pdf" || isPdfUrl(h.url) ? "pdf" : "page",
        snippet: (h.snippet ?? "").slice(0, 280),
      }));
  } catch {
    return [];
  }
}

function urlsFromText(raw: string): string[] {
  const found = raw.match(/https?:\/\/[^\s"'<>\]]+/gi) ?? [];
  return found.map(cleanUrl).filter(Boolean);
}

function outputText(body: { output?: OutputItem[]; output_text?: string }) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }
  const chunks: string[] = [];
  for (const item of body.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n");
}

function isJunkHost(url: string) {
  const h = hostOf(url);
  return /(amazon|ebay|aliexpress|facebook|pinterest|instagram|tiktok|gstatic|googleapis|googleusercontent|x\.ai)\./i.test(
    h,
  );
}

function pushHit(hits: WebHit[], url: string, title: string, brand?: string, snippet?: string) {
  const href = cleanUrl(url);
  if (!href || isJunkHost(href)) return;
  hits.push({
    title: (title || titleFromPdf(href) || hostOf(href)).slice(0, 160),
    url: href,
    brand,
    kind: isPdfUrl(href) ? "pdf" : "page",
    snippet: (snippet ?? (isPdfUrl(href) ? "PDF encontrado en la búsqueda web." : "Página localizada en la búsqueda web.")).slice(0, 280),
  });
}

function harvestAll(output: OutputItem[] | undefined, raw: string, brand?: Brand): WebHit[] {
  const hits: WebHit[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: unknown, depth: number) => {
    if (!node || depth > 8) return;
    if (Array.isArray(node)) {
      for (const n of node) walk(n, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    const o = node as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url : "";
    if (url.startsWith("http")) {
      pushHit(hits, url, String(o.title ?? o.name ?? ""), brand?.name);
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  };
  walk(output, 0);
  for (const url of urlsFromText(raw)) {
    pushHit(hits, url, titleFromPdf(url), brand?.name);
  }
  return hits;
}

function rankHits(hits: WebHit[], brand?: Brand, query = "") {
  const seen = new Set<string>();
  const unique: WebHit[] = [];
  for (const h of hits) {
    const key = h.url.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      ...h,
      kind: isPdfUrl(h.url) ? "pdf" : h.kind,
    });
  }
  const q = query.toLowerCase();
  unique.sort((a, b) => {
    const score = (h: WebHit) => {
      let s = 0;
      const host = hostOf(h.url);
      if (h.kind === "pdf") s += 18;
      if (host.startsWith("google.")) s += 36;
      if (host.startsWith("bing.")) s += 20;
      if (isOfficialHost(h.url, brand)) s += 10;
      if (q && h.title.toLowerCase().includes(q.split(" ")[0] ?? "")) s += 6;
      if (h.kind === "page" && !/^(google|bing)\./i.test(host)) s += 8;
      if (isJunkHost(h.url)) s -= 40;
      return s;
    };
    return score(b) - score(a);
  });
  const engines = unique.filter((h) => /^(google|bing)\./i.test(hostOf(h.url)));
  const engineUrls = new Set(engines.map((h) => h.url));
  const rest = unique.filter((h) => !engineUrls.has(h.url));
  return [...engines, ...rest].slice(0, 24);
}

export const searchWebManuals = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => {
    const query = input.query.trim().slice(0, 180);
    if (query.length < 2) throw new Error("Consulta demasiado corta");
    return { query };
  })
  .handler(async ({ data }) => {
    const fallback = webEngineHits(data.query);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: true as const, hits: fallback };
    }

    const brand = detectBrandFromText(data.query);
    const simple = googleSimpleQuery(data.query);
    const pdfQ = googlePdfQuery(data.query);
    const system = `Haz DOS búsquedas web y junta los resultados:
1) Búsqueda SIMPLE (sin filtros): ${simple}
2) PDFs: ${pdfQ}
Incluye páginas, fichas, catálogos, recambios y PDFs. Sin site:. Sin restringir a manuales.
Devuelve JSON array {title,url,brand,kind,snippet}. kind=pdf|page. No inventes URLs.`;

    try {
      const res = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.6",
          temperature: 0,
          max_output_tokens: 1400,
          tools: [{ type: "web_search" }],
          input: [
            { role: "system", content: system },
            {
              role: "user",
              content: `Busca "${simple}" (búsqueda simple) y también "${pdfQ}". Lista todo lo que salga, páginas y PDFs.`,
            },
          ],
        }),
        signal: AbortSignal.timeout(18_000),
      });

      if (!res.ok) {
        return { ok: true as const, hits: fallback };
      }

      const body = (await res.json()) as { output?: OutputItem[]; output_text?: string };
      const raw = outputText(body);
      const harvested = harvestAll(body.output, raw, brand);
      const parsed = parseHits(raw);
      const hits = rankHits([...fallback, ...harvested, ...parsed], brand, data.query);
      return { ok: true as const, hits };
    } catch {
      return { ok: true as const, hits: fallback };
    }
  });

export const fetchRemotePdf = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => {
    const url = cleanUrl(input.url);
    if (!isPdfUrl(url)) throw new Error("Ese enlace no es un PDF");
    return { url };
  })
  .handler(async ({ data }) => {
    const res = await fetch(data.url, {
      headers: { "User-Agent": "ASPOR-IA/1.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      return { ok: false as const, error: `No se pudo descargar (${res.status})` };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 80) {
      return { ok: false as const, error: "El archivo está vacío." };
    }
    if (buf.byteLength > 8_000_000) {
      return { ok: false as const, error: "PDF demasiado grande (máx. 8 MB)." };
    }
    const magic = new Uint8Array(buf, 0, 4);
    if (magic[0] !== 0x25 || magic[1] !== 0x50 || magic[2] !== 0x44 || magic[3] !== 0x46) {
      return { ok: false as const, error: "El enlace no devolvió un PDF." };
    }
    return {
      ok: true as const,
      name: titleFromPdf(data.url),
      base64: Buffer.from(buf).toString("base64"),
      size: buf.byteLength,
    };
  });
