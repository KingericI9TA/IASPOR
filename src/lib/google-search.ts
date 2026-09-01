/** Consultas para Google: simple primero, PDF después. */

function cleanQuery(query: string) {
  return query.replace(/\s+/g, " ").trim();
}

export function googleSimpleQuery(query: string) {
  return cleanQuery(query);
}

export function googlePdfQuery(query: string) {
  return `${cleanQuery(query)} filetype:pdf`;
}

export function googleWebQuery(query: string) {
  return cleanQuery(query);
}

export function googleImagesQuery(query: string) {
  return cleanQuery(query);
}

function href(q: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({
    q,
    hl: "es",
    pws: "0",
    ...extra,
  });
  return `https://www.google.com/search?${params.toString()}`;
}

export function googleSimpleUrl(query: string) {
  return href(googleSimpleQuery(query));
}

export function googlePdfUrl(query: string) {
  return href(googlePdfQuery(query));
}

export function googleWebUrl(query: string) {
  return href(googleWebQuery(query));
}

export function googleImagesUrl(query: string) {
  return href(googleImagesQuery(query), { tbm: "isch" });
}

export function googleHits(query: string): {
  title: string;
  url: string;
  kind: "page";
  snippet: string;
  brand?: string;
}[] {
  const q = cleanQuery(query);
  return [
    {
      title: `Google · ${q}`,
      url: googleSimpleUrl(q),
      kind: "page",
      snippet: "Búsqueda simple en Google (sin filtros).",
    },
    {
      title: `Google PDF · ${q}`,
      url: googlePdfUrl(q),
      kind: "page",
      snippet: "Google: documentos PDF.",
    },
    {
      title: `Google Imágenes · ${q}`,
      url: googleImagesUrl(q),
      kind: "page",
      snippet: "Google Imágenes.",
    },
  ];
}
