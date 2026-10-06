import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { drawingPageUrl, explosionTitle, loadFaacDrawing, resolveFaacExplosion, type DrawingExplosion, type DrawingPart } from "@/lib/faac-spares";
import { formatPedidoText } from "@/lib/faac-pedido";
import { copyToClipboard } from "@/lib/utils";

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
  const [hits, setHits] = useState<{ key: string; pos: string; left: number; top: number }[]>([]);
  const [url, setUrl] = useState<string | null>(drawingPageUrl(drawingId));
  const [stack, setStack] = useState<{ id: number; title: string }[]>([
    { id: drawingId, title: fallbackTitle ?? "Despiece FAAC" },
  ]);
  const activeId = stack[stack.length - 1]?.id ?? drawingId;

  const byPos = useMemo(() => {
    const map = new Map<string, DrawingPart>();
    const norm = (pos: string) => {
      const t = pos.trim();
      return /^\d+$/.test(t) ? String(Number(t)) : t.toUpperCase();
    };
    for (const p of parts) {
      map.set(p.pos, p);
      map.set(norm(p.pos), p);
    }
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
      setHits([]);
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
    const vb = svgEl.viewBox.baseVal;
    const vw = (vb && vb.width) || Number.parseFloat(svgEl.getAttribute("width") || "") || 800;
    const vh = (vb && vb.height) || Number.parseFloat(svgEl.getAttribute("height") || "") || 500;
    const availW = Math.max(240, box.clientWidth - 8);
    const availH = Math.max(280, box.clientHeight - 8);
    const widthForHeight = vh > 0 ? availH * (vw / vh) : availW;
    const base = Math.max(availW, widthForHeight);
    const w = Math.round(base * z);
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");
    svgEl.style.setProperty("width", `${w}px`, "important");
    svgEl.style.setProperty("height", "auto", "important");
    svgEl.style.setProperty("max-width", "none", "important");
    el.style.width = `${w}px`;
    el.style.maxWidth = "none";
    window.requestAnimationFrame(() => {
      const host = el.getBoundingClientRect();
      const placed: { key: string; pos: string; left: number; top: number }[] = [];
      svgEl.querySelectorAll("[data-pos]").forEach((node, i) => {
        const pos = node.getAttribute("data-pos") || "";
        if (!pos) return;
        const rect = node.querySelector("rect:not(.faac-hit)") ?? node.querySelector("rect");
        const b = (rect ?? node).getBoundingClientRect();
        if (b.width < 0.4 && b.height < 0.4) return;
        placed.push({
          key: `${pos}-${i}`,
          pos,
          left: b.left - host.left + b.width / 2,
          top: b.top - host.top + b.height / 2,
        });
      });
      setHits(placed);
    });
  };

  useEffect(() => {
    if (!svg) return;
    let id2 = 0;
    const id1 = window.requestAnimationFrame(() => {
      applyZoom(zoomRef.current);
      id2 = window.requestAnimationFrame(() => applyZoom(zoomRef.current));
    });
    return () => {
      window.cancelAnimationFrame(id1);
      window.cancelAnimationFrame(id2);
    };
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

  const selectPos = (pos: string) => {
    if (/^EXPL/i.test(pos)) {
      const expl = explosions.find((e) => e.pos.toUpperCase() === pos.toUpperCase());
      openExplosion(
        expl?.drawingId || 0,
        explosionTitle(expl?.code || pos, pos),
        pos,
      );
      return;
    }
    const key = /^\d+$/.test(pos.trim()) ? String(Number(pos.trim())) : pos.trim().toUpperCase();
    const part = byPos.get(pos) || byPos.get(key);
    if (!part) {
      toast.error(`Sin ficha para la pos. ${pos}`);
      return;
    }
    setPicked(part);
    toast.success(`Pos. ${part.pos}${part.code ? ` · ${part.code}` : ""}`);
    scrollerRef.current?.querySelectorAll(".faac-hotspot.is-on").forEach((el) => el.classList.remove("is-on"));
    scrollerRef.current?.querySelector(`[data-pos="${CSS.escape(pos)}"]`)?.classList.add("is-on");
  };

  const nearestPos = (clientX: number, clientY: number) => {
    const frame = frameRef.current;
    if (!frame || hits.length === 0) return "";
    const host = frame.getBoundingClientRect();
    let best = "";
    let bestD = 64;
    for (const hit of hits) {
      const d = Math.hypot(clientX - (host.left + hit.left), clientY - (host.top + hit.top));
      if (d < bestD) {
        bestD = d;
        best = hit.pos;
      }
    }
    return best;
  };

  const line = picked
    ? formatPedidoText([{ id: "x", code: picked.code, name: picked.name, qty: 1 }])
    : "";

  const showIframe = Boolean(url && !svg);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#b7c0c9] text-[#101820]">
      <div className="flex items-center gap-1.5 border-b border-[#8a9aaa] bg-[#f3efe4] px-2 py-1.5">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        {stack.length > 1 ? (
          <Button type="button" variant="secondary" className="h-11 shrink-0 px-3 font-semibold" onClick={goBack}>
            Volver
          </Button>
        ) : null}
        {svg ? (
          <div className="grid w-[9.6rem] shrink-0 grid-cols-3 gap-1">
            <Button type="button" variant="secondary" className="h-11 text-lg font-semibold" onClick={() => applyZoom(zoomRef.current - 0.5)}>
              −
            </Button>
            <Button type="button" variant="secondary" className="h-11 px-0 text-xs font-semibold" onClick={() => applyZoom(1)}>
              {zoomLabel}
            </Button>
            <Button type="button" variant="secondary" className="h-11 text-lg font-semibold" onClick={() => applyZoom(zoomRef.current + 0.5)}>
              +
            </Button>
          </div>
        ) : null}
        <Button type="button" variant="secondary" className="h-11 shrink-0 px-3 font-semibold" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <div
        ref={scrollerRef}
        className="faac-drawing relative min-h-0 flex-1 overflow-auto p-1"
        onClick={(e) => {
          const t = e.target as Element | null;
          if (t?.closest("button, a, [data-pieza-menu]")) return;
          const pos = nearestPos(e.clientX, e.clientY);
          if (pos) selectPos(pos);
        }}
      >
        {status ? <p className="px-2 py-4 text-sm text-muted">{status}</p> : null}
        {showIframe ? (
          <iframe
            title={title}
            src={url ?? undefined}
            className="h-full min-h-[58dvh] w-full border border-[#8a9aaa] bg-white"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : null}
        {svg ? (
          <div ref={frameRef} className="relative">
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            {hits.map((hit) => (
              <button
                key={hit.key}
                type="button"
                className={`faac-tap${/^EXPL/i.test(hit.pos) ? " is-expl" : ""}${picked?.pos === hit.pos ? " is-on" : ""}`}
                style={{ left: hit.left, top: hit.top }}
                aria-label={`Posición ${hit.pos}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectPos(hit.pos);
                }}
              >
                {/^EXPL/i.test(hit.pos) ? "EX" : hit.pos}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {explosions.length > 0 || parts.length > 0 ? (
        <div className="max-h-[24dvh] overflow-auto border-t border-[#8a9aaa] bg-[#cfd6dd] px-2 py-1.5">
          {explosions.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {explosions.map((e) => (
                <li key={`${e.drawingId}-${e.pos}`}>
                  <button
                    type="button"
                    className="w-full rounded-md bg-[#d7ebf7] px-3 py-2.5 text-left"
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
            <ul className={`${explosions.length ? "mt-1.5" : ""} flex flex-col gap-1`}>
              {parts.map((p) => (
                <li key={`${p.id}-${p.pos}`}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-3 py-2 text-left ${
                      picked?.id === p.id ? "bg-[#dfe7ee]" : "bg-[#eef2f6]"
                    }`}
                    onClick={() => selectPos(p.pos)}
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
      ) : null}
      {picked ? (
        <div data-pieza-menu className="pedido-actions border-t border-[#c4b9a4] bg-[#f3efe4] px-3 py-2">
          <p className="font-medium leading-snug">{picked.name}</p>
          <p className="mt-0.5 font-mono text-xs text-primary">
            pos. {picked.pos} · ({picked.code})
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              className="h-11 text-sm font-semibold"
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
              className="h-11 text-sm font-semibold"
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
    </div>
  );
}
