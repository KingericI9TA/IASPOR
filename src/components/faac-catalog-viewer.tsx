import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FAAC_CATALOG_PDF, FAAC_CATALOG_TITLE, type FaacCatalogHit } from "@/lib/faac-catalog";

type PdfDoc = Awaited<ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>["promise"]>;

const pdfCache = new Map<string, Promise<PdfDoc>>();

async function loadCatalogPdf(url: string) {
  const hit = pdfCache.get(url);
  if (hit) return hit;
  const pending = (async () => {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs.getDocument({
      url,
      disableAutoFetch: true,
      disableStream: false,
    }).promise;
  })();
  pdfCache.set(url, pending);
  return pending;
}

export function FaacCatalogViewer({
  hit,
  onClose,
  pdfUrl = FAAC_CATALOG_PDF,
  catalogTitle = FAAC_CATALOG_TITLE,
}: {
  hit: FaacCatalogHit;
  onClose: () => void;
  pdfUrl?: string;
  catalogTitle?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(hit.page);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(`Abriendo ${catalogTitle}…`);

  useEffect(() => {
    setPage(hit.page);
  }, [hit.page]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setStatus("Cargando página…");
        const pdf = await loadCatalogPdf(pdfUrl);
        if (cancelled) return;
        setTotal(pdf.numPages);
        const pg = Math.min(Math.max(1, page), pdf.numPages);
        const pdfPage = await pdf.getPage(pg);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const width = Math.min(900, canvas.parentElement?.clientWidth || 720);
        const scale = Math.max(0.8, width / base.width);
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) setStatus("");
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : "No se pudo pintar la página");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, pdfUrl]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="border-b border-border px-3 py-3">
        <p className="truncate text-sm font-medium">{hit.title} · pág. {hit.print}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            size="lg"
            variant="secondary"
            className="h-14 text-base font-semibold"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="h-14 text-base font-semibold"
            onClick={() => setPage((p) => (total ? Math.min(total, p + 1) : p + 1))}
            disabled={!!total && page >= total}
          >
            Siguiente
          </Button>
          <Button size="lg" variant="secondary" className="h-14 text-base font-semibold" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-raised p-2">
        {status ? <p className="px-2 py-4 text-sm text-muted">{status}</p> : null}
        <canvas ref={canvasRef} className="mx-auto max-w-full bg-fg" />
      </div>
      <p className="border-t border-border px-3 py-2 text-center font-mono text-xs text-muted">
        {catalogTitle} · PDF pág. {page}
        {total ? ` / ${total}` : ""} ·{" "}
        <a
          href={`${pdfUrl}#page=${page}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          Abrir archivo
        </a>
      </p>
    </div>
  );
}
