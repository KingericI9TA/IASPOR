import { createServerFn } from "@tanstack/react-start";
import { isStaticHost } from "@/lib/static-host";

const LOCAL_KEY = "iaspor-xai-key";
const SYSTEM =
  "Eres el asistente de campo de IASPOR (ASPOR, Gijón), servicio técnico de puertas automáticas FAAC y otras marcas (Nice, Came, BFT, Aprimatic, Clemsa, CDVI…). Responde en español, breve y práctico: dip-switch, errores, recambios, compatibilidad, central, cableado. Sin markdown recargado. Si no estás seguro, dilo y sugiere el manual.";

export type GrokAskResult =
  | { ok: true; answer: string }
  | { ok: false; error: string; needKey?: boolean };

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
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Clave de Grok no válida.", needKey: true };
    }
    if (!res.ok) return { ok: false, error: "Grok no respondió. Prueba otra vez." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = body.choices?.[0]?.message?.content?.trim();
    if (!answer) return { ok: false, error: "Respuesta vacía." };
    return { ok: true, answer: answer.slice(0, 4000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/abort|timeout/i.test(msg)) {
      return { ok: false, error: "Grok tardó demasiado. Pregunta más corta o inténtalo otra vez." };
    }
    return { ok: false, error: "Sin red. Prueba otra vez." };
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
  if (localKey) return completeGrok(localKey, question, context);

  if (typeof window === "undefined" || !isStaticHost()) {
    try {
      return await askGrok({ data: { question, context } });
    } catch {
      /* APK / Pages: no hay servidor */
    }
  }

  return {
    ok: false,
    needKey: true,
    error: "En el teléfono Grok necesita una clave xAI, o ábrelo en grok.com.",
  };
}
