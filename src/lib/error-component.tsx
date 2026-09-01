import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

function messageOf(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (!raw || /invariant failed/i.test(raw)) {
    return "Esa función no está en esta copia. Cierra IASPOR del todo y ábrela otra vez. La búsqueda de Google abre el buscador en una pestaña.";
  }
  return raw;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Algo ha fallado</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">{messageOf(error)}</p>
      <button
        type="button"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
        onClick={() => window.location.reload()}
      >
        Recargar
      </button>
    </main>
  );
}
