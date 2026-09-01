const MAX_BYTES = 5_500_000;
const MAX_PAGES = 6;

export async function extractPdfText(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const fallback = file.name.replace(/\.pdf$/i, "");
  if (file.size > MAX_BYTES) {
    onProgress?.(100);
    return fallback;
  }

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);
  if (data.byteLength < 8) return fallback;
  const head = String.fromCharCode(data[0], data[1], data[2], data[3], data[4]);
  if (!head.startsWith("%PDF")) throw new Error("NO_PDF");

  const task = pdfjs.getDocument({
    data,
    disableAutoFetch: true,
    disableStream: true,
    disableFontFace: true,
    stopAtErrors: false,
    verbosity: 0,
  });
  try {
    const pdf = await task.promise;
    try {
      const max = Math.min(pdf.numPages, MAX_PAGES);
      const chunks: string[] = [];
      for (let i = 1; i <= max; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const line = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ");
          chunks.push(line);
        } catch {
          /* página dañada */
        }
      }
      onProgress?.(100);
      return chunks.join("\n").trim() || fallback;
    } finally {
      const d = pdf as { destroy?: () => Promise<unknown>; cleanup?: () => Promise<unknown> };
      await (d.destroy?.() ?? d.cleanup?.());
    }
  } catch {
    return fallback;
  }
}
