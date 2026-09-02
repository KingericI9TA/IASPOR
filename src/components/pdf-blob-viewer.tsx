import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type PdfDoc = Awaited<ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>["promise"]>;

function pdfFile(blob: Blob, name: string) {
  const fileName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  return new File([blob], fileName, { type: "application/pdf" });
}

export function PdfBlobViewer({
  name,
  blob,
  onClose,
}: {
  name: string;
  blob: Blob;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("Abriendo PDF…");
  const [doc, setDoc] = useState<PdfDoc | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setStatus("Abriendo PDF…");
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const data = new Uint8Array(await blob.arrayBuffer());
        if (data.byteLength < 8) throw new Error("El archivo está vacío.");
        const head = String.fromCharCode(data[0], data[1], data[2], data[3]);
        if (head !== "%PDF") throw new Error("Este archivo no es un PDF válido.");
        const pdf = await pdfjs.getDocument({
          data,
          disableAutoFetch: true,
          disableStream: true,
          stopAtErrors: false,
          verbosity: 0,
        }).promise;
        if (cancelled) return;
        setDoc(pdf);
        setTotal(pdf.numPages);
        setPage(1);
        setStatus("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo abrir el PDF";
        if (!cancelled) setStatus(/password/i.test(msg) ? "Este PDF está protegido con contraseña." : msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void (async () => {
      try {
        setStatus("Cargando página…");
        const pdfPage = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const width = Math.min(900, canvas.parentElement?.clientWidth || 720);
        const scale = Math.max(0.9, width / base.width);
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
  }, [doc, page]);

  const openOutside = async () => {
    const file = pdfFile(blob, name);
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="border-b border-border px-3 py-3">
        <p className="truncate text-sm font-medium">{name}</p>
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
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
        <p className="font-mono text-xs text-muted">
          {total ? `Pág. ${page} / ${total}` : "PDF"}
        </p>
        <Button size="sm" variant="secondary" onClick={() => void openOutside()}>
          Abrir fuera
        </Button>
      </div>
    </div>
  );
}
