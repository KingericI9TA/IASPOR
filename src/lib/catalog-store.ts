import type { CatalogDoc } from "./catalog";

const DOCS_KEY = "puertadocs:synced-catalog";
const SETTINGS_KEY = "puertadocs:sync-settings";

export type SyncIntervalHours = 12 | 24 | 168;

export type SyncSettings = {
  auto: boolean;
  intervalHours: SyncIntervalHours;
  lastSyncAt: number | null;
  lastError: string | null;
  lastCount: number;
};

export const DEFAULT_SYNC: SyncSettings = {
  auto: true,
  intervalHours: 24,
  lastSyncAt: null,
  lastError: null,
  lastCount: 0,
};

export function loadSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SYNC };
    const parsed = JSON.parse(raw) as Partial<SyncSettings>;
    const interval: SyncIntervalHours =
      parsed.intervalHours === 12 || parsed.intervalHours === 168 ? parsed.intervalHours : 24;
    return {
      auto: parsed.auto !== false,
      intervalHours: interval,
      lastSyncAt: typeof parsed.lastSyncAt === "number" ? parsed.lastSyncAt : null,
      lastError: parsed.lastError ?? null,
      lastCount: parsed.lastCount ?? 0,
    };
  } catch {
    return { ...DEFAULT_SYNC };
  }
}

export function saveSyncSettings(settings: SyncSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSyncedCatalog(): CatalogDoc[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CatalogDoc[];
    return Array.isArray(parsed) ? parsed.filter((d) => d && d.id && d.title) : [];
  } catch {
    return [];
  }
}

export function saveSyncedCatalog(docs: CatalogDoc[]) {
  localStorage.setItem(DOCS_KEY, JSON.stringify(docs.slice(0, 80)));
}

export function shouldAutoSync(settings: SyncSettings) {
  if (!settings.auto) return false;
  if (settings.lastError) return false;
  if (!settings.lastSyncAt) return true;
  const maxAge = settings.intervalHours * 60 * 60 * 1000;
  return Date.now() - settings.lastSyncAt >= maxAge;
}
