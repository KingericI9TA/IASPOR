const MAX_EDGE = 8192;

export async function paintPdfPage(pdfPage: unknown, canvas: HTMLCanvasElement, cssWidth: number, zoom = 1) {
  const page = pdfPage as {
    getViewport: (params: { scale: number }) => { width: number; height: number };
    render: (params: {
      canvasContext: CanvasRenderingContext2D;
      viewport: unknown;
      canvas: HTMLCanvasElement;
      transform?: number[];
    }) => { promise: Promise<unknown> };
  };
  const base = page.getViewport({ scale: 1 });
  const width = Math.max(280, cssWidth) * Math.min(4, Math.max(1, zoom));
  const scale = width / base.width;
  const viewport = page.getViewport({ scale });
  const dpr = typeof window === "undefined" ? 2 : Math.min(3, window.devicePixelRatio || 1);
  let outputScale = Math.max(2, dpr);
  let bw = Math.floor(viewport.width * outputScale);
  let bh = Math.floor(viewport.height * outputScale);
  const edge = Math.max(bw, bh);
  if (edge > MAX_EDGE) {
    outputScale *= MAX_EDGE / edge;
    bw = Math.floor(viewport.width * outputScale);
    bh = Math.floor(viewport.height * outputScale);
  }
  canvas.width = bw;
  canvas.height = bh;
  canvas.style.width = `${Math.round(viewport.width)}px`;
  canvas.style.height = `${Math.round(viewport.height)}px`;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("No se pudo pintar la página");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const task = page.render({
    canvasContext: ctx,
    viewport,
    canvas,
    transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
  });
  try {
    await task.promise;
  } catch (e) {
    if (e instanceof Error && /cancel/i.test(e.message)) return;
    throw e;
  }
}
