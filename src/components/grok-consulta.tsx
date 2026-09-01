import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { grokWebUrl, loadLocalGrokKey, queryGrok, saveLocalGrokKey } from "@/lib/grok-consulta";
import { copyToClipboard } from "@/lib/utils";

export function GrokConsulta({ seed = "" }: { seed?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [needKey, setNeedKey] = useState(false);

  const ask = async () => {
    const question = q.trim() || seed.trim();
    if (question.length < 2) {
      toast.message("Escribe qué quieres consultar");
      return;
    }
    if (key.trim() && key.trim() !== loadLocalGrokKey()) saveLocalGrokKey(key);
    setBusy(true);
    setAnswer("");
    try {
      const res = await queryGrok(question, seed);
      if (res.ok) {
        setNeedKey(false);
        setAnswer(res.answer);
        return;
      }
      if (res.needKey) {
        setNeedKey(true);
        toast.message(res.error);
        return;
      }
      toast.error(res.error);
    } catch {
      toast.error("No se pudo consultar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="chip inline-flex h-10 min-h-10 items-center gap-1.5 px-3 text-[0.7rem]"
        aria-label="Consultar a Grok"
        onClick={() => {
          setOpen(true);
          if (!q && seed) setQ(seed);
          setKey(loadLocalGrokKey());
        }}
      >
        <Sparkles className="size-4" />
        Grok
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 px-4 pt-4 pb-[calc(5.8rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold tracking-[0.12em] text-primary uppercase">Consulta Grok</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={seed ? seed : "Ej. FAAC 746 no cierra, error 3…"}
                aria-label="Pregunta para Grok"
                autoFocus
              />
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Preguntar
              </Button>
            </form>
            {needKey ? (
              <div className="rounded-md hud p-3">
                <p className="text-sm leading-relaxed text-muted">
                  En el teléfono pega una vez tu clave de xAI (console.x.ai → API keys) para que Grok
                  responda aquí. Si no, ábrelo en Grok.com con la misma pregunta.
                </p>
                <Input
                  className="mt-2"
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Clave xAI"
                  aria-label="Clave xAI"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      saveLocalGrokKey(key);
                      void ask();
                    }}
                  >
                    Guardar y preguntar
                  </Button>
                  <a
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    href={grokWebUrl(q.trim() || seed.trim() || "IASPOR puertas automáticas FAAC")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir Grok.com
                  </a>
                </div>
              </div>
            ) : null}
            {busy ? <p className="text-sm text-muted">Grok está pensando…</p> : null}
            {answer ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-md hud p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{answer}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={async () => {
                    const ok = await copyToClipboard(answer);
                    toast[ok ? "success" : "error"](ok ? "Copiado" : "No se pudo copiar");
                  }}
                >
                  Copiar respuesta
                </Button>
              </div>
            ) : !needKey ? (
              <p className="text-sm leading-relaxed text-muted">
                Pregunta por un motor, central, código de error o recambio. Si vienes de Buscar, ya trae ese modelo.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
