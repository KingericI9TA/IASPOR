/** Copia estática (GitHub Pages / APK TWA): no hay funciones de servidor. */

export function isStaticHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith(".github.io")) return true;
  try {
    if (document.referrer.startsWith("android-app://es.aspor.iaspor")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function friendlyServerError(error: unknown, fallback = "No disponible en esta copia.") {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/invariant failed/i.test(raw) || /content-type/i.test(raw)) return fallback;
  return raw || fallback;
}
