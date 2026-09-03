import { createServerFn } from "@tanstack/react-start";
import { CATALOG } from "@/lib/catalog";
import { isStaticHost } from "@/lib/static-host";

export function jarvisWebUrl(question: string) {
  const q = question.trim().slice(0, 400);
  return `https://grok.com/?q=${encodeURIComponent(q)}`;
}

export type JarvisResult =
  | { ok: true; text: string; source: "grok" | "campo" }
  | { ok: false; error: string };

const FIELD: { keys: string[]; answer: string }[] = [
  {
    keys: ["fotocelula", "fotocelulas", "no cierra", "no cierra", "safety", "fsw"],
    answer:
      "Fotocélulas / no cierra\n1. Mira el LED de la fotocélula: al tapar el haz debe cambiar. Si no, alinea o cambia el par.\n2. En FAAC, bornes FSW / FSW OP / FSW CL. El jumper de seguridad tiene que estar si no hay fotocélula en ese canal.\n3. Comprueba 2 hilos + polaridad 24 V. Un receptor invertido deja el motor en apertura.\n4. Si el motor abre y no cierra: casi siempre es fotocélula o borde sensible, no el motor.",
  },
  {
    keys: ["encoder", "lentitud", "slow", "no aprende", "aprendizaje"],
    answer:
      "Encoder / aprendizaje\n1. FAAC 415/390/E024S: encoder en el motor, no lo fuerces a mano con corriente.\n2. Borra tiempos (RESET) y vuelve a programar con las hojas en cierre.\n3. Si “no aprende”: fin de carrera o encoder sucio/flojo, y dip de lógica (A/E/EP).\n4. 740/741: fin de carrera magnético; si se corre el imán, la hoja no completa.",
  },
  {
    keys: ["mando", "emisor", "receptor", "no memoriza", "rolling", "flo", "mutancode"],
    answer:
      "Mandos\n1. FAAC: receptor XF / RP. Botón SW1, LED, pulsa el mando 2 veces. Distancia < 50 cm.\n2. Nice FLO/FLO-R: rolling; hay que memorizar en OXI / FLOX, no clonar un fixed.\n3. Clemsa Mutancode: el receptor tiene que estar en el mismo código de instalación.\n4. Si el LED del receptor ni pestañea, no llega radio (24 V del receptor o antena).",
  },
  {
    keys: ["455", "455d", "dip"],
    answer:
      "FAAC 455 D\nLógica típica: dip 1–4 = A / E / EP / AP. Fotocélulas FSW, borde STOP, abridor OPEN.\nAlimentación 230 V, motor 1 y 2, condensador 8–12 µF según 402/422.\nSi no arranca: FSW en cortocircuito (jumper) y STOP cerrado (NC). Sin eso la placa no mueve.",
  },
  {
    keys: ["e024", "e024s", "24v"],
    answer:
      "FAAC E024S (24 V)\nPensada para 415 L / 390. Encoder obligatorio. Soft-start / slow-down por menú.\nBusca error en el display: E1 fotocélulas, E2 encoder, E4 tope.\nFuente 24 V: si baja de ~22 V en arranque, el motor “tira” y se para.",
  },
  {
    keys: ["740", "741", "corredera", "cremallera"],
    answer:
      "FAAC 740 / 741\nCentral 578 D. Fin de carrera: imanes en la cremallera, no en el motor.\nSi abre y no cierra: fotocélula o imán de cierre desplazado.\nAceite del reductor, piñón y holgura de cremallera. 741 es el de más empuje.",
  },
  {
    keys: ["413", "414", "415", "s418", "batiente"],
    answer:
      "Batientes FAAC 413 / 414 / 415 / S418\n413/414 hidráulicos 230 V (central 455 o 401). 415 electromecánico 24 V (E024S).\nDespiece: toca la pieza en Piezas → 413 / 560.\nFuga de aceite en 413: retenes del émbolo. No rellenar a lo loco; cambia kit de juntas.",
  },
  {
    keys: ["560", "hidraulico"],
    answer:
      "FAAC 560\nOperador hidráulico enterrado. Despiece táctil en Piezas → 560.\nFuga: retenes. Si no empuja: bypass de desbloqueo o aceite. Central habitual 455 / 624.",
  },
  {
    keys: ["error", "alarma", "led", "parpadea"],
    answer:
      "Errores frecuentes FAAC\n- Parpadeo rápido en 455: STOP abierto o FSW.\n- E024S E1: fotocélulas. E2: encoder. E3: obstáculo. E4: tope / carrera.\n- 578 D: cuenta los destellos del LED de diagnóstico.\nAnota cuántos destellos y el modelo exacto de placa (serigrafía).",
  },
];

