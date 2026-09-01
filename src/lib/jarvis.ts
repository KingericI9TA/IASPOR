import { createServerFn } from "@tanstack/react-start";
import { queryFaacSpares } from "@/lib/faac-spares";
import { googlePdfUrl, googleSimpleUrl } from "@/lib/google-search";
import { completeJarvis, JARVIS_GATE, type JarvisAskResult } from "@/lib/jarvis-core";
import { listLibrary } from "@/lib/library";
import { searchLocal } from "@/lib/search-local";
import { isStaticHost } from "@/lib/static-host";

export { completeJarvis, JARVIS_GATE, type JarvisAskResult } from "@/lib/jarvis-core";

const LOCAL_KEY = "iaspor-xai-key";

export function jarvisWebUrl(question: string) {
  return `https://grok.com/?q=${encodeURIComponent(question.slice(0, 400))}`;
}

function jarvisRemoteUrl() {
  const fromEnv = (import.meta.env.VITE_JARVIS_URL as string | undefined)?.trim();
  return fromEnv || "https://iaspor-jarvis.charmed-bistro.workers.dev";
}

export function loadLocalJarvisKey() {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(LOCAL_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

function snippetAround(text: string, query: string) {
  const hay = text.replace(/\s+/g, " ").trim();
  const q = query.trim().split(/\s+/).filter((t) => t.length > 2)[0] ?? query;
  const i = hay.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return hay.slice(0, 220);
  const from = Math.max(0, i - 80);
  return (from ? "…" : "") + hay.slice(from, from + 220);
}

function fieldTips(question: string) {
  const q = question.toLowerCase();
  const tips: string[] = [];
  if (/no cierra|queda abierta|no baja/.test(q)) {
    tips.push(
      "Si no cierra: fotocélulas sucias o desalineadas, final de carrera / encoder, obstáculo, fuerza de cierre baja o jumper de seguridad abierto.",
    );
  }
  if (/no abre|no sube|no arranca/.test(q)) {
    tips.push("Si no abre: 230 V en la placa, fusible, desbloqueo mecánico, receptor/mando y final de apertura.");
  }
  if (/parpade|led|error|e\d|err/.test(q)) {
    tips.push("Anota parpadeos del LED de la central (secuencia). En 746/740 suele ser fotocélulas, encoder o tope.");
  }
  if (/fotoc[eé]l/.test(q)) {
    tips.push("Fotocélulas: limpia, alinea TX/RX, 24 V y puente temporal en la placa solo para diagnóstico.");
  }
  if (/mando|emisor|no responde el/.test(q)) {
    tips.push("Mando: pila, memorizar de nuevo, antena en la placa y que no esté en modo radio bloqueado.");
  }
  if (!tips.length) {
    tips.push(
      "Orden de campo: alimentación → desbloqueo → fotocélulas → finales/encoder → radio → fuerza/tiempos en la placa.",
    );
  }
  return tips;
}

export async function consultaTaller(question: string, context = ""): Promise<string> {
  const q = `${context} ${question}`.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  lines.push(...fieldTips(q));

  try {
    const faac = await queryFaacSpares(q);
    if (faac.ok && faac.hits.length) {
      lines.push("");
      lines.push("Catálogo FAAC:");
      for (const hit of faac.hits.slice(0, 6)) {
        const code = hit.code ? ` (${hit.code})` : "";
        lines.push(`· ${hit.name}${code} — ${hit.kind}`);
      }
    }
  } catch {
    /* catálogo no disponible */
  }

  try {
    const library = await listLibrary();
    const local = searchLocal(q, library);
    const withText = local.filter((h) => h.library?.text);
    if (withText.length) {
      lines.push("");
      lines.push("En tus PDFs:");
      for (const hit of withText.slice(0, 4)) {
        const doc = hit.library!;
        lines.push(`· ${doc.name}: ${snippetAround(doc.text, q)}`);
      }
    }
  } catch {
    /* sin archivos */
  }

  lines.push("");
  lines.push(`Google: ${googleSimpleUrl(q)}`);
  lines.push(`PDF: ${googlePdfUrl(q)}`);
  return lines.join("\n").slice(0, 4000);
}

export const askJarvisFn = createServerFn({ method: "POST" })
  .validator((input: { question: string; context?: string }) => {
    const question = input.question.trim().slice(0, 800);
    if (question.length < 2) throw new Error("Escribe una consulta");
    return { question, context: (input.context ?? "").trim().slice(0, 1500) };
  })
  .handler(async ({ data }): Promise<JarvisAskResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Jarvis no está disponible en este momento." };
    return completeJarvis(apiKey, data.question, data.context);
  });

async function askJarvisHttp(url: string, question: string, context: string): Promise<JarvisAskResult | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-iaspor-gate": JARVIS_GATE },
      body: JSON.stringify({ question, context }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as JarvisAskResult;
    if (body && body.ok && body.answer) return body;
    return null;
  } catch {
    return null;
  }
}

export async function queryJarvis(question: string, context = ""): Promise<JarvisAskResult> {
  const remote = jarvisRemoteUrl();
  const urls: string[] = [];
  if (remote) urls.push(remote);
  if (typeof window === "undefined" || !isStaticHost()) urls.push("/api/jarvis");

  for (const url of urls) {
    const hit = await askJarvisHttp(url, question, context);
    if (hit?.ok) return hit;
  }

  const localKey = loadLocalJarvisKey();
  if (localKey) {
    const direct = await completeJarvis(localKey, question, context);
    if (direct.ok) return direct;
  }

  if (typeof window === "undefined" || !isStaticHost()) {
    try {
      const live = await askJarvisFn({ data: { question, context } });
      if (live.ok) return live;
    } catch {
      /* teléfono: sin servidor local */
    }
  }

  const answer = await consultaTaller(question, context);
  return { ok: true, answer };
}
