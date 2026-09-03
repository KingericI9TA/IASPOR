export type Brand = {
  id: string;
  name: string;
  aliases: string[];
  origin: string;
  site: string;
  manuals: string;
};

export const BRANDS: Brand[] = [
  {
    id: "faac",
    name: "FAAC",
    aliases: ["faac", "genius faac"],
    origin: "Italia",
    site: "https://www.faac.com",
    manuals: "https://www.faac.com/int-en/support/",
  },
  {
    id: "nice",
    name: "Nice",
    aliases: ["nice", "nice for you", "niceforyou", "flo", "flor"],
    origin: "Italia",
    site: "https://www.niceforyou.com",
    manuals: "https://www.niceforyou.com/es/descargas",
  },
  {
    id: "came",
    name: "CAME",
    aliases: ["came", "came bpt"],
    origin: "Italia",
    site: "https://www.came.com",
    manuals: "https://www.came.com/global/en/support/",
  },
  {
    id: "bft",
    name: "BFT",
    aliases: ["bft", "bft automation"],
    origin: "Italia",
    site: "https://www.bft-automation.com",
    manuals: "https://www.bft-automation.com/es_ES/descargas/",
  },
  {
    id: "beninca",
    name: "Beninca",
    aliases: ["beninca", "benincà"],
    origin: "Italia",
    site: "https://www.beninca.com",
    manuals: "https://www.beninca.com/es/download",
  },
  {
    id: "erreka",
    name: "Erreka",
    aliases: ["erreka"],
    origin: "España",
    site: "https://www.erreka.com",
    manuals: "https://www.erreka.com/es/descargas/",
  },
  {
    id: "v2",
    name: "V2",
    aliases: ["v2", "v2 spa", "v2city"],
    origin: "Italia",
    site: "https://www.v2spa.com",
    manuals: "https://www.v2spa.com/download/",
  },
  {
    id: "motorline",
    name: "Motorline",
    aliases: ["motorline", "motorline professional"],
    origin: "Portugal",
    site: "https://www.motorline.pt",
    manuals: "https://www.motorline.pt/downloads/",
  },
  {
    id: "pujol",
    name: "Pujol",
    aliases: ["pujol", "pujol cil", "ducati pujol"],
    origin: "España",
    site: "https://www.pujol.es",
    manuals: "https://www.pujol.es",
  },
  {
    id: "clemsa",
    name: "Clemsa",
    aliases: ["clemsa", "clamsa", "mutancode"],
    origin: "España",
    site: "https://www.clemsa.es",
    manuals: "https://www.clemsa.es",
  },
  {
    id: "cdvi",
    name: "CDVI",
    aliases: [
      "cdvi",
      "cdv",
      "cdvi iberica",
      "cdvi ibérica",
      "digicode",
      "atrium cdvi",
    ],
    origin: "Francia",
    site: "https://www.cdvi.com",
    manuals: "https://www.cdviberica.com/es/soporte-tecnico-cdvi/",
  },
  {
    id: "visiotech",
    name: "Visiotech",
    aliases: [
      "visiotech",
      "visiotechsecurity",
      "visiotech.com",
      "visiotech security",
    ],
    origin: "España / Europa",
    site: "https://www.visiotechsecurity.com/es/",
    manuals: "https://support.visiotechsecurity.com/hc/es",
  },
  {
    id: "safire",
    name: "Safire",
    aliases: ["safire", "safire smart", "sf-", "safire control center"],
    origin: "Visiotech",
    site: "https://www.visiotechsecurity.com/es/",
    manuals: "https://support.visiotechsecurity.com/hc/es",
  },
  {
    id: "nivian",
    name: "Nivian",
    aliases: ["nivian"],
    origin: "Visiotech",
    site: "https://www.visiotechsecurity.com/es/productos/videoporteros",
    manuals: "https://support.visiotechsecurity.com/hc/es",
  },
  {
    id: "hormann",
    name: "Hörmann",
    aliases: ["hormann", "hörmann", "supramatic", "promatic"],
    origin: "Alemania",
    site: "https://www.hormann.es",
    manuals: "https://www.hormann.es/servicio/descargas/",
  },
  {
    id: "marantec",
    name: "Marantec",
    aliases: ["marantec", "comfort"],
    origin: "Alemania",
    site: "https://www.marantec.com",
    manuals: "https://www.marantec.com",
  },
  {
    id: "dea",
    name: "DEA System",
    aliases: ["dea", "dea system"],
    origin: "Italia",
    site: "https://www.deasystem.com",
    manuals: "https://www.deasystem.com/download/",
  },
  {
    id: "roger",
    name: "Roger Technology",
    aliases: ["roger", "roger technology", "brushless"],
    origin: "Italia",
    site: "https://www.rogertechnology.com",
    manuals: "https://www.rogertechnology.com/es/descargas/",
  },
  {
    id: "sommer",
    name: "SOMMER",
    aliases: ["sommer"],
    origin: "Alemania",
    site: "https://www.sommer.eu",
    manuals: "https://www.sommer.eu",
  },
  {
    id: "key",
    name: "Key Automation",
    aliases: ["key", "key automation"],
    origin: "Italia",
    site: "https://www.keyautomation.com",
    manuals: "https://www.keyautomation.com",
  },
  {
    id: "ditec",
    name: "Ditec",
    aliases: ["ditec", "ditec entrematic", "entrematic"],
    origin: "Italia",
    site: "https://www.ditecautomations.com",
    manuals: "https://www.ditecautomations.com",
  },
  {
    id: "cardin",
    name: "Cardin",
    aliases: ["cardin"],
    origin: "Italia",
    site: "https://www.cardin.it",
    manuals: "https://www.cardin.it",
  },
  {
    id: "gibidi",
    name: "Gibidi",
    aliases: ["gibidi"],
    origin: "Italia",
    site: "https://www.gibidi.com",
    manuals: "https://www.gibidi.com",
  },
  {
    id: "comunello",
    name: "Comunello",
    aliases: ["comunello"],
    origin: "Italia",
    site: "https://www.comunello.com",
    manuals: "https://www.comunello.com",
  },
  {
    id: "fadini",
    name: "Fadini",
    aliases: ["fadini"],
    origin: "Italia",
    site: "https://www.fadini.net",
    manuals: "https://www.fadini.net",
  },
  {
    id: "tau",
    name: "TAU",
    aliases: ["tau", "tau italia"],
    origin: "Italia",
    site: "https://www.tauitalia.com",
    manuals: "https://www.tauitalia.com",
  },
  {
    id: "sea",
    name: "SEA",
    aliases: ["sea", "sea srl"],
    origin: "Italia",
    site: "https://www.sea-srl.com",
    manuals: "https://www.sea-srl.com",
  },
  {
    id: "proteco",
    name: "Proteco",
    aliases: ["proteco"],
    origin: "Italia",
    site: "https://www.proteco.net",
    manuals: "https://www.proteco.net",
  },
  {
    id: "aprimatic",
    name: "Aprimatic",
    aliases: ["aprimatic"],
    origin: "Italia / España",
    site: "https://www.aprimatic.com",
    manuals: "https://www.aprimatic.com",
  },
  {
    id: "somfy",
    name: "Somfy",
    aliases: ["somfy", "tahoma", "rts"],
    origin: "Francia",
    site: "https://www.somfy.es",
    manuals: "https://www.somfy.es",
  },
  {
    id: "genius",
    name: "Genius",
    aliases: ["genius", "genius faac"],
    origin: "Italia",
    site: "https://www.geniusg.com",
    manuals: "https://www.geniusg.com",
  },
  {
    id: "life",
    name: "Life Home",
    aliases: ["life", "life home integration"],
    origin: "Italia",
    site: "https://www.homelife.it",
    manuals: "https://www.homelife.it",
  },
  {
    id: "bft-al",
    name: "Allmatic",
    aliases: ["allmatic"],
    origin: "Italia",
    site: "https://www.allmatic.com",
    manuals: "https://www.allmatic.com",
  },
  {
    id: "dea-kinggates",
    name: "KingGates",
    aliases: ["kinggates", "king gates"],
    origin: "Italia",
    site: "https://www.king-gates.com",
    manuals: "https://www.king-gates.com",
  },
];

