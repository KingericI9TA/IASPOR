import { publicUrl } from "@/lib/utils";

const FLAG = "iaspor:reloaded-build";

function htmlBuild() {
  return document.querySelector('meta[name="iaspor-build"]')?.getAttribute("content") ?? "";
}

async function clearWebCache() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

export async function applyFreshCopy() {
  if (typeof window === "undefined") return false;
  const local = htmlBuild();
  if (!local) return false;
  let remote = "";
  try {
    const res = await fetch(`${publicUrl("version.json")}?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { build?: string };
    remote = String(data.build ?? "");
  } catch {
    return false;
  }
  if (!remote || remote === local) return false;
  if (sessionStorage.getItem(FLAG) === remote) return false;
  sessionStorage.setItem(FLAG, remote);
  await clearWebCache();
  const tab = new URLSearchParams(location.search).get("tab");
  const next = new URL(publicUrl(""), location.origin);
  next.searchParams.set("v", remote);
  if (tab && tab !== "buscar") next.searchParams.set("tab", tab);
  location.replace(`${next.pathname}${next.search}${location.hash}`);
  return true;
}

export function armAppUpdates() {
  void applyFreshCopy();
  const onVis = () => {
    if (document.visibilityState === "visible") void applyFreshCopy();
  };
  document.addEventListener("visibilitychange", onVis);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "IASPOR_SW") void applyFreshCopy();
    });
    void navigator.serviceWorker.getRegistration().then((reg) => {
      void reg?.update();
    });
  }
}
