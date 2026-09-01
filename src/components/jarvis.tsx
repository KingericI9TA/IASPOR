import { useState } from "react";
import { toast } from "sonner";
import { IconJarvis } from "@/components/cockpit-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { jarvisWebUrl } from "@/lib/jarvis";

export function JarvisConsulta({ seed = "" }: { seed?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const question = q.trim() || seed.trim();

  const openGrok = () => {
    if (question.length < 2) {
      toast.message("Escribe qué quieres consultar");
      return;
    }
    window.open(jarvisWebUrl(question), "_blank", "noopener,noreferrer");
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
                openGrok();
              }}
            >
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={seed ? seed : "Ej. FAAC 746 no cierra, error 3…"}
                aria-label="Pregunta para Jarvis"
                autoFocus
              />
              <Button type="submit">
                <IconJarvis className="size-5" />
                Preguntar
              </Button>
            </form>
            <Button type="button" onClick={openGrok}>
              Abrir Grok
            </Button>
            <p className="text-sm leading-relaxed text-muted">
              Preguntar abre Grok con esa pregunta.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
