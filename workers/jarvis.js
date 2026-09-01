const SYSTEM =
  "Eres Jarvis, asistente de campo de IASPOR (ASPOR, Gijón), servicio técnico de puertas automáticas FAAC y otras marcas (Nice, Came, BFT, Aprimatic, Clemsa, CDVI…). Responde en español, breve y práctico: dip-switch, errores, recambios, compatibilidad, central, cableado. Sin markdown recargado. Si no estás seguro, dilo y sugiere el manual.";

const GATE = "iaspor-jarvis-taller";
const hits = new Map();

function cors(req) {
  const origin = req.headers.get("origin") || "*";
  const allow =
    origin === "*" ||
    origin.endsWith(".github.io") ||
    origin.endsWith(".grok.me") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1")
      ? origin
      : "https://kingericI9ta.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-iaspor-gate",
    Vary: "Origin",
  };
}

function json(req, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });
}

function limited(req) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "local";
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now - row.t > 60 * 60 * 1000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  if (row.n >= 40) return true;
  row.n += 1;
  return false;
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
    if (req.method !== "POST") return json(req, { ok: false, error: "Usa POST" }, 405);
    if (limited(req)) return json(req, { ok: false, error: "Demasiadas consultas. Espera un rato." }, 429);
    const gate = req.headers.get("x-iaspor-gate");
    if (gate && gate !== GATE) return json(req, { ok: false, error: "No autorizado." }, 403);
    const key = env.XAI_API_KEY;
    if (!key) return json(req, { ok: false, error: "Jarvis no está disponible." }, 503);

    let question = "";
    let context = "";
    try {
      const body = await req.json();
      question = typeof body.question === "string" ? body.question.trim().slice(0, 800) : "";
      context = typeof body.context === "string" ? body.context.trim().slice(0, 1500) : "";
    } catch {
      return json(req, { ok: false, error: "Consulta no válida." }, 400);
    }
    if (question.length < 2) return json(req, { ok: false, error: "Escribe una consulta." }, 400);

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
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
      });
      if (!res.ok) return json(req, { ok: false, error: "Jarvis no respondió. Prueba otra vez." }, 502);
      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (!answer) return json(req, { ok: false, error: "Respuesta vacía." }, 502);
      return json(req, { ok: true, answer: answer.slice(0, 4000) });
    } catch {
      return json(req, { ok: false, error: "Sin red." }, 504);
    }
  },
};
