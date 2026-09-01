import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IconJarvis } from "@/components/cockpit-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jarvisWebUrl, queryJarvis } from "@/lib/jarvis";
import { copyToClipboard } from "@/lib/utils";

export function JarvisConsulta({ seed = "" }: { seed?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  const question = q.trim() || seed.trim();

  const ask = async () => {
    if (question.length < 2) {
      toast.message("Escribe qué quieres consultar");
      return;
    }
    setBusy(true);
    setAnswer("");
    try {
      const res = await queryJarvis(question);
      if (res.ok) setAnswer(res.answer);
      else toast.error(res.error);
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
        aria-label="Consultar a Jarvis"
        onClick={() => {
          setOpen(true);
          if (!q && seed) setQ(seed);
        }}
      >
        <IconJarvis className="size-5" />
        Jarvis
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 px-4 pt-4 pb-[calc(5.8rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.12em] text-lamp-amber uppercase">
                <IconJarvis className="size-6" />
                Jarvis
              </p>
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
                aria-label="Pregunta para Jarvis"
                autoFocus
              />
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <IconJarvis className="size-5" />}
                Preguntar
              </Button>
            </form>
            <a
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
              href={jarvisWebUrl(question || "IASPOR puertas automáticas")}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir Grok
            </a>
            {busy ? <p className="text-sm text-muted">Jarvis está pensando…</p> : null}
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
                  Copiar
                </Button>
              </div>
            ) : !busy ? (
              <p className="text-sm leading-relaxed text-muted">
                Pregunta a Grok por un motor, error o recambio. No usa tus PDFs. Si vienes de Buscar, ya trae ese modelo.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
