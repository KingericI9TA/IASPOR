import { createFileRoute } from "@tanstack/react-router";
import { completeJarvis, JARVIS_GATE } from "@/lib/jarvis-core";

const hits = new Map<string, { n: number; t: number }>();

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const allow =
    origin === "null" ||
    origin.endsWith(".github.io") ||
    origin.endsWith(".grok.me") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1")
      ? origin
      : "https://kingericI9ta.github.io";
  return {
    "Access-Control-Allow-Origin": allow === "null" ? "*" : allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-iaspor-gate",
    Vary: "Origin",
  };
}

function limited(req: Request) {
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

export const Route = createFileRoute("/api/jarvis")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
      POST: async ({ request }) => {
        const headers = { ...cors(request), "Content-Type": "application/json" };
        if (limited(request)) {
          return Response.json({ ok: false, error: "Demasiadas consultas. Espera un rato." }, { status: 429, headers });
        }
        const gate = request.headers.get("x-iaspor-gate");
        if (gate && gate !== JARVIS_GATE) {
          return Response.json({ ok: false, error: "No autorizado." }, { status: 403, headers });
        }
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json({ ok: false, error: "Jarvis no está disponible." }, { status: 503, headers });
        }
        let question = "";
        let context = "";
        try {
          const body = (await request.json()) as { question?: unknown; context?: unknown };
          question = typeof body.question === "string" ? body.question.trim().slice(0, 800) : "";
          context = typeof body.context === "string" ? body.context.trim().slice(0, 1500) : "";
        } catch {
          return Response.json({ ok: false, error: "Consulta no válida." }, { status: 400, headers });
        }
        if (question.length < 2) {
          return Response.json({ ok: false, error: "Escribe una consulta." }, { status: 400, headers });
        }
        const result = await completeJarvis(apiKey, question, context);
        return Response.json(result, { headers });
      },
    },
  },
});