export function findBrand(q: string): Brand | undefined {
  const n = q.toLowerCase();
  return BRANDS.find(
    (b) =>
      b.name.toLowerCase() === n ||
      b.id === n ||
      b.aliases.some((a) => n.includes(a) || a.includes(n)),
  );
}

export function detectBrandFromText(text: string): Brand | undefined {
  const n = text.toLowerCase();
  return BRANDS.find((b) =>
    b.aliases.some((a) => a.length >= 3 && n.includes(a)),
  );
}

const USAGE_KEY = "iaspor:brand-usage";

type BrandUsage = Record<string, { count: number; lastAt: number }>;

function loadBrandUsage(): BrandUsage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BrandUsage;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function bumpBrandUsage(id: string) {
  const usage = loadBrandUsage();
  const prev = usage[id] ?? { count: 0, lastAt: 0 };
  usage[id] = { count: prev.count + 1, lastAt: Date.now() };
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
}

const PINNED_BRANDS = ["faac", "aprimatic", "clemsa", "cdvi"] as const;

export function frequentBrands(limit = 6): Brand[] {
  const usage = loadBrandUsage();
  const pinned = PINNED_BRANDS.map((id) => BRANDS.find((b) => b.id === id)).filter(
    (b): b is Brand => Boolean(b),
  );
  const rest = BRANDS.filter((b) => !PINNED_BRANDS.includes(b.id as (typeof PINNED_BRANDS)[number])).sort(
    (a, b) => {
      const ua = usage[a.id];
      const ub = usage[b.id];
      const last = (ub?.lastAt ?? 0) - (ua?.lastAt ?? 0);
      if (last) return last;
      const count = (ub?.count ?? 0) - (ua?.count ?? 0);
      if (count) return count;
      return 0;
    },
  );
  return [...pinned, ...rest].slice(0, limit);
}
