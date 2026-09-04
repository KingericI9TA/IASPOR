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
    const href = jarvisWebUrl(question);
    const win = window.open(href, "_blank", "noopener,noreferrer");
    if (!win) window.location.assign(href);
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
        <div
          className="fixed inset-0 z-50 flex flex-col bg-bg px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col justify-start gap-3"
            onClick={(e) => e.stopPropagation()}
          >
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
                placeholder={seed ? seed : "Pregunta…"}
                aria-label="Pregunta para Jarvis"
                autoFocus
              />
              <Button
                asChild
              >
                <a
                  href={question.length >= 2 ? jarvisWebUrl(question) : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (question.length < 2) {
                      e.preventDefault();
                      toast.message("Escribe qué quieres consultar");
                    }
                  }}
                >
                  Preguntar
                </a>
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
