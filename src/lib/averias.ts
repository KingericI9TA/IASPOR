const KEY = "iaspor:averias";
const CLIP_KEY = "iaspor:averias-clip";
const MAX = 200;

export const AVERIA_ESTADOS = ["pendiente", "curso", "albaran", "cerrada"] as const;
export type AveriaEstado = (typeof AVERIA_ESTADOS)[number];

export const AVERIA_ESTADO_LABEL: Record<AveriaEstado, string> = {
  pendiente: "Pendiente",
  curso: "En curso",
  albaran: "Albarán",
  cerrada: "Cerrada",
};

export type AveriaDraft = {
  cliente: string;
  direccion: string;
  poblacion: string;
  telefono: string;
  averia: string;
  raw: string;
};

export type Averia = AveriaDraft & {
  id: string;
  estado: AveriaEstado;
  albaranNumero?: number;
  createdAt: number;
  updatedAt: number;
};

const PREFIX = /IASPOR\s*:/i;

export function looksLikeIasporAviso(text: string) {
  return PREFIX.test(text);
}

export function extractIasporLine(text: string): string | null {
  const raw = text.replace(/\u00a0/g, " ").trim();
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (PREFIX.test(line)) return line;
  }
  return PREFIX.test(raw) ? raw.replace(/\s+/g, " ") : null;
}

function looksPhone(value: string) {
  const d = value.replace(/\D+/g, "");
  return d.length >= 8 && d.length <= 13;
}

export function parseIasporAviso(text: string): AveriaDraft | null {
  const line = extractIasporLine(text);
  if (!line) return null;
  const body = line.replace(/^\s*IASPOR\s*:\s*/i, "").trim();
  const parts = body.split("|").map((p) => p.trim());
  const empty: AveriaDraft = {
    cliente: "",
    direccion: "",
    poblacion: "",
    telefono: "",
    averia: "",
    raw: line,
  };
  if (parts.length >= 5) {
    return {
      ...empty,
      cliente: parts[0] ?? "",
      direccion: parts[1] ?? "",
      poblacion: parts[2] ?? "",
      telefono: parts[3] ?? "",
      averia: parts.slice(4).join(" | "),
    };
  }
  if (parts.length === 4) {
    if (looksPhone(parts[2] ?? "")) {
      return {
        ...empty,
        cliente: parts[0] ?? "",
        direccion: parts[1] ?? "",
        telefono: parts[2] ?? "",
        averia: parts[3] ?? "",
      };
    }
    return {
      ...empty,
      cliente: parts[0] ?? "",
      direccion: parts[1] ?? "",
      poblacion: parts[2] ?? "",
      averia: parts[3] ?? "",
    };
  }
  if (parts.length === 3) {
    return {
      ...empty,
      cliente: parts[0] ?? "",
      direccion: parts[1] ?? "",
      averia: parts[2] ?? "",
    };
  }
  if (parts.length === 2) {
    return { ...empty, cliente: parts[0] ?? "", averia: parts[1] ?? "" };
  }
  return { ...empty, averia: body };
}

export function mapsQuery(a: Pick<AveriaDraft, "direccion" | "poblacion">) {
  return [a.direccion, a.poblacion].map((s) => s.trim()).filter(Boolean).join(", ");
}

export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsDirUrl(query: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function mapsEmbedUrl(query: string) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=es&z=16&output=embed`;
}

/** Enlace que sí abre la app en el teléfono (WhatsApp o Business). */
export function whatsAppLaunch() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/android/i.test(ua)) {
    return {
      href: "intent://send/#Intent;scheme=whatsapp;S.browser_fallback_url=https%3A%2F%2Fwa.me%2F;end",
      target: undefined as string | undefined,
    };
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    return { href: "https://wa.me/", target: "_blank" as string | undefined };
  }
  return { href: "https://web.whatsapp.com/", target: "_blank" as string | undefined };
}

export function whatsAppLaunchHref() {
  return whatsAppLaunch().href;
}

export function openWhatsAppApp() {
  const { href, target } = whatsAppLaunch();
  if (!target) {
    window.location.assign(href);
    return;
  }
  const win = window.open(href, target, "noopener,noreferrer");
  if (!win) window.location.assign(href);
}

function clampList(list: Averia[]) {
  return list
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX);
}

export function loadAverias(): Averia[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Averia[];
    if (!Array.isArray(p)) return [];
    return clampList(
      p.filter((a) => a && typeof a === "object" && typeof a.id === "string"),
    );
  } catch {
    return [];
  }
}

export function saveAverias(list: Averia[]) {
  const next = clampList(list);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function formatIasporLine(d: AveriaDraft) {
  return `IASPOR: ${d.cliente} | ${d.direccion} | ${d.poblacion} | ${d.telefono} | ${d.averia}`;
}

export function upsertAveria(input: AveriaDraft & { estado?: AveriaEstado; id?: string; albaranNumero?: number }) {
  const now = Date.now();
  const list = loadAverias();
  const same = list.find(
    (a) => a.raw.trim() && input.raw.trim() && a.raw.trim() === input.raw.trim(),
  );
  if (same && !input.id) {
    const updated: Averia = {
      ...same,
      ...input,
      id: same.id,
      estado: input.estado ?? same.estado,
      updatedAt: now,
    };
    return { item: updated, list: saveAverias(list.map((a) => (a.id === same.id ? updated : a))), existed: true };
  }
  if (input.id) {
    const prev = list.find((a) => a.id === input.id);
    const updated: Averia = {
      cliente: input.cliente,
      direccion: input.direccion,
      poblacion: input.poblacion,
      telefono: input.telefono,
      averia: input.averia,
      raw: input.raw,
      id: input.id,
      estado: input.estado ?? prev?.estado ?? "pendiente",
      albaranNumero: input.albaranNumero ?? prev?.albaranNumero,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    const next = prev
      ? list.map((a) => (a.id === input.id ? { ...a, ...updated } : a))
      : [updated, ...list];
    return { item: updated, list: saveAverias(next), existed: Boolean(prev) };
  }
  const item: Averia = {
    cliente: input.cliente,
    direccion: input.direccion,
    poblacion: input.poblacion,
    telefono: input.telefono,
    averia: input.averia,
    raw: input.raw || formatIasporLine(input),
    id: `av-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    estado: input.estado ?? "pendiente",
    albaranNumero: input.albaranNumero,
    createdAt: now,
    updatedAt: now,
  };
  return { item, list: saveAverias([item, ...list]), existed: false };
}

export function patchAveria(id: string, patch: Partial<Averia>) {
  const list = loadAverias();
  const next = list.map((a) => (a.id === id ? { ...a, ...patch, id, updatedAt: Date.now() } : a));
  saveAverias(next);
  return next.find((a) => a.id === id) ?? null;
}

export function removeAveria(id: string) {
  return saveAverias(loadAverias().filter((a) => a.id !== id));
}

export async function readClipboardText() {
  try {
    const t = await navigator.clipboard.readText();
    return (t || "").trim();
  } catch {
    return "";
  }
}

export function rememberClip(raw: string) {
  try {
    sessionStorage.setItem(CLIP_KEY, raw.trim());
  } catch {
    /* private */
  }
}

export function lastClip() {
  try {
    return sessionStorage.getItem(CLIP_KEY) || "";
  } catch {
    return "";
  }
}
