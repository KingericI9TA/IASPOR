import { createServerFn } from "@tanstack/react-start";
import { queryFaacSpares } from "@/lib/faac-spares";
import { googlePdfUrl, googleSimpleUrl } from "@/lib/google-search";
import { listLibrary } from "@/lib/library";
import { searchLocal } from "@/lib/search-local";
import { isStaticHost } from "@/lib/static-host";

const LOCAL_KEY = "iaspor-xai-key";
const SYSTEM =
  "Eres el asistente de campo de IASPOR (ASPOR, Gijón), servicio técnico de puertas automáticas FAAC y otras marcas (Nice, Came, BFT, Aprimatic, Clemsa, CDVI…). Responde en español, breve y práctico: dip-switch, errores, recambios, compatibilidad, central, cableado. Sin markdown recargado. Si no estás seguro, dilo y sugiere el manual.";

export type GrokAskResult =
  | { ok: true; answer: string }
  | { ok: false; error: string };

export function grokWebUrl(question: string) {
  return `https://grok.com/?q=${encodeURIComponent(question.slice(0, 400))}`;
}

export function loadLocalGrokKey() {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(LOCAL_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function saveLocalGrokKey(key: string) {
  try {
    const v = key.trim();
    if (v) localStorage.setItem(LOCAL_KEY, v);
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
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
    tips.push(
      "Si no abre: 230 V en la placa, fusible, desbloqueo mecánico, receptor/mando y final de apertura.",
    );
  }
  if (/parpade|led|error|e\d|err/.test(q)) {
    tips.push(
      "Anota parpadeos del LED de la central (secuencia). En 746/740 suele ser fotocélulas, encoder o tope.",
    );
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

export async function completeGrok(
  apiKey: string,
  question: string,
  context = "",
): Promise<GrokAskResult> {
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 420,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: context ? `Contexto en la app: ${context}\n\nConsulta: ${question}` : question,
          },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) return { ok: false, error: "Grok no respondió. Prueba otra vez." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = body.choices?.[0]?.message?.content?.trim();
    if (!answer) return { ok: false, error: "Respuesta vacía." };
    return { ok: true, answer: answer.slice(0, 4000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/abort|timeout/i.test(msg)) {
      return { ok: false, error: "Grok tardó demasiado." };
    }
    return { ok: false, error: "Sin red." };
  }
}

export const askGrok = createServerFn({ method: "POST" })
  .validator((input: { question: string; context?: string }) => {
    const question = input.question.trim().slice(0, 800);
    if (question.length < 2) throw new Error("Escribe una consulta");
    return { question, context: (input.context ?? "").trim().slice(0, 1500) };
  })
  .handler(async ({ data }): Promise<GrokAskResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Grok no está disponible en este momento." };
    return completeGrok(apiKey, data.question, data.context);
  });

export async function queryGrok(question: string, context = ""): Promise<GrokAskResult> {
  const localKey = loadLocalGrokKey();
  if (localKey) {
    const direct = await completeGrok(localKey, question, context);
    if (direct.ok) return direct;
  }

  if (typeof window === "undefined" || !isStaticHost()) {
    try {
      const live = await askGrok({ data: { question, context } });
      if (live.ok) return live;
    } catch {
      /* teléfono: sin servidor */
    }
  }

  const answer = await consultaTaller(question, context);
  return { ok: true, answer };
}