function localAnswer(question: string): string {
  const n = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const hits = FIELD.filter((row) => row.keys.some((k) => n.includes(k)));
  const catalog = CATALOG.filter((d) => {
    const blob = `${d.title} ${d.model} ${d.keywords.join(" ")} ${d.hint}`.toLowerCase();
    return n.split(/\s+/).filter((w) => w.length >= 3).some((w) => blob.includes(w));
  }).slice(0, 4);

  const parts: string[] = [];
  if (hits.length) parts.push(hits.map((h) => h.answer).join("\n\n"));
  if (catalog.length) {
    parts.push(
      "Fichas del catálogo IASPOR:\n" +
        catalog.map((d) => `· ${d.title} (${d.model}): ${d.hint}`).join("\n"),
    );
  }
  if (!parts.length) {
    parts.push(
      `No tengo una ficha cerrada para “${question.trim()}”.\n` +
        "En campo: 1) modelo de motor y de placa, 2) qué hace exactamente (abre / no cierra / no memoriza), 3) LED o código de error.\n" +
        "Prueba Piezas con el modelo (413, 560, 740…) o Catálogo FAAC/Aprimatic.",
    );
  }
  parts.push("Jarvis de campo · IASPOR. Si hace falta más detalle, pulsa Abrir Grok.");
  return parts.join("\n\n");
}

export const askJarvis = createServerFn({ method: "POST" })
  .validator((input: { question: string }) => {
    const question = String(input.question ?? "").trim().slice(0, 400);
    if (question.length < 2) throw new Error("Escribe qué quieres consultar");
    return { question };
  })
  .handler(async ({ data }): Promise<JarvisResult> => {
    const apiKey = process.env.XAI_API_KEY;
    const fallback = localAnswer(data.question);
    if (!apiKey) return { ok: true, text: fallback, source: "campo" };

    const catalogHint = CATALOG.slice(0, 18)
      .map((d) => `${d.model}: ${d.hint}`)
      .join(" | ");

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content:
                "Eres Jarvis de IASPOR, asistente de campo para técnicos de puertas automáticas (FAAC, Aprimatic, Nice, CAME, BFT) en España. Responde en español, corto, con pasos numerados. No inventes códigos de recambio. Si no estás seguro, dilo y pide modelo de placa. Contexto de fichas: " +
                catalogHint,
            },
            { role: "user", content: data.question },
          ],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { ok: true, text: fallback, source: "campo" };
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) return { ok: true, text: fallback, source: "campo" };
      return { ok: true, text, source: "grok" };
    } catch {
      return { ok: true, text: fallback, source: "campo" };
    }
  });

export async function askJarvisClient(question: string): Promise<JarvisResult> {
  const q = question.trim().slice(0, 400);
  if (q.length < 2) return { ok: false, error: "Escribe qué quieres consultar" };
  if (typeof window !== "undefined" && isStaticHost()) {
    return { ok: true, text: localAnswer(q), source: "campo" };
  }
  try {
    return await askJarvis({ data: { question: q } });
  } catch {
    return { ok: true, text: localAnswer(q), source: "campo" };
  }
}
