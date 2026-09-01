import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { fetchFaacDrawing, type DrawingPart } from "@/lib/faac-spares";
import { isStaticHost } from "@/lib/static-host";
import { formatPedidoText } from "@/lib/faac-pedido";
import { copyToClipboard } from "@/lib/utils";

function resetPageZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const orig = meta.getAttribute("content") ?? "width=device-width, initial-scale=1, viewport-fit=cover";
  meta.setAttribute(
    "content",
    "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
  );
  window.setTimeout(() => meta.setAttribute("content", orig), 120);
}

export function FaacDrawingViewer({
  drawingId,
  fallbackTitle,
  onClose,
  onAdd,
}: {
  drawingId: number;
  fallbackTitle?: string;
  onClose: () => void;
  onAdd: (item: { code: string; name: string }) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [zoomLabel, setZoomLabel] = useState("100%");
  const [status, setStatus] = useState("Abriendo esquema…");
  const [title, setTitle] = useState(fallbackTitle ?? "Despiece FAAC");
  const [svg, setSvg] = useState<string | null>(null);
  const [parts, setParts] = useState<DrawingPart[]>([]);
  const [picked, setPicked] = useState<DrawingPart | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const byPos = useMemo(() => {
    const map = new Map<string, DrawingPart>();
    for (const p of parts) map.set(p.pos, p);
    return map;
  }, [parts]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "Abriendo esquema…" ? "El esquema tardó demasiado." : s));
    }, 16_000);
    void (async () => {
      setStatus("Abriendo esquema…");
      setPicked(null);
      setSvg(null);
      if (isStaticHost()) {
        setStatus("El despiece online no está en esta copia. Ábrelo en spareparts.faacgroup.com.");
        return;
      }
      try {
        const res = await fetchFaacDrawing({ data: { drawingId } });
        if (cancelled) return;
        if (!res.ok) {
          setStatus(res.error);
          return;
        }
        setTitle(res.title);
        setParts(res.parts);
        setUrl(res.url);
        setSvg(res.svg);
        setStatus("");
      } catch {
        if (!cancelled) setStatus("No se pudo cargar el despiece.");
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [drawingId]);

  const applyZoom = (next: number) => {
    const z = Math.min(4, Math.max(1, Math.round(next * 20) / 20));
    zoomRef.current = z;
    setZoomLabel(`${Math.round(z * 100)}%`);
    const el = frameRef.current;
    if (!el) return;
    el.style.zoom = String(z);
    el.style.transform = "";
  };

  const zoomOut = () => {
    applyZoom(1);
    resetPageZoom();
    const box = scrollerRef.current;
    if (box) box.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  const pickPart = (target: Element | null) => {
    if (target?.closest?.("[data-pieza-menu]")) return;
    const node = target?.closest?.("[data-pos]");
    const fromHotspot = node?.getAttribute("data-pos");
    const fromLabel = (target?.textContent || "").trim();
    const pos = fromHotspot || (byPos.has(fromLabel) ? fromLabel : "");
    if (!pos) {
      setPicked(null);
      return;
    }
    const part = byPos.get(pos);
    if (!part) return;
    zoomOut();
    setPicked(part);
    scrollerRef.current?.querySelectorAll(".faac-hotspot.is-on").forEach((el) => el.classList.remove("is-on"));
    const mark = node ?? scrollerRef.current?.querySelector(`[data-pos="${CSS.escape(pos)}"]`);
    mark?.classList.add("is-on");
  };

  const line = picked
    ? formatPedidoText([{ id: "x", code: picked.code, name: picked.name, qty: 1 }])
    : "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#b7c0c9] text-[#101820]">
      <div className="border-b border-[#8a9aaa] bg-[#f3efe4] px-3 py-3">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-[#3a4a5c]">+ / − para ampliar. Al tocar una pieza se aleja.</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-12 text-lg font-semibold"
            onClick={() => applyZoom(zoomRef.current - 0.25)}
          >
            −
          </Button>
          <Button type="button" variant="secondary" className="h-12 font-semibold" onClick={() => applyZoom(1)}>
            {zoomLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 text-lg font-semibold"
            onClick={() => applyZoom(zoomRef.current + 0.25)}
          >
            +
          </Button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="faac-drawing relative min-h-0 flex-1 overflow-auto p-2"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          pickPart(e.target as Element);
        }}
      >
        {status ? <p className="px-2 py-4 text-sm text-muted">{status}</p> : null}
        {svg ? (
          <div ref={frameRef}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        ) : null}
      </div>
      {picked ? (
        <div data-pieza-menu className="pedido-actions border-t border-[#c4b9a4] bg-[#f3efe4] px-3 py-3">
          <p className="font-medium leading-snug">{picked.name}</p>
          <p className="mt-1 font-mono text-xs text-primary">
            pos. {picked.pos} · ({picked.code})
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              className="h-12 text-sm font-semibold"
              variant="secondary"
              onClick={async () => {
                const ok = await copyToClipboard(line);
                if (ok) toast.success("Copiado");
                else toast.error("No se pudo copiar");
              }}
            >
              Copiar
            </Button>
            <Button
              className="h-12 text-sm font-semibold"
              onClick={() => {
                onAdd({ code: picked.code, name: picked.name });
                toast.success("Añadido al pedido FAAC");
              }}
            >
              Añadir
            </Button>
          </div>
        </div>
      ) : null}
      <div className="border-t border-[#c4b9a4] bg-[#f3efe4] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          {url ? (
            <button
              type="button"
              className="text-xs text-primary underline-offset-4 hover:underline"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              Abrir en FAAC
            </button>
          ) : (
            <span />
          )}
          <Button variant="secondary" className="h-12 min-w-28 font-semibold" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
