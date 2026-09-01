import { createServerFn } from "@tanstack/react-start";
import { completeJarvis, JARVIS_GATE, type JarvisAskResult } from "@/lib/jarvis-core";
import { isStaticHost } from "@/lib/static-host";

export { completeJarvis, JARVIS_GATE, type JarvisAskResult } from "@/lib/jarvis-core";

export function jarvisWebUrl(question: string) {
  const q = question.trim().slice(0, 400);
  return `https://grok.com/?q=${encodeURIComponent(q)}`;
}

function jarvisRemoteUrl() {
  const fromEnv = (import.meta.env.VITE_JARVIS_URL as string | undefined)?.trim();
  return fromEnv || "https://iaspor-jarvis.charmed-bistro.workers.dev";
}

export const askJarvisFn = createServerFn({ method: "POST" })
  .validator((input: { question: string }) => {
    const question = input.question.trim().slice(0, 800);
    if (question.length < 2) throw new Error("Escribe una consulta");
    return { question };
  })
  .handler(async ({ data }): Promise<JarvisAskResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Jarvis no está disponible en este momento." };
    return completeJarvis(apiKey, data.question);
  });

async function askJarvisHttp(url: string, question: string): Promise<JarvisAskResult | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-iaspor-gate": JARVIS_GATE },
      body: JSON.stringify({ question }),
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

export async function queryJarvis(question: string): Promise<JarvisAskResult> {
  const q = question.trim();
  const remote = jarvisRemoteUrl();
  const urls: string[] = [];
  if (remote) urls.push(remote);
  if (typeof window === "undefined" || !isStaticHost()) urls.push("/api/jarvis");

  for (const url of urls) {
    const hit = await askJarvisHttp(url, q);
    if (hit?.ok) return hit;
  }

  if (typeof window === "undefined" || !isStaticHost()) {
    try {
      const live = await askJarvisFn({ data: { question: q } });
      if (live.ok) return live;
    } catch {
      /* teléfono: usa el servidor remoto */
    }
  }

  return { ok: false, error: "Jarvis no contestó. Ábrelo en Grok." };
}
