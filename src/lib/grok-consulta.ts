import { createServerFn } from "@tanstack/react-start";

export const askGrok = createServerFn({ method: "POST" })
  .validator((input: { question: string; context?: string }) => {
    const question = input.question.trim().slice(0, 800);
    if (question.length < 2) throw new Error("Escribe una consulta");
    return { question, context: (input.context ?? "").trim().slice(0, 1500) };
  })
  .handler(async ({ data }): Promise<{ ok: true; answer: string } | { ok: false; error: string }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "Grok no está disponible en este momento." };
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-4.6",
          temperature: 0.2,
          max_tokens: 700,
          messages: [
            {
              role: "system",
              content:
                "Eres el asistente de campo de IASPOR (ASPOR, Gijón), servicio técnico de puertas automáticas FAAC y otras marcas (Nice, Came, BFT, Aprimatic, Clemsa, CDVI…). Responde en español, breve y práctico: dip-switch, errores, recambios, compatibilidad, diputados de central, cableado. Sin markdown recargado. Si no estás seguro, dilo y sugiere el manual.",
            },
            {
              role: "user",
              content: data.context
                ? `Contexto en la app: ${data.context}\n\nConsulta: ${data.question}`
                : data.question,
            },
          ],
        }),
        signal: AbortSignal.timeout(28_000),
      });
      if (!res.ok) return { ok: false, error: "Grok no respondió. Prueba otra vez." };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const answer = body.choices?.[0]?.message?.content?.trim();
      if (!answer) return { ok: false, error: "Respuesta vacía." };
      return { ok: true, answer: answer.slice(0, 4000) };
    } catch {
      return { ok: false, error: "Sin red o tardó demasiado." };
    }
  });
