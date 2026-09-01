export const JARVIS_GATE = "iaspor-jarvis-taller";

export const JARVIS_SYSTEM =
  "Eres Jarvis, asistente de campo de IASPOR (ASPOR, Gijón), servicio técnico de puertas automáticas FAAC y otras marcas (Nice, Came, BFT, Aprimatic, Clemsa, CDVI…). Responde en español, breve y práctico: dip-switch, errores, recambios, compatibilidad, central, cableado. Sin markdown recargado. Si no estás seguro, dilo y sugiere el manual.";

export type JarvisAskResult =
  | { ok: true; answer: string }
  | { ok: false; error: string };

export async function completeJarvis(
  apiKey: string,
  question: string,
  context = "",
): Promise<JarvisAskResult> {
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 420,
        messages: [
          { role: "system", content: JARVIS_SYSTEM },
          {
            role: "user",
            content: context ? `Contexto en la app: ${context}\n\nConsulta: ${question}` : question,
          },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    });
    if (!res.ok) return { ok: false, error: "Jarvis no respondió. Prueba otra vez." };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = body.choices?.[0]?.message?.content?.trim();
    if (!answer) return { ok: false, error: "Respuesta vacía." };
    return { ok: true, answer: answer.slice(0, 4000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/abort|timeout/i.test(msg)) return { ok: false, error: "Jarvis tardó demasiado." };
    return { ok: false, error: "Sin red." };
  }
}
