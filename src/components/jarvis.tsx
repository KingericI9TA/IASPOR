import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { IconJarvis } from "@/components/cockpit-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askJarvisClient } from "@/lib/jarvis";

type Msg = { role: "user" | "jarvis"; text: string; source?: "grok" | "campo" };

export function JarvisConsulta({ seed = "" }: { seed?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);

  const question = q.trim() || seed.trim();

  const ask = async () => {
    if (question.length < 2) {
      toast.message("Escribe qué quieres consultar");
      return;
    }
    setBusy(true);
    setMsgs((prev) => [...prev, { role: "user", text: question }]);
    setQ("");
    try {
      const res = await askJarvisClient(question);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setMsgs((prev) => [...prev, { role: "jarvis", text: res.text, source: res.source }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Jarvis no respondió");
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
        <div
          className="fixed inset-0 z-50 flex flex-col bg-bg px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col justify-start gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {msgs.length > 0 || busy ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md hud p-3 flex flex-col gap-3">
                {msgs.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={
                      m.role === "user"
                        ? "self-end max-w-[92%] rounded-md bg-primary/15 px-3 py-2 text-sm"
                        : "self-start max-w-[92%] rounded-md bg-raised px-3 py-2 text-sm whitespace-pre-wrap"
                    }
                  >
                    {m.text}
                  </div>
                ))}
                {busy ? (
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" /> Pensando…
                  </p>
                ) : null}
              </div>
            ) : null}
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
                placeholder={seed ? seed : "Pregunta…"}
                aria-label="Pregunta para Jarvis"
                autoFocus
              />
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                Preguntar
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
