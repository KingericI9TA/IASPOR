import { createServerFn } from "@tanstack/react-start";
import { BRANDS } from "./brands";
import type { CatalogDoc, DocKind } from "./catalog";

type OutputItem = {
  type?: string;
  content?: { type?: string; text?: string }[];
};

type RemoteDoc = {
  id?: string;
  brand?: string;
  title?: string;
  model?: string;
  kind?: string;
  keywords?: string[];
  hint?: string;
  url?: string;
};

const KINDS: DocKind[] = ["esquema", "manual", "receptor", "central", "kit"];

function outputText(body: { output?: OutputItem[]; output_text?: string }) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }
  const chunks: string[] = [];
  for (const item of body.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n");
}

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

export const syncRemoteCatalog = createServerFn({ method: "POST" }).handler(async () => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "Sincronización no disponible ahora." };
  }

  const brands = BRANDS.map((b) => b.name).join(", ");
  const system = `Actualiza un catálogo técnico de manuales y esquemas.
Fuentes prioritarias:
- https://www.visiotechsecurity.com y https://support.visiotechsecurity.com (Safire, Nivian, X-Security)
- páginas de descargas de: ${brands}
Devuelve SOLO un JSON array (máx 12, sin markdown) con:
{"brand":"Safire","title":"...","model":"...","kind":"manual|esquema|receptor|central|kit","keywords":["..."],"hint":"...","url":"https://..."}
Cada url debe ser real. Máximo 2 búsquedas web y responde. Incluye Visiotech/Safire y 4-5 automatismos de puertas.`;

  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(28_000),
      body: JSON.stringify({
        model: "grok-4.6",
        temperature: 0,
        max_output_tokens: 900,
        tools: [{ type: "web_search" }],
        input: [
          { role: "system", content: system },
          {
            role: "user",
            content:
              "Sincroniza el catálogo ahora: fichas Visiotech/Safire y manuales recientes de FAAC, Nice, CAME, BFT, CDVI y el resto.",
          },
        ],
      }),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : "";
    if (name === "TimeoutError" || name === "AbortError" || /abort|timeout/i.test(msg)) {
      return { ok: false as const, error: "La sincronización tardó demasiado. Pulsa de nuevo más tarde." };
    }
    return { ok: false as const, error: "No se pudo conectar para sincronizar." };
  }

  if (!res.ok) {
    return { ok: false as const, error: `Error de sincronización (${res.status})` };
  }

  const body = (await res.json()) as { output?: OutputItem[]; output_text?: string };
  const raw = outputText(body);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    return { ok: false as const, error: "No se pudo leer el catálogo remoto." };
  }

  let parsed: RemoteDoc[] = [];
  try {
    parsed = JSON.parse(match[0]) as RemoteDoc[];
  } catch {
    return { ok: false as const, error: "Respuesta de catálogo no válida." };
  }

  const docs: CatalogDoc[] = [];
  for (const item of parsed) {
    if (!item?.title || !item?.url || !/^https?:\/\//i.test(item.url)) continue;
    const brandId = resolveBrandId(item.brand) ?? "visiotech";
    const model = (item.model ?? item.title).slice(0, 80);
    const id = `sync-${brandId}-${slug(model || item.title)}`;
    docs.push({
      id,
      brandId,
      title: item.title.slice(0, 160),
      model,
      kind: mapKind(item.kind),
      keywords: Array.isArray(item.keywords)
        ? item.keywords.map((k) => String(k).slice(0, 40)).slice(0, 8)
        : [model],
      hint: (item.hint ?? "Ficha sincronizada del catálogo web.").slice(0, 220),
      url: item.url.slice(0, 400),
      synced: true,
    });
    if (docs.length >= 18) break;
  }

  if (docs.length === 0) {
    return { ok: false as const, error: "El catálogo remoto no trajo fichas útiles." };
  }

  return { ok: true as const, docs };
});
