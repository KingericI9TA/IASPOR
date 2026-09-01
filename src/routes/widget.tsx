import { createFileRoute, Link } from "@tanstack/react-router";
import { IconBuscar } from "@/components/cockpit-icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/brand-mark";

export const Route = createFileRoute("/widget")({ component: WidgetView });

function WidgetView() {
  const [q, setQ] = useState("");
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="hud w-full max-w-sm rounded-lg p-4">
        <BrandMark variant="banner" className="max-h-16" />
        <h1 className="sr-only">IASPOR</h1>
        <p className="mt-3 font-mono text-[10px] tracking-[0.22em] text-primary uppercase">
          FAACMATIC
        </p>
        <p className="mt-1 text-sm text-muted">Esquemas y manuales</p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const query = q.trim();
            if (!query) return;
            window.location.href = `/?q=${encodeURIComponent(query)}`;
          }}
        >
          <div className="relative flex-1">
            <IconBuscar className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Marca y modelo"
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" className="h-11">
            Ir
          </Button>
        </form>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          En Android: menú del navegador → Añadir a pantalla de inicio. Queda
          como acceso tipo widget. Un widget nativo de Play Store no se puede
          generar desde aquí.
        </p>
        <Link to="/" className="mt-3 inline-block text-sm text-primary hover:underline">
          Abrir app completa
        </Link>
      </div>
    </main>
  );
}
