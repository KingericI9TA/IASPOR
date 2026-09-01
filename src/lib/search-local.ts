import { BRANDS, type Brand } from "./brands";
import { CATALOG, type CatalogDoc } from "./catalog";
import { googlePdfUrl } from "@/lib/google-search";
import { type LibraryDoc } from "./library";
import { normalize } from "./utils";

export type LocalHit = {
  source: "archivo" | "catalogo";
  score: number;
  library?: LibraryDoc;
  catalog?: CatalogDoc;
  brand?: Brand;
};

export function searchLocal(
  query: string,
  library: LibraryDoc[],
  extraCatalog: CatalogDoc[] = [],
): LocalHit[] {
  const q = normalize(query);
  if (!q) return [];
  const parts = q.split(" ").filter(Boolean);
  const hits: LocalHit[] = [];

  for (const doc of library) {
    const hay = normalize(`${doc.name} ${doc.brandId ?? ""} ${doc.text.slice(0, 50_000)}`);
    const matched = parts.filter((p) => hay.includes(p)).length;
    if (matched === 0) continue;
    const brand = BRANDS.find((b) => b.id === doc.brandId);
    hits.push({
      source: "archivo",
      score: matched * 10 + (doc.favorite ? 3 : 0),
      library: doc,
      brand,
    });
  }

  for (const cat of [...CATALOG, ...extraCatalog]) {
    const brand = BRANDS.find((b) => b.id === cat.brandId);
    const hay = normalize(
      `${cat.title} ${cat.model} ${cat.keywords.join(" ")} ${brand?.name ?? ""} ${brand?.aliases.join(" ") ?? ""} ${cat.hint}`,
    );
    const matched = parts.filter((p) => hay.includes(p)).length;
    if (matched === 0) continue;
    hits.push({
      source: "catalogo",
      score: matched * 6,
      catalog: cat,
      brand,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, 24);
}

export function googleQuery(brandName: string, extra: string) {
  return googlePdfUrl(`${brandName} ${extra}`.trim());
}
