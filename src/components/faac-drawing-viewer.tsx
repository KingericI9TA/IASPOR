import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { drawingPageUrl, explosionTitle, loadFaacDrawing, resolveFaacExplosion, type DrawingExplosion, type DrawingPart } from "@/lib/faac-spares";
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
  const [explosions, setExplosions] = useState<DrawingExplosion[]>([]);
  const [picked, setPicked] = useState<DrawingPart | null>(null);
  const [url, setUrl] = useState<string | null>(drawingPageUrl(drawingId));
  const [stack, setStack] = useState<{ id: number; title: string }[]>([
    { id: drawingId, title: fallbackTitle ?? "Despiece FAAC" },
  ]);
  const activeId = stack[stack.length - 1]?.id ?? drawingId;

  const byPos = useMemo(() => {
    const map = new Map<string, DrawingPart>();
    for (const p of parts) map.set(p.pos, p);
    return map;
  }, [parts]);

  useEffect(() => {
    setStack([{ id: drawingId, title: fallbackTitle ?? "Despiece FAAC" }]);
    zoomRef.current = 1;
    setZoomLabel("100%");
  }, [drawingId]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === "Abriendo esquema…" ? "El esquema tardó demasiado." : s));
    }, 16_000);
    void (async () => {
      setStatus("Abriendo esquema…");
      setPicked(null);
      setSvg(null);
      setExplosions([]);
      setUrl(drawingPageUrl(activeId));
      try {
        const res = await loadFaacDrawing(activeId);
        if (cancelled) return;
        if (!res.ok) {
          setStatus(res.error);
          return;
        }
        setTitle(res.title || fallbackTitle || "Despiece FAAC");
        setParts(res.parts);
        setExplosions(res.explosions);
        setUrl(res.url);
        setSvg(res.svg);
        setStatus(res.svg || res.parts.length || res.explosions.length ? "" : "Sin piezas en este esquema.");
      } catch {
        if (!cancelled) setStatus("No se pudo cargar el despiece.");
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeId, fallbackTitle]);

  const applyZoom = (next: number) => {
    const z = Math.min(4, Math.max(1, Math.round(next * 10) / 10));
    zoomRef.current = z;
    setZoomLabel(`${Math.round(z * 100)}%`);
    const box = scrollerRef.current;
    const el = frameRef.current;
    const svgEl = el?.querySelector("svg");
    if (!box || !el || !(svgEl instanceof SVGElement)) return;
    const fit = Math.max(220, box.clientWidth - 16);
    const w = Math.round(fit * z);
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");
    svgEl.style.setProperty("width", `${w}px`, "important");
    svgEl.style.setProperty("height", "auto", "important");
    svgEl.style.setProperty("max-width", "none", "important");
    el.style.width = `${w}px`;
    el.style.maxWidth = "none";
  };

  useEffect(() => {
    if (!svg) return;
    const id = window.requestAnimationFrame(() => applyZoom(zoomRef.current));
    return () => window.cancelAnimationFrame(id);
  }, [svg]);

  useEffect(() => {
    if (!svg) return;
    const found = [...svg.matchAll(/\bdata-pos="(EXPL[^"]*)"/gi)].map((m) => m[1]);
    if (!found.length) return;
    setExplosions((prev) => {
      const have = new Set(prev.map((e) => e.pos));
      const extra = [...new Set(found)]
        .filter((pos) => !have.has(pos))
        .map((pos) => ({ pos, drawingId: 0, code: pos }));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }, [svg]);

  const zoomOut = () => {
    applyZoom(1);
    resetPageZoom();
    const box = scrollerRef.current;
    if (box) box.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  const openExplosion = (id: number, label: string, pos?: string) => {
    void (async () => {
      let dest = id;
      let title = label;
      if (!dest && pos) {
        setStatus("Abriendo despiece…");
        try {
          const hit = await resolveFaacExplosion(activeId, pos);
          if (!hit?.drawingId) {
            toast.error("No se pudo abrir ese despiece");
            setStatus("");
            return;
          }
          dest = hit.drawingId;
          title = explosionTitle(hit.code, hit.pos);
          setExplosions((prev) =>
            prev.map((e) => (e.pos === pos ? { ...e, drawingId: dest, code: hit.code } : e)),
          );
        } catch {
          toast.error("No se pudo abrir ese despiece");
          setStatus("");
          return;
        }
      }
      if (!dest || dest === activeId) return;
      setPicked(null);
      zoomRef.current = 1;
      setZoomLabel("100%");
      setStack((s) => [...s, { id: dest, title }]);
    })();
  };

  const goBack = () => {
    setPicked(null);
    zoomRef.current = 1;
    setZoomLabel("100%");
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  };

  const pickPart = (target: Element | null) => {
    if (target?.closest?.("[data-pieza-menu]")) return;
    const node = target?.closest?.("[data-pos]");
    const fromHotspot = node?.getAttribute("data-pos");
    const fromLabel = (target?.textContent || "").trim();
    const pos = fromHotspot || (byPos.has(fromLabel) ? fromLabel : /^EXPL/i.test(fromLabel) ? fromLabel : "");
    if (!pos) {
      setPicked(null);
      return;
    }
    const explAttr = node?.getAttribute("data-expl");
    const expl =
      explosions.find((e) => e.pos === pos) ||
      explosions.find((e) => e.drawingId && String(e.drawingId) === explAttr);
    if (expl || /^EXPL/i.test(pos)) {
      openExplosion(expl?.drawingId || Number(explAttr) || 0, explosionTitle(expl?.code || pos, pos), pos);
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

  const pickFromClient = (clientX: number, clientY: number, target: Element | null) => {
    if (target?.closest?.("[data-pieza-menu]")) return;
    const direct = target?.closest?.("[data-pos]");
    if (direct) {
      pickPart(direct);
      return;
    }
    const spots = scrollerRef.current?.querySelectorAll("[data-pos]");
    if (!spots?.length) {
      pickPart(target);
      return;
    }
    let best: Element | null = null;
    let bestD = Infinity;
    const pad = 36;
    spots.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) return;
      const x1 = r.left - pad;
      const y1 = r.top - pad;
      const x2 = r.right + pad;
      const y2 = r.bottom + pad;
      if (clientX < x1 || clientX > x2 || clientY < y1 || clientY > y2) return;
      const cx = (r.left + r.right) / 2;
      const cy = (r.top + r.bottom) / 2;
      const d = (clientX - cx) ** 2 + (clientY - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    });
    pickPart(best ?? target);
  };

  const line = picked
    ? formatPedidoText([{ id: "x", code: picked.code, name: picked.name, qty: 1 }])
    : "";

  const showIframe = Boolean(url && !svg);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#b7c0c9] text-[#101820]">
      <div className="border-b border-[#8a9aaa] bg-[#f3efe4] px-3 py-3">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-[#3a4a5c]">
          {svg
            ? explosions.length
              ? "Toca EXPL. o la lista azul para abrir el otro despiece."
              : "+ / − para ampliar. Al tocar una pieza se aleja."
            : "Toca una pieza de la lista para copiar o añadir al pedido."}
        </p>
        {svg ? (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-12 text-lg font-semibold"
              onClick={() => applyZoom(zoomRef.current - 0.5)}
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
              onClick={() => applyZoom(zoomRef.current + 0.5)}
            >
              +
            </Button>
          </div>
        ) : null}
      </div>
      <div
        ref={scrollerRef}
        className="faac-drawing relative min-h-0 flex-1 overflow-auto p-2"
        onPointerUp={(e) => {
          if (!svg) return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const t = e.target as Element;
          if (t.closest("button, a, [data-pieza-menu]")) return;
          e.preventDefault();
          e.stopPropagation();
          pickFromClient(e.clientX, e.clientY, t);
        }}
      >
        {status ? <p className="px-2 py-4 text-sm text-muted">{status}</p> : null}
        {showIframe ? (
          <iframe
            title={title}
            src={url ?? undefined}
            className="mb-2 h-[min(42dvh,280px)] w-full rounded-md border border-[#8a9aaa] bg-white"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : null}
        {svg ? (
          <div ref={frameRef}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        ) : null}
        {explosions.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {explosions.map((e) => (
              <li key={`${e.drawingId}-${e.pos}`}>
                <button
                  type="button"
                  className="w-full rounded-md bg-[#d7ebf7] px-3 py-3 text-left"
                  onClick={() => openExplosion(e.drawingId, explosionTitle(e.code, e.pos), e.pos)}
                >
                  <p className="font-medium leading-snug">Abrir {explosionTitle(e.code, e.pos)}</p>
                  <p className="mt-0.5 font-mono text-xs text-[#1d4f7a]">{e.pos}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {parts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {parts.map((p) => (
              <li key={`${p.id}-${p.pos}`}>
                <button
                  type="button"
                  className={`w-full rounded-md px-3 py-2 text-left ${
                    picked?.id === p.id ? "bg-[#dfe7ee]" : "bg-[#eef2f6]"
                  }`}
                  onClick={() => {
                    zoomOut();
                    setPicked(p);
                    scrollerRef.current
                      ?.querySelectorAll(".faac-hotspot.is-on")
                      .forEach((el) => el.classList.remove("is-on"));
                    scrollerRef.current
                      ?.querySelector(`[data-pos="${CSS.escape(p.pos)}"]`)
                      ?.classList.add("is-on");
                  }}
                >
                  <p className="font-medium leading-snug">{p.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-[#1d4f7a]">
                    pos. {p.pos}
                    {p.code ? ` · (${p.code})` : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
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
          {stack.length > 1 ? (
            <Button variant="secondary" className="h-12 min-w-28 font-semibold" onClick={goBack}>
              Volver
            </Button>
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
