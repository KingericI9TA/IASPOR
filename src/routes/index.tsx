import { createFileRoute } from "@tanstack/react-router";
import {
  Download,
  Loader2,
  Mail,
  MessageCircle,
  Moon,
  RefreshCw,
  Share2,
  Star,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconAlbaran,
  IconArchivos,
  IconBuscar,
  IconCatalogo,
  IconCodigos,
  IconLocal,
  IconMarcas,
  IconOficina,
  IconPedido,
  IconPiezas,
  IconPresupuesto,
  IconWeb,
} from "@/components/cockpit-icons";
import { PresupuestoPane } from "@/components/presupuesto-pane";
import { JarvisConsulta } from "@/components/jarvis";
import { FaacCatalogViewer } from "@/components/faac-catalog-viewer";
import { FaacDrawingViewer } from "@/components/faac-drawing-viewer";
import { PdfBlobViewer } from "@/components/pdf-blob-viewer";
import { BRANDS, bumpBrandUsage, detectBrandFromText, frequentBrands, type Brand } from "@/lib/brands";
import { KIND_LABEL, type CatalogDoc } from "@/lib/catalog";
import {
  ALBARAN_TYPES,
  adoptDocLastNumber,
  analyzeAlbaranTemplate,
  euro,
  issueAlbaran,
  loadAlbaranHistory,
  peekNextAlbaranNumber,
  type AlbaranDraft,
  type AlbaranRecord,
} from "@/lib/albaran";
import {
  CODE_SOURCES,
  ingestLocalCodes,
  loadLocalCodeRows,
  fetchCodeTables,
  searchCodeRows,
  sheetUrl,
  type CodeRow,
} from "@/lib/codigos";
import {
  DEFAULT_SYNC,
  loadSyncedCatalog,
  loadSyncSettings,
  saveSyncedCatalog,
  saveSyncSettings,
  shouldAutoSync,
  type SyncIntervalHours,
  type SyncSettings,
} from "@/lib/catalog-store";
import {
  getBlob,
  listLibrary,
  removeDoc,
  savePdf,
  libraryKey,
  toggleFavorite,
  type LibraryDoc,
} from "@/lib/library";
import { googleQuery, searchLocal, type LocalHit } from "@/lib/search-local";
import { webEngineHits, type WebHit } from "@/lib/google-search";
import { downloadPdfBytes, findWebPdfs, pdfFileName } from "@/lib/web-pdfs";
import { isStaticHost, friendlyServerError } from "@/lib/static-host";
import {
  FAAC_FAMILIES,
  FAAC_MODELS,
  FAAC_SPARES_HOME,
  familyUrl,
  queryFaacSpares,
  resolveFaacDrawingId,
  type SpareHit,
  type SpareKind,
} from "@/lib/faac-spares";
import {
  FAAC_CATALOG_TITLE,
  FAAC_CATALOG_VIEW,
  searchFaacCatalog,
  type FaacCatalogHit,
} from "@/lib/faac-catalog";
import {
  APRIMATIC_CATALOG_PDF,
  APRIMATIC_CATALOG_TITLE,
  APRIMATIC_CATALOG_VIEW,
  APRIMATIC_COMPARE,
  searchAprimaticCatalog,
} from "@/lib/aprimatic-catalog";
import {
  addPedidoItem,
  buildPedidoPdf,
  fetchPedidoKeep,
  formatPedidoShareText,
  formatPedidoText,
  loadDest,
  loadPedido,
  loadSent,
  mailtoHref,
  mergeKeepItems,
  PEDIDO_KEEP_VIEW,
  pedidoFecha,
  peekPedidoNumero,
  recordSent,
  saveDest,
  savePedido,
  takePedidoNumero,
  totalPiezas,
  whatsappHref,
  type PedidoItem,
  type PedidoSent,
} from "@/lib/faac-pedido";
import { armPedidoReminder, askPedidoNotify, registerPedidoSw } from "@/lib/pedido-remind";
import { armAppUpdates } from "@/lib/app-update";
import { armDailyBackup, runDailyBackupNow } from "@/lib/daily-backup";
import { downloadTallerZip, importTallerZip } from "@/lib/backup";
import { syncRemoteCatalog } from "@/lib/sync-catalog";
import {
  loadTallerFolder,
  saveTallerFolder,
  folderNameFromFiles,
  subfolderCount,
  collectTallerFiles,
  filesFromZip,
  saveTallerHandle,
  restoreFolderEstado,
  writeFolderEstado,
  writeAlbaranPdfToFolder,
  writeFileToDirectory,
  pickEsquemasFolder,
  ESQUEMAS_FOLDER,
  requestDurableStorage,
  loadTallerHandle,
  type TallerFolder,
} from "@/lib/taller-folder";
import { extractOfficeText, kindOfFile } from "@/lib/office-text";
import { cn, copyToClipboard, formatBytes, formatWhen } from "@/lib/utils";
import { AppErrorComponent } from "@/lib/error-component";

export const Route = createFileRoute("/")({
  component: Home,
  errorComponent: AppErrorComponent,
});

type Tab = "buscar" | "archivos" | "marcas" | "catalogo" | "piezas" | "pedido" | "codigos" | "albaran" | "presupuesto";

const RECENTS_KEY = "puertadocs:recents";
const THEME_KEY = "iaspor:theme";

function loadObra() {
  try {
    return localStorage.getItem(THEME_KEY) === "obra";
  } catch {
    return false;
  }
}

function applyTheme(obra: boolean) {
  document.documentElement.dataset.theme = obra ? "obra" : "noche";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", obra ? "#d9e1ea" : "#020617");
}

const MAIN_TABS = [
  { id: "buscar" as const, label: "Buscar", Icon: IconBuscar, lamp: "lamp-cyan" },
  { id: "catalogo" as const, label: "Catálogo", Icon: IconCatalogo, lamp: "lamp-white" },
  { id: "piezas" as const, label: "Piezas", Icon: IconPiezas, lamp: "lamp-orange" },
];

const OFFICE_TABS = [
  { id: "archivos" as const, label: "Archivos", Icon: IconArchivos, lamp: "lamp-amber" },
  { id: "marcas" as const, label: "Marcas", Icon: IconMarcas, lamp: "lamp-green" },
  { id: "pedido" as const, label: "Pedido FAAC", Icon: IconPedido, lamp: "lamp-white" },
  { id: "codigos" as const, label: "Códigos", Icon: IconCodigos, lamp: "lamp-yellow" },
  { id: "albaran" as const, label: "Albarán", Icon: IconAlbaran, lamp: "lamp-red" },
  { id: "presupuesto" as const, label: "Presupuesto", Icon: IconPresupuesto, lamp: "lamp-green" },
];

const OFFICE_IDS = OFFICE_TABS.map((t) => t.id);
const TAB_IDS: Tab[] = [...MAIN_TABS.map((t) => t.id), ...OFFICE_IDS];

const ALBARAN_STEPS = [
  { key: "cliente" as const, label: "Nombre de cliente", placeholder: "Ej. Comunidad Fuente del Real" },
  { key: "direccion" as const, label: "Dirección de cliente", placeholder: "Calle, número, población" },
  { key: "telefono" as const, label: "TEL/MAIL", placeholder: "985... o correo@..." },
  { key: "concepto" as const, label: "Concepto", placeholder: "Trabajo o material entregado" },
  { key: "cantidad" as const, label: "Cantidad", placeholder: "1", inputMode: "decimal" as const },
  { key: "importe" as const, label: "Importe (precio unidad)", placeholder: "77,90", inputMode: "decimal" as const },
];

function Home() {
  const [tab, setTab] = useState<Tab>("buscar");
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<LibraryDoc[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [webHits, setWebHits] = useState<WebHit[] | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(false);
  const [viewer, setViewer] = useState<{ name: string; blob: Blob } | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [syncedDocs, setSyncedDocs] = useState<CatalogDoc[]>([]);
  const [sync, setSync] = useState<SyncSettings>(DEFAULT_SYNC);
  const [syncing, setSyncing] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [, setBrandTick] = useState(0);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [obra, setObra] = useState(false);
  const [pedidoCount, setPedidoCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const [canFolder, setCanFolder] = useState(true);
  const [taller, setTaller] = useState<TallerFolder | null>(null);
  const autoTried = useRef(false);
  const folderTried = useRef(false);
  const skipEnter = useRef(true);
  const brands = frequentBrands(15);

  const rememberBrand = (brand: Brand) => {
    bumpBrandUsage(brand.id);
    setBrandTick((n) => n + 1);
  };

  useEffect(() => {
    void listLibrary().then(setLibrary);
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
    const t = params.get("tab");
    if (t && TAB_IDS.includes(t as Tab)) setTab(t as Tab);
    if (params.get("copia") === "1") {
      setTab("archivos");
      window.setTimeout(() => {
        void runDailyBackupNow()
          .then((name) => toast.success(`Copia guardada · ${name}`))
          .catch((e) => toast.error(e instanceof Error ? e.message : "No se pudo hacer la copia"));
      }, 400);
    }
    setSyncedDocs(loadSyncedCatalog());
    setSync(loadSyncSettings());
    const nextObra = loadObra();
    setObra(nextObra);
    applyTheme(nextObra);
    setPedidoCount(totalPiezas(loadPedido()));
    setTaller(loadTallerFolder());
    armPedidoReminder();
    armDailyBackup();
    void registerPedidoSw();
    armAppUpdates();
    void requestDurableStorage();
    setCanFolder(true);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        armPedidoReminder();
        armDailyBackup();
      } else {
        void writeFolderEstado();
      }
    };
    const onHide = () => {
      void writeFolderEstado();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onHide);
    window.addEventListener("freeze", onHide);
    const dir = dirRef.current;
    if (dir) {
      dir.setAttribute("webkitdirectory", "true");
      dir.setAttribute("directory", "true");
      dir.multiple = true;
    }
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("freeze", onHide);
    };
  }, []);

  useEffect(() => {
    skipEnter.current = false;
  }, []);

  useEffect(() => {
    if (tab === "buscar") setPedidoCount(totalPiezas(loadPedido()));
  }, [tab]);

  const persistRecents = (next: string[]) => {
    setRecents(next);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  };

  const localHits = useMemo(
    () => (query.trim().length >= 2 ? searchLocal(query, library, syncedDocs) : []),
    [query, library, syncedDocs],
  );

  const runWeb = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setWebError(null);
    const engines = webEngineHits(trimmed);
    setWebHits(engines);
    setWebLoading(true);
    void (async () => {
      try {
        const pdfs = await findWebPdfs(trimmed);
        setWebHits([...engines, ...pdfs]);
      } catch {
        /* Google sigue disponible */
      } finally {
        setWebLoading(false);
      }
    })();
  }, []);

  const persistSync = (next: SyncSettings) => {
    setSync(next);
    saveSyncSettings(next);
  };

  const runCatalogSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await Promise.race([
        syncRemoteCatalog(),
        new Promise<never>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("La sincronización tardó demasiado. Pulsa de nuevo más tarde.")),
            32_000,
          );
        }),
      ]);
      if (!res.ok) {
        const next = { ...loadSyncSettings(), lastError: res.error };
        persistSync(next);
        toast.error(res.error);
        return;
      }
      saveSyncedCatalog(res.docs);
      setSyncedDocs(res.docs);
      persistSync({
        ...loadSyncSettings(),
        lastSyncAt: Date.now(),
        lastError: null,
        lastCount: res.docs.length,
      });
      toast.success(`Catálogo actualizado: ${res.docs.length} fichas`);
    } catch (e) {
      const raw = friendlyServerError(e, "La sincronización no está en esta copia.");
      const msg = /abort|timeout|agotado/i.test(raw)
        ? "La sincronización tardó demasiado. Pulsa de nuevo más tarde."
        : raw;
      persistSync({ ...loadSyncSettings(), lastError: msg });
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    const settings = loadSyncSettings();
    if (shouldAutoSync(settings)) void runCatalogSync();
  }, [runCatalogSync]);

  const submitSearch = (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    persistRecents([trimmed, ...recents.filter((r) => r !== trimmed)].slice(0, 8));
    const brand = detectBrandFromText(trimmed);
    if (brand) rememberBrand(brand);
    setQuery(trimmed);
    setTab("buscar");
    const hits = searchLocal(trimmed, library, syncedDocs);
    const hasFile = hits.some((h) => h.source === "archivo");
    if (!hasFile) runWeb(trimmed);
    else setWebHits(null);
  };

  const importFiles = async (files: FileList | File[] | null, folderLabel?: string) => {
    if (!files || files.length === 0) return;
    setImporting(true);
    setProgress(0);
    try {
      let added = 0;
      let codes = 0;
      let skipped = 0;
      let already = 0;
      const known = new Set(library.map((d) => libraryKey(d.name, d.size)));
      const incoming = Array.from(files).filter((f) => {
        if (f.name.startsWith(".")) return false;
        const p = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        return !/(^|\/)(\.git|node_modules|\.Trash|__MACOSX)(\/|$)/i.test(p);
      });
      const expanded: File[] = [];
      for (const file of incoming) {
        if (/\.zip$/i.test(file.name)) {
          try {
            const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
            const prefix = rel.replace(/\/?[^/]+\.zip$/i, "");
            expanded.push(...(await filesFromZip(await file.arrayBuffer(), prefix)));
          } catch {
            skipped += 1;
          }
          continue;
        }
        expanded.push(file);
      }
      const BATCH = 80;
      const rest = Math.max(0, expanded.length - BATCH);
      const list = expanded.slice(0, BATCH);
      const addedDocs: LibraryDoc[] = [];
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        const kind = kindOfFile(file);
        if (!kind) {
          skipped += 1;
          continue;
        }
        const name = file.name.replace(/\.(pdf|docx|xlsx|xlsm|csv|tsv|txt)$/i, "");
        if (known.has(libraryKey(name, file.size))) {
          already += 1;
          continue;
        }
        try {
          setProgress(Math.round(((i + 1) / list.length) * 100));
          const text = await extractOfficeText(file);
          const doc = await savePdf(file, text, kind);
          known.add(libraryKey(doc.name, doc.size));
          addedDocs.push(doc);
          added += 1;
          if (kind === "excel" || kind === "csv") codes += ingestLocalCodes(file.name, text);
        } catch {
          skipped += 1;
        }
        if (i % 2 === 1) await new Promise<void>((r) => window.setTimeout(r, 50));
      }
      if (addedDocs.length) {
        setLibrary((prev) => {
          const ids = new Set(addedDocs.map((d) => d.id));
          return [...addedDocs, ...prev.filter((d) => !ids.has(d.id))];
        });
      }
      const label = folderLabel || folderNameFromFiles(list.length ? list : expanded);
      const folders = subfolderCount(expanded);
      if (added || expanded.length) setTaller(saveTallerFolder(label, added || expanded.length, folders));
      if (added) {
        toast.success(
          folders > 1
            ? `${added} archivo${added === 1 ? "" : "s"} en ${folders} carpetas`
            : `${added} archivo${added === 1 ? "" : "s"} en el teléfono`,
        );
      }
      if (already && !added) toast.message("Esos archivos ya estaban");
      if (codes) toast.success(`Códigos: ${codes} filas del Excel/CSV`);
      if (rest) toast.message(`Quedan ${rest}. Vuelve a pulsar Elegir carpeta para seguir.`);
      if (skipped && added) toast.message(`${skipped} no se indexaron`);
      if (!added && !codes && !already) toast.message("Ninguno era PDF, Word o Excel válido");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer la carpeta");
    } finally {
      setImporting(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = "";
      if (dirRef.current) dirRef.current.value = "";
    }
  };

  const importFolder = async () => {
    toast.message("Buscando en la carpeta y en todas las subcarpetas…");
    const picker = (
      window as Window & {
        showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (picker) {
      try {
        const dir = await picker.call(window, { mode: "readwrite" });
        await saveTallerHandle(dir);
        const recovered = await restoreFolderEstado(dir);
        const { files, folders } = await collectTallerFiles(dir);
        if (!files.length && !recovered) {
          toast.error("No hay PDF, Word o Excel en esa carpeta ni en sus subcarpetas");
          return;
        }
        if (files.length) await importFiles(files, dir.name);
        await writeFolderEstado(dir);
        if (recovered) {
          setPedidoCount(totalPiezas(loadPedido()));
          toast.success("Recuperado pedido y número de albarán de la carpeta");
        }
        if (folders > 1) toast.message(`${folders} carpetas leídas (incluye subcarpetas)`);
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    dirRef.current?.click();
  };

  useEffect(() => {
    if (folderTried.current) return;
    folderTried.current = true;
    void (async () => {
      const dir = await loadTallerHandle();
      if (!dir) return;
      const restored = await restoreFolderEstado(dir);
      if (restored) setPedidoCount(totalPiezas(loadPedido()));
      const lib = await listLibrary();
      if (lib.length) {
        setLibrary(lib);
        return;
      }
      try {
        const { files } = await collectTallerFiles(dir);
        if (files.length) await importFiles(files, dir.name);
      } catch {
        /* pulsar Elegir carpeta */
      }
    })();
  }, []);

  const openLocal = async (doc: LibraryDoc) => {
    const blob = await getBlob(doc.id);
    if (!blob || blob.size < 8) {
      toast.error("El archivo ya no está en el teléfono");
      return;
    }
    const ext =
      doc.kind === "word" ? ".docx" : doc.kind === "excel" ? ".xlsx" : doc.kind === "csv" ? ".csv" : ".pdf";
    const name = /\.\w+$/.test(doc.name) ? doc.name : `${doc.name}${ext}`;
    if (doc.kind && doc.kind !== "pdf") {
      const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: doc.name });
          return;
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.message("Texto indexado en Buscar. Archivo descargado.");
      return;
    }
    const typed =
      blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
    setViewer({ name: doc.name, blob: typed });
  };

  const saveWebPdf = async (hit: WebHit) => {
    if (hit.kind !== "pdf") return;
    setSavingUrl(hit.url);
    try {
      const buf = await downloadPdfBytes(hit.url);
      const file = new File([buf], pdfFileName(hit.url, hit.title), { type: "application/pdf" });
      const { extractPdfText } = await import("@/lib/pdf-text");
      const text = await extractPdfText(file);
      const doc = await savePdf(file, text);
      setLibrary((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
      const dir = await pickEsquemasFolder();
      const inFolder = dir ? await writeFileToDirectory(dir, file) : false;
      toast.success(
        inFolder
          ? `Guardado en ${dir?.name || ESQUEMAS_FOLDER}: ${doc.name}`
          : `Guardado en Archivos: ${doc.name}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el PDF");
    } finally {
      setSavingUrl(null);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-3xl flex-col pb-[calc(5.6rem+env(safe-area-inset-bottom))]">
      <Toaster theme={obra ? "light" : "dark"} position="top-center" />
      <header className="flex items-center justify-between gap-3 px-5 pt-3 pb-2">
        <h1 className="app-mark m-0 text-left text-xl tracking-[0.18em] text-fg sm:text-2xl">
          IASPOR
          <span className="ml-2 align-middle font-sans text-[0.7rem] font-normal tracking-normal text-muted normal-case">
            by Jan
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <JarvisConsulta seed={query} />
          <button
            type="button"
            className="chip inline-flex h-10 min-h-10 items-center gap-1.5 px-3 text-[0.7rem]"
            aria-label={obra ? "Modo noche" : "Modo obra"}
            onClick={() => {
              const next = !obra;
              setObra(next);
              applyTheme(next);
              localStorage.setItem(THEME_KEY, next ? "obra" : "noche");
            }}
          >
            {obra ? <Moon className="size-4" /> : <Sun className="size-4" />}
            {obra ? "Noche" : "Obra"}
          </button>
        </div>
      </header>

      {tab === "buscar" ? (
        <section className="px-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch(query);
          }}
        >
          <div className="relative flex-1">
            <IconBuscar className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setWebHits(null);
                setWebError(null);
              }}
              placeholder="FAAC 455 D, Nice Robus, receptor Clemsa…"
              className="pl-10 pr-10"
              aria-label="Buscar esquema o manual"
            />
            {query ? (
              <button
                type="button"
                className="absolute top-1/2 right-2 size-8 -translate-y-1/2 text-muted"
                onClick={() => {
                  setQuery("");
                  setWebHits(null);
                }}
                aria-label="Limpiar"
              >
                <X className="mx-auto size-4" />
              </button>
            ) : null}
          </div>
          <Button type="submit" disabled={query.trim().length < 2}>
            Buscar
          </Button>
        </form>

        {recents.length > 0 && !query ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {recents.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => submitSearch(r)}
                className="chip h-8 min-h-8 px-3 text-muted hover:text-primary"
              >
                {r}
              </button>
            ))}
          </div>
        ) : null}
      </section>
      ) : null}

      <div key={tab} className={skipEnter.current ? undefined : "pane-enter"}>
      {tab === "buscar" ? (
        <SearchPane
          query={query}
          localHits={localHits}
          webHits={webHits}
          webError={webError}
          webLoading={webLoading}
          onWeb={() => runWeb(query)}
          onOpenLocal={openLocal}
          brands={brands}
          onBrand={(b) => {
            rememberBrand(b);
            submitSearch(b.name);
          }}
          savingUrl={savingUrl}
          onSavePdf={(h) => void saveWebPdf(h)}
          library={library}
          importing={importing}
          progress={progress}
          onPickPdfs={() => fileRef.current?.click()}
          onPickFolder={canFolder ? () => void importFolder() : undefined}
          pedidoCount={pedidoCount}
          onPedido={() => {
            setOfficeOpen(false);
            setTab("pedido");
          }}
          taller={taller}
        />
      ) : null}

      {tab === "archivos" ? (
        <LibraryPane
          library={library}
          importing={importing}
          progress={progress}
          onPick={() => fileRef.current?.click()}
          onPickFolder={canFolder ? () => void importFolder() : undefined}
          onOpen={openLocal}
          onFav={async (id) => {
            const next = await toggleFavorite(id);
            if (next) {
              setLibrary((prev) => prev.map((d) => (d.id === id ? next : d)));
            }
          }}
          onRemove={async (id) => {
            await removeDoc(id);
            setLibrary((prev) => prev.filter((d) => d.id !== id));
          }}
          onRestored={() => {
            void listLibrary().then(setLibrary);
            setPedidoCount(totalPiezas(loadPedido()));
          }}
        />
      ) : null}

      {tab === "marcas" ? (
        <BrandsPane
          onPick={(b) => {
            rememberBrand(b);
            submitSearch(b.name);
          }}
        />
      ) : null}

      {tab === "catalogo" ? (
        <CatalogPane
          settings={sync}
          syncedCount={syncedDocs.length}
          syncing={syncing}
          onToggleAuto={(auto) => persistSync({ ...sync, auto })}
          onInterval={(intervalHours) => persistSync({ ...sync, intervalHours })}
          onSyncNow={() => void runCatalogSync()}
        />
      ) : null}

      {tab === "piezas" ? (
        <SparesPane
          seed={query}
          onAddToPedido={(item) => {
            const next = addPedidoItem(loadPedido(), item);
            savePedido(next);
            toast.success(`${item.code || item.name} al pedido FAAC`);
            setPedidoCount(totalPiezas(loadPedido()));
            void writeFolderEstado();
            void askPedidoNotify().then(() => armPedidoReminder());
          }}
        />
      ) : null}

      {tab === "pedido" ? <PedidoPane /> : null}

      {tab === "codigos" ? <CodesPane /> : null}

      {tab === "albaran" ? <AlbaranPane /> : null}

      {tab === "presupuesto" ? <PresupuestoPane /> : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.xlsm,.csv,.tsv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        multiple
        className="hidden"
        onChange={(e) => void importFiles(e.target.files)}
      />
      <input
        ref={dirRef}
        type="file"
        className="hidden"
        multiple
        // @ts-expect-error webkitdirectory is the Android folder picker
        webkitdirectory=""
        directory=""
        onChange={(e) => void importFiles(e.target.files, folderNameFromFiles(Array.from(e.target.files ?? [])))}
      />

      {viewer ? (
        <PdfBlobViewer name={viewer.name} blob={viewer.blob} onClose={() => setViewer(null)} />
      ) : null}

      {officeOpen ? (
        <>
          <button type="button" className="office-scrim" aria-label="Cerrar oficina" onClick={() => setOfficeOpen(false)} />
          <div className="office-sheet grid grid-cols-2 gap-2 sm:grid-cols-3">
            {OFFICE_TABS.map(({ id, label, Icon, lamp }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setOfficeOpen(false);
                }}
                className={cn("nav-tab rounded-md", tab === id && "nav-tab-active")}
              >
                <span className={cn("ctrl-well", lamp)}>
                  <Icon className="size-5 shrink-0" aria-hidden />
                </span>
                <span>{id === "archivos" ? `${label} (${library.length})` : label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <nav className="dock" aria-label="Secciones">
        <div className="dock-grid">
          {MAIN_TABS.map(({ id, label, Icon, lamp }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setOfficeOpen(false);
                setTab(id);
              }}
              className={cn("nav-tab rounded-md", tab === id && "nav-tab-active")}
            >
              <span className={cn("ctrl-well", lamp)}>
                <Icon className="size-5 shrink-0" aria-hidden />
              </span>
              <span>{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOfficeOpen((v) => !v)}
            className={cn(
              "nav-tab rounded-md",
              (officeOpen || OFFICE_IDS.includes(tab as (typeof OFFICE_IDS)[number])) && "nav-tab-active",
            )}
          >
            <span className="ctrl-well lamp-yellow">
              <IconOficina className="size-5 shrink-0" aria-hidden />
            </span>
            <span>Oficina</span>
          </button>
        </div>
      </nav>
    </main>
  );
}

function SearchPane({
  query,
  localHits,
  webHits,
  webError,
  webLoading,
  onWeb,
  onOpenLocal,
  onBrand,
  brands,
  savingUrl,
  onSavePdf,
  library,
  importing,
  progress,
  onPickPdfs,
  onPickFolder,
  pedidoCount,
  onPedido,
  taller,
}: {
  query: string;
  localHits: LocalHit[];
  webHits: WebHit[] | null;
  webError: string | null;
  webLoading: boolean;
  onWeb: () => void;
  onOpenLocal: (doc: LibraryDoc) => void;
  onBrand: (b: Brand) => void;
  brands: Brand[];
  savingUrl: string | null;
  onSavePdf: (hit: WebHit) => void;
  library: LibraryDoc[];
  importing: boolean;
  progress: number;
  onPickPdfs: () => void;
  onPickFolder?: () => void;
  pedidoCount: number;
  onPedido: () => void;
  taller: TallerFolder | null;
}) {
  if (query.trim().length < 2) {
    return (
      <div className="px-5 pt-4">
        {pedidoCount > 0 ? (
          <button type="button" onClick={onPedido} className="hit-primary mb-3 w-full rounded-md p-3 text-left">
            <p className="text-xs tracking-[0.14em] text-muted uppercase">Pedido FAAC pendiente</p>
            <p className="mt-1 font-medium">{pedidoCount} piezas · abrir y enviar</p>
          </button>
        ) : null}
        <div className="rounded-md hud p-3">
          <p className="text-sm font-medium">
            Carpeta del teléfono
            {taller ? ` · ${taller.name}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onPickPdfs} disabled={importing}>
              {importing ? (
                <>
                  <Loader2 className="animate-spin" /> {progress}%
                </>
              ) : (
                <>
                  <IconArchivos className="size-4" /> Añadir archivos
                </>
              )}
            </Button>
            {onPickFolder ? (
              <Button size="sm" variant="secondary" onClick={onPickFolder} disabled={importing}>
                Elegir carpeta
              </Button>
            ) : null}
          </div>
          {library.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1">
              {library.slice(0, 4).map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="w-full truncate py-1 text-left text-sm hover:text-primary"
                    onClick={() => onOpenLocal(d)}
                  >
                    {d.name}
                  </button>
                </li>
              ))}
              {library.length > 4 ? (
                <li className="text-xs text-muted">{library.length - 4} más en Oficina → Archivos</li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <p className="mt-6 text-sm text-muted">Marcas frecuentes</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBrand(b)}
              className="rounded-md hud px-2 py-3 text-center text-sm font-medium hover:bg-raised"
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const files = localHits.filter((h) => h.source === "archivo");
  const catalog = localHits.filter((h) => h.source === "catalogo");

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <section>
        <HeaderRow
          icon={<IconLocal className="size-4" />}
          title="En tu teléfono"
          count={files.length}
        />
        {files.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nada en tus PDF. Añádelos arriba o busca en la web.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {files.map((h) => (
              <li key={h.library!.id}>
                <button
                  type="button"
                  onClick={() => onOpenLocal(h.library!)}
                  className="hit-file flex w-full items-start gap-3 rounded-md p-3 text-left"
                >
                  <IconArchivos className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{h.library!.name}</span>
                    <span className="text-xs text-muted">
                      {h.brand?.name ?? "Sin marca"} · {formatBytes(h.library!.size)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {catalog.length > 0 ? (
        <section>
          <HeaderRow icon={<IconCatalogo className="size-4" />} title="Catálogo" count={catalog.length} />
          <ul className="mt-3 flex flex-col gap-2">
            {catalog.map((h) => {
              const cat = h.catalog!;
              const href =
                cat.url || googleQuery(h.brand?.name ?? "", `${cat.model} ${cat.title} PDF`);
              return (
                <li key={cat.id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md hud p-3"
                  >
                    <p className="font-medium">{cat.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {h.brand?.name} · {KIND_LABEL[cat.kind]}
                      {cat.synced ? " · sincronizado" : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted">{cat.hint}</p>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section>
        <HeaderRow icon={<IconWeb className="size-4" />} title="Google" />
        {webHits == null && !webLoading ? (
          <Button className="mt-3" variant="secondary" onClick={onWeb}>
            Buscar en la web
          </Button>
        ) : null}
        {webLoading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Buscando en Google (simple y PDF)…
          </p>
        ) : null}
        {webError ? <p className="mt-2 text-sm text-danger">{webError}</p> : null}
        {webHits && webHits.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {webHits.map((h) => (
              <li key={h.url} className="hit-quiet py-3">
                <p className="font-medium">{h.title}</p>
                <p className="mt-1 font-mono text-xs text-primary">
                  {/google\.[^/]+\/search/i.test(h.url)
                    ? h.url.includes("tbm=isch")
                      ? "Google Imágenes"
                      : /filetype%3Apdf|filetype=pdf/i.test(h.url)
                        ? "Google · PDF"
                        : "Google · búsqueda simple"
                    : h.kind === "pdf"
                      ? "PDF · enlace directo"
                      : "Página · búsqueda simple"}
                  {h.brand ? ` · ${h.brand}` : ""}
                </p>
                {h.snippet ? <p className="mt-1 text-sm text-muted">{h.snippet}</p> : null}
                <div className="mt-3 flex gap-2">
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-raised"
                  >
                    Abrir
                  </a>
                  {h.kind === "pdf" ? (
                    <Button
                      size="sm"
                      onClick={() => onSavePdf(h)}
                      disabled={savingUrl === h.url}
                    >
                      {savingUrl === h.url ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Download />
                      )}
                      Descargar en carpeta
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function LibraryPane({
  library,
  importing,
  progress,
  onPick,
  onPickFolder,
  onOpen,
  onFav,
  onRemove,
  onRestored,
}: {
  library: LibraryDoc[];
  importing: boolean;
  progress: number;
  onPick: () => void;
  onPickFolder?: () => void;
  onOpen: (d: LibraryDoc) => void;
  onFav: (id: string) => void;
  onRemove: (id: string) => void;
  onRestored?: () => void;
}) {
  const bakRef = useRef<HTMLInputElement>(null);
  const [bak, setBak] = useState<"exp" | "imp" | null>(null);

  const exportZip = async () => {
    setBak("exp");
    try {
      const name = await downloadTallerZip();
      toast.success(`Copia ZIP · ${name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setBak(null);
    }
  };

  const importZip = async (files: FileList | null) => {
    const file = files?.[0];
    if (bakRef.current) bakRef.current.value = "";
    if (!file) return;
    setBak("imp");
    try {
      const res = await importTallerZip(file);
      toast.success(
        `Restaurado: ${res.pdfs} PDF${res.meta ? ` · próximo albarán ${res.nextAlbaran}` : ""}`,
      );
      onRestored?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ZIP no válido");
    } finally {
      setBak(null);
    }
  };

  return (
    <div className="px-5 pt-5">
      <div className="flex flex-col gap-2">
        <Button onClick={onPick} disabled={importing} className="w-full">
          {importing ? (
            <>
              <Loader2 className="animate-spin" /> Indexando {progress}%
            </>
          ) : (
            <>
              <IconArchivos /> Añadir PDF, Word o Excel
            </>
          )}
        </Button>
        {onPickFolder ? (
          <Button variant="secondary" onClick={onPickFolder} disabled={importing} className="w-full">
            Elegir carpeta del teléfono
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => void exportZip()} disabled={!!bak}>
            {bak === "exp" ? <Loader2 className="animate-spin" /> : <Download />}
            Copia ZIP
          </Button>
          <Button variant="secondary" onClick={() => bakRef.current?.click()} disabled={!!bak}>
            {bak === "imp" ? <Loader2 className="animate-spin" /> : <Share2 />}
            Restaurar
          </Button>
        </div>
        <input ref={bakRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => void importZip(e.target.files)} />
        <p className="text-xs text-muted">
          Al salir, IASPOR guarda pedido y albaranes en la carpeta del teléfono (IASPOR-estado.json).
          Si reinstalas, elige esa misma carpeta y se recupera. Copia ZIP también cada día a las 23:00.
        </p>
      </div>
      {library.length === 0 ? null : (
        <ul className="mt-4 flex flex-col gap-2">
          {library.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-2 rounded-md hud p-2"
            >
              <button
                type="button"
                className="min-w-0 flex-1 px-2 py-2 text-left"
                onClick={() => onOpen(d)}
              >
                <span className="block truncate font-medium">{d.name}</span>
                <span className="text-xs text-muted">
                  {(d.kind === "word" ? "Word" : d.kind === "excel" ? "Excel" : d.kind === "csv" ? "CSV" : "PDF")}
                  {" · "}
                  {formatBytes(d.size)} · {formatWhen(d.addedAt)}
                </span>
              </button>
              <Button size="icon" variant="ghost" onClick={() => onFav(d.id)} aria-label="Favorito">
                <Star className={d.favorite ? "fill-primary text-primary" : ""} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemove(d.id)}
                aria-label="Eliminar"
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BrandsPane({ onPick }: { onPick: (b: Brand) => void }) {
  return (
    <div className="px-5 pt-5 pb-4">
      <ul className="flex flex-col gap-2">
        {BRANDS.map((b) => (
          <li key={b.id}>
            <div className="flex items-center gap-2 rounded-md hud p-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onPick(b)}>
                <span className="block font-medium">{b.name}</span>
                <span className="text-xs text-muted">{b.origin}</span>
              </button>
              <a
                href={b.manuals}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                Descargas
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CatalogPane({
  settings,
  syncedCount,
  syncing,
  onToggleAuto,
  onInterval,
  onSyncNow,
}: {
  settings: SyncSettings;
  syncedCount: number;
  syncing: boolean;
  onToggleAuto: (auto: boolean) => void;
  onInterval: (hours: SyncIntervalHours) => void;
  onSyncNow: () => void;
}) {
  const [brand, setBrand] = useState<"faac" | "aprimatic">("faac");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<FaacCatalogHit | null>(null);
  const aprimatic = brand === "aprimatic";
  const hits = useMemo(
    () => (q.trim().length >= 2 ? (aprimatic ? searchAprimaticCatalog(q) : searchFaacCatalog(q)) : []),
    [q, aprimatic],
  );

  return (
    <div className="pane">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[0.08em] text-primary">
          <IconCatalogo className="size-5" /> Catálogo
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Busca en el{" "}
          {aprimatic ? (
            <a href={APRIMATIC_CATALOG_VIEW} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              {APRIMATIC_CATALOG_TITLE}
            </a>
          ) : (
            <a href={FAAC_CATALOG_VIEW} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
              {FAAC_CATALOG_TITLE}
            </a>
          )}
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setBrand("faac");
            setOpen(null);
          }}
          className={cn("chip h-10 min-h-10 px-4", !aprimatic && "chip-on")}
        >
          FAAC
        </button>
        <button
          type="button"
          onClick={() => {
            setBrand("aprimatic");
            setOpen(null);
          }}
          className={cn("chip h-10 min-h-10 px-4", aprimatic && "chip-on")}
        >
          APRIMATIC
        </button>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="relative flex-1">
          <IconBuscar className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={aprimatic ? "Ej. XT 424B, ALZO 55, APRIPASS…" : "Ej. 413, 770N, E024S, barrera…"}
            className="h-11 pl-10"
            aria-label={aprimatic ? "Buscar en catálogo Aprimatic" : "Buscar en catálogo FAAC"}
          />
        </div>
      </form>

      {q.trim().length >= 2 ? (
        hits.length === 0 ? (
          <p className="text-sm text-muted">
            Nada en el catálogo {aprimatic ? "Aprimatic" : "FAAC"} para “{q.trim()}”.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {hits.map((h) => (
              <li key={`${brand}-${h.page}-${h.title}`}>
                <button
                  type="button"
                  onClick={() => setOpen(h)}
                  className="block w-full rounded-md hud p-3 text-left hover:bg-raised"
                >
                  <p className="font-medium">
                    {h.title}{" "}
                    <span className="font-mono text-xs text-primary">pág. {h.print}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{h.snippet}</p>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <p className="text-xs text-muted">
          {aprimatic
            ? "Escribe un modelo Aprimatic para buscar dentro del PDF 2026."
            : "Escribe un modelo FAAC para buscar dentro del PDF 2025."}
        </p>
      )}

      {aprimatic && q.trim().length < 2 ? (
        <div>
          <p className="mb-2 text-xs tracking-[0.16em] text-muted uppercase">Equivalencias</p>
          <ul className="flex flex-col gap-2">
            {APRIMATIC_COMPARE.map((row) => (
              <li key={row.family} className="rounded-md hud p-3">
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => setQ(row.query)}
                >
                  <p className="text-xs tracking-[0.12em] text-muted uppercase">{row.family}</p>
                  <p className="mt-1 font-medium text-primary">{row.aprimatic}</p>
                  <p className="text-xs text-muted">{row.hint}</p>
                </button>
                <ul className="mt-2 flex flex-col gap-1">
                  {row.others.map((o) => (
                    <li key={o.brand} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-muted">{o.brand}</span>
                      {o.query ? (
                        <button
                          type="button"
                          className="text-right font-medium hover:text-primary"
                          onClick={() => {
                            setBrand("faac");
                            setQ(o.query!);
                            setOpen(null);
                          }}
                        >
                          {o.model}
                        </button>
                      ) : (
                        <span className="text-right font-medium">{o.model}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <SyncPane
        settings={settings}
        syncedCount={syncedCount}
        syncing={syncing}
        onToggleAuto={onToggleAuto}
        onInterval={onInterval}
        onSyncNow={onSyncNow}
      />

      {open ? (
        <FaacCatalogViewer
          hit={open}
          onClose={() => setOpen(null)}
          pdfUrl={aprimatic ? APRIMATIC_CATALOG_PDF : undefined}
          catalogTitle={aprimatic ? APRIMATIC_CATALOG_TITLE : undefined}
        />
      ) : null}
    </div>
  );
}

function SyncPane({
  settings,
  syncedCount,
  syncing,
  onToggleAuto,
  onInterval,
  onSyncNow,
}: {
  settings: SyncSettings;
  syncedCount: number;
  syncing: boolean;
  onToggleAuto: (auto: boolean) => void;
  onInterval: (hours: SyncIntervalHours) => void;
  onSyncNow: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div>
        <h2 className="text-lg font-semibold">Sincronización de catálogo</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Actualiza fichas de Visiotech, Safire, Nivian y fabricantes de
          automatismos. Se guarda en este dispositivo.
        </p>
      </div>

      <label className="flex min-h-11 items-center justify-between gap-3 rounded-md hud px-4 py-3">
        <span className="text-sm font-medium">Automática</span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.auto}
          onClick={() => onToggleAuto(!settings.auto)}
          className={cn(
            "relative h-7 w-12 rounded-full transition-colors duration-[var(--motion-quick)]",
            settings.auto ? "bg-primary" : "bg-raised",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 size-6 rounded-full bg-fg transition-transform duration-[var(--motion-quick)]",
              settings.auto ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </label>

      <div>
        <p className="mb-2 text-sm text-muted">Cada cuánto</p>
        <div className="flex gap-2">
          {(
            [
              [12, "12 h"],
              [24, "24 h"],
              [168, "7 días"],
            ] as const
          ).map(([hours, label]) => (
            <button
              key={hours}
              type="button"
              onClick={() => onInterval(hours)}
              className={cn(
                "h-11 flex-1 rounded-md border text-sm font-medium tracking-wide",
                settings.intervalHours === hours
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-surface/80 text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-md hud p-4 text-sm">
        <p className="text-muted">
          Última sync:{" "}
          {settings.lastSyncAt ? formatWhen(settings.lastSyncAt) : "nunca"}
        </p>
        <p className="mt-1 text-muted">
          Fichas sincronizadas:{" "}
          <span className="font-mono text-fg">{syncedCount}</span>
        </p>
        {settings.lastError ? (
          <p className="mt-2 text-danger">{settings.lastError}</p>
        ) : null}
      </div>

      <Button onClick={onSyncNow} disabled={syncing} className="w-full">
        {syncing ? (
          <>
            <Loader2 className="animate-spin" /> Sincronizando…
          </>
        ) : (
          <>
            <RefreshCw /> Sincronizar ahora
          </>
        )}
      </Button>
    </div>
  );
}

function SparesPane({
  seed,
  onAddToPedido,
}: {
  seed: string;
  onAddToPedido: (item: { code: string; name: string }) => void;
}) {
  const [q, setQ] = useState(seed.trim());
  const [hits, setHits] = useState<SpareHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [drawing, setDrawing] = useState<{ id: number; title: string } | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const run = async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    setQ(trimmed);
    setLoading(true);
    setError(null);
    try {
      const res = await queryFaacSpares(trimmed);
      if (!res.ok) {
        setHits([]);
        setError(res.error);
      } else {
        setHits(res.hits);
        if (res.hits.length === 0) {
          setError("Sin despieces ni recambios para ese modelo.");
        }
      }
    } catch (e) {
      setHits([]);
      setError(friendlyServerError(e, "No se pudo consultar FAAC"));
    } finally {
      setLoading(false);
    }
  };

  const openDespiece = async (hit: SpareHit) => {
    if (hit.drawingId) {
      setDrawing({ id: hit.drawingId, title: hit.name });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const id = await resolveFaacDrawingId(hit.id);
      if (id) {
        setHits((prev) =>
          (prev ?? []).map((x) =>
            x.id === hit.id && x.kind === "despiece" ? { ...x, drawingId: id, url: x.url } : x,
          ),
        );
        setDrawing({ id, title: hit.name });
        return;
      }
      setPickedId(`${hit.kind}-${hit.id}`);
    } catch (e) {
      setError(friendlyServerError(e, "No se pudo abrir el despiece."));
    } finally {
      setLoading(false);
    }
  };

  const KIND: Record<SpareKind, string> = {
    despiece: "Despiece",
    recambio: "Recambio",
    familia: "Familia",
  };

  return (
    <div className="pane">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[0.08em] text-primary">
          <IconPiezas className="size-5" /> Recambios FAAC
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Despieces y piezas del catálogo oficial{" "}
          <a
            href={FAAC_SPARES_HOME}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            spareparts.faacgroup.com
          </a>
          . Toca un número del explosivo para copiar o añadir al pedido.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Modelo o código: 740, C720, E024S…"
          aria-label="Buscar recambios FAAC"
        />
        <Button type="submit" disabled={q.trim().length < 2 || loading}>
          {loading ? <Loader2 className="animate-spin" /> : <IconPiezas />}
          Buscar
        </Button>
      </form>

      <div>
        <p className="mb-2 text-xs tracking-[0.16em] text-muted uppercase">Modelos</p>
        <div className="flex flex-wrap gap-2">
          {FAAC_MODELS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => void run(m)}
              className="h-10 rounded-md border border-primary/25 bg-surface/80 px-3 text-sm hover:text-primary"
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Consultando catálogo FAAC…
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {hits && hits.length > 0 ? (
        <div>
          <p className="mb-2 text-xs tracking-[0.16em] text-muted uppercase">Opciones del motor</p>
          <ul className="flex flex-col gap-2">
          {hits.map((h) => {
            const key = `${h.kind}-${h.id}`;
            const open = pickedId === key;
            return (
            <li key={key} className="rounded-md hud p-3">
              {h.kind === "despiece" ? (
                <button
                  type="button"
                  className="block w-full text-left hover:text-primary"
                  onClick={() => void openDespiece(h)}
                >
                  <p className="font-medium">{h.name}</p>
                  <p className="mt-1 font-mono text-xs text-primary">Despiece · tavola</p>
                </button>
              ) : (
                <button
                  type="button"
                  className="block w-full text-left hover:text-primary"
                  onClick={() => setPickedId(open ? null : key)}
                >
                  <p className="font-medium">{h.name}</p>
                  <p className="mt-1 font-mono text-xs text-primary">
                    {KIND[h.kind]}
                    {h.code ? ` · ${h.code}` : ""}
                  </p>
                </button>
              )}
              {open && h.code ? (
                <div className="pedido-actions mt-3 grid grid-cols-2 gap-2">
                  <Button
                    className="h-12 font-semibold"
                    variant="secondary"
                    onClick={async () => {
                      const ok = await copyToClipboard(`(${h.code}) ${h.name}`);
                      if (ok) toast.success("Copiado");
                      else toast.error("No se pudo copiar");
                    }}
                  >
                    Copiar
                  </Button>
                  <Button
                    className="h-12 font-semibold"
                    onClick={() => onAddToPedido({ code: h.code, name: h.name })}
                  >
                    Añadir
                  </Button>
                </div>
              ) : null}
            </li>
            );
          })}
          </ul>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-xs tracking-[0.16em] text-muted uppercase">Familias</p>
        <ul className="grid grid-cols-2 gap-2">
          {FAAC_FAMILIES.map((f) => (
            <li key={f.id}>
              <a
                href={familyUrl(f.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 w-full items-center rounded-md hud px-3 py-2 text-sm hover:bg-raised"
              >
                {f.name}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {drawing ? (
        <FaacDrawingViewer
          drawingId={drawing.id}
          fallbackTitle={drawing.title}
          onClose={() => setDrawing(null)}
          onAdd={(item) => {
            onAddToPedido(item);
          }}
        />
      ) : null}
    </div>
  );
}

function PedidoPane() {
  const [items, setItems] = useState<PedidoItem[]>(() => loadPedido());
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dest, setDest] = useState(() => loadDest());
  const [sent, setSent] = useState<PedidoSent[]>(() => loadSent());
  const [busy, setBusy] = useState<"wa" | "mail" | "pdf" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [emptyOnSend, setEmptyOnSend] = useState(true);
  const [notify, setNotify] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const loaded = useRef(false);
  const numero = peekPedidoNumero();
  const fecha = pedidoFecha();
  const body = formatPedidoShareText(items, numero, fecha);

  const persist = (next: PedidoItem[]) => {
    setItems(next);
    savePedido(next);
    armPedidoReminder();
    void writeFolderEstado();
  };

  const persistDest = (next: typeof dest) => {
    setDest(next);
    saveDest(next);
  };

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void (async () => {
      if (isStaticHost()) return;
      try {
        const res = await fetchPedidoKeep();
        if (!res.ok) {
          setStatus(res.error);
          return;
        }
        const next = mergeKeepItems(loadPedido(), res.items);
        persist(next);
        setStatus(`Nota Keep: ${res.items.length} línea${res.items.length === 1 ? "" : "s"}`);
      } catch (e) {
        setStatus(friendlyServerError(e, "Keep no está en esta copia."));
      }
    })();
  }, []);

  const markSent = (via: PedidoSent["via"]) => {
    const n = takePedidoNumero();
    setSent(recordSent(via, n, totalPiezas(items)));
    toast.success(`Pedido FAAC nº ${n} listo para enviar`);
    if (emptyOnSend) persist([]);
    return n;
  };

  const sendWhatsApp = () => {
    if (!items.length) return;
    const n = markSent("whatsapp");
    window.open(whatsappHref(dest.whatsapp, formatPedidoShareText(items, n, fecha)), "_blank");
  };

  const sendEmail = () => {
    if (!items.length) return;
    const n = markSent("email");
    const href = mailtoHref(
      dest.email,
      `Pedido FAAC nº ${n} — ASPOR`,
      formatPedidoShareText(items, n, fecha),
    );
    window.location.href = href;
  };

  const sendPdf = async (mode: "share" | "download") => {
    if (!items.length) return;
    setBusy("pdf");
    try {
      const n = peekPedidoNumero();
      const bytes = await buildPedidoPdf(items, n, fecha);
      const file = new File([bytes as BlobPart], `Pedido-FAAC-${n}.pdf`, { type: "application/pdf" });
      let sentOk = false;
      if (mode === "share") {
        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ title: `Pedido FAAC ${n}`, text: body, files: [file] });
            sentOk = true;
          } else if (navigator.share) {
            await navigator.share({ title: `Pedido FAAC ${n}`, text: body });
            sentOk = true;
          }
        } catch (e) {
          if ((e as { name?: string }).name === "AbortError") return;
        }
      }
      if (!sentOk) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast.message("PDF descargado");
      }
      markSent("pdf");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setBusy(null);
    }
  };

  const copyKeep = async () => {
    if (!items.length) return;
    const ok = await copyToClipboard(formatPedidoText(items));
    if (ok) {
      markSent("keep");
      toast.success("Copiado. Pégalo en Keep");
      window.open(PEDIDO_KEEP_VIEW, "_blank");
    } else toast.error("No se pudo copiar");
  };

  return (
    <div className="pane">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[0.08em] text-primary">
          <IconPedido className="size-5" /> Pedido FAAC
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Pedido nº {numero} · {fecha} · {totalPiezas(items)} uds. Se envía a FAAC / almacén por WhatsApp, correo o PDF.
          La nota{" "}
          <a href={PEDIDO_KEEP_VIEW} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            Pedir FAAC
          </a>{" "}
          se actualiza pegando el texto (Keep no deja escribir desde la app).
        </p>
        {status ? <p className="mt-2 text-xs text-muted">{status}</p> : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={dest.whatsapp}
          onChange={(e) => persistDest({ ...dest, whatsapp: e.target.value })}
          placeholder="WhatsApp almacén (opcional)"
          inputMode="tel"
          aria-label="Teléfono WhatsApp"
        />
        <Input
          value={dest.email}
          onChange={(e) => persistDest({ ...dest, email: e.target.value })}
          placeholder="Email FAAC / almacén"
          inputMode="email"
          aria-label="Email destinatario"
        />
      </div>

      <form
        className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim() && !name.trim()) return;
          persist(addPedidoItem(items, { code: code.trim(), name: name.trim() || code.trim() }));
          setCode("");
          setName("");
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código"
          aria-label="Código FAAC"
          className="font-mono"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Material"
          aria-label="Nombre del material"
        />
        <Button type="submit">Añadir</Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted">El pedido está vacío. En Piezas pulsa Añadir, o escribe código y material.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 rounded-md hud p-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                {item.code ? <p className="font-mono text-xs text-primary">({item.code})</p> : null}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-11 text-lg"
                  onClick={() =>
                    persist(
                      items.map((i) => (i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i)),
                    )
                  }
                  aria-label="Quitar uno"
                >
                  −
                </Button>
                <span className="w-8 text-center font-mono">{item.qty}</span>
                <Button
                  size="icon"
                  variant="secondary"
                  className="size-11 text-lg"
                  onClick={() =>
                    persist(items.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i)))
                  }
                  aria-label="Añadir uno"
                >
                  +
                </Button>
                <Button
                  size="icon"
                  variant="danger"
                  className="size-11"
                  onClick={() => persist(items.filter((i) => i.id !== item.id))}
                  aria-label="Eliminar"
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button disabled={!items.length} onClick={sendWhatsApp}>
          <MessageCircle /> WhatsApp
        </Button>
        <Button disabled={!items.length} variant="secondary" onClick={sendEmail}>
          <Mail /> Email
        </Button>
        <Button disabled={!items.length || busy === "pdf"} variant="secondary" onClick={() => void sendPdf("share")}>
          {busy === "pdf" ? <Loader2 className="animate-spin" /> : <Share2 />} PDF
        </Button>
        <Button disabled={!items.length || busy === "pdf"} variant="secondary" onClick={() => void sendPdf("download")}>
          <Download /> Descargar
        </Button>
        <Button disabled={!items.length} variant="secondary" onClick={() => void copyKeep()}>
          Copiar a Keep
        </Button>
        <Button disabled={!items.length} variant="danger" onClick={() => persist([])}>
          Vaciar
        </Button>
      </div>
      {items.length > 0 ? (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={emptyOnSend}
            onChange={(e) => setEmptyOnSend(e.target.checked)}
            className="size-4"
          />
          Vaciar el pedido al enviar (queda guardado hasta entonces)
        </label>
      ) : null}

      {notify !== "granted" && notify !== "unsupported" ? (
        <Button
          variant="secondary"
          onClick={async () => {
            const perm = await askPedidoNotify();
            setNotify(perm);
            armPedidoReminder();
            if (perm === "granted") toast.success("Aviso de fin de mes activado");
            else toast.error("Activa las notificaciones en el teléfono");
          }}
        >
          Activar aviso fin de mes
        </Button>
      ) : null}

      {sent.length > 0 ? (
        <p className="text-xs text-muted">
          Último envío: nº {sent[0].numero} · {sent[0].via} · {sent[0].count} uds
        </p>
      ) : null}
    </div>
  );
}

function CodesPane() {
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [names, setNames] = useState<Record<"a" | "b", string>>({
    a: CODE_SOURCES[0].name,
    b: CODE_SOURCES[1].name,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [field, setField] = useState("");
  const [sourceId, setSourceId] = useState<"all" | "a" | "b" | "local">("all");
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      if (isStaticHost()) {
        const local = loadLocalCodeRows();
        setRows(local.rows);
        setHeaders(local.headers);
        setStatus(local.rows.length ? `Teléfono (${local.rows.length})` : "Sin datos remotos en esta copia. Añade un Excel.");
        return;
      }
      const res = await fetchCodeTables();
      const local = loadLocalCodeRows();
      const allRows = [...local.rows, ...res.tables.flatMap((t) => t.rows)];
      const cols = [...new Set([...local.headers, ...res.tables.flatMap((t) => t.headers)])];
      setRows(allRows);
      setHeaders(cols);
      setNames({
        a: res.tables.find((t) => t.sourceId === "a")?.sourceName ?? CODE_SOURCES[0].name,
        b: res.tables.find((t) => t.sourceId === "b")?.sourceName ?? CODE_SOURCES[1].name,
      });
      const errs = res.tables.filter((t) => t.error).map((t) => `${t.sourceName}: ${t.error}`);
      const counts = [
        ...res.tables.filter((t) => !t.error).map((t) => `${t.sourceName} (${t.rows.length})`),
        ...(local.rows.length ? [`Teléfono (${local.rows.length})`] : []),
      ];
      setStatus(
        [...(counts.length ? [`Listo: ${counts.join(" · ")}`] : []), ...errs].join(" ") ||
          "Sin datos",
      );
      setField((cur) => (cur && !cols.includes(cur) ? "" : cur));
    } catch (e) {
      const local = loadLocalCodeRows();
      if (local.rows.length) {
        setRows(local.rows);
        setHeaders(local.headers);
        setStatus(`Sin Drive · ${local.rows.length} filas del teléfono`);
      } else {
        setRows([]);
        setHeaders([]);
        setStatus(friendlyServerError(e, "Sin Drive. Añade un Excel en Archivos."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void load();
  }, [load]);

  const hits = useMemo(
    () => (q.trim() ? searchCodeRows(rows, q, field, sourceId) : []),
    [q, rows, field, sourceId],
  );

  const selectClass =
    "h-11 w-full rounded-md border border-primary/25 bg-surface/80 px-3 text-sm text-fg";

  return (
    <div className="pane">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-[0.08em] text-primary">
          <IconCodigos className="size-5" /> Códigos
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Busca en las hojas de Drive y en los Excel/CSV que hayas importado al teléfono.
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {CODE_SOURCES.map((s) => (
            <li key={s.id}>
              <a
                href={sheetUrl(s.sheetId)}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {names[s.id]}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Código, marca, modelo, mando…"
          aria-label="Buscar en las bases de códigos"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Campo
            <select
              className={`mt-1 ${selectClass}`}
              value={field}
              onChange={(e) => setField(e.target.value)}
            >
              <option value="">Todas las celdas</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Base
            <select
              className={`mt-1 ${selectClass}`}
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value as "all" | "a" | "b" | "local")}
            >
              <option value="all">Todas</option>
              <option value="a">{names.a}</option>
              <option value="b">{names.b}</option>
              <option value="local">Teléfono</option>
            </select>
          </label>
        </div>
      </form>

      <Button onClick={() => void load()} disabled={loading} variant="secondary">
        {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Recargar Drive
      </Button>
      {status ? <p className="text-sm text-muted">{status}</p> : null}

      {q.trim() && !loading && hits.length === 0 && rows.length > 0 ? (
        <p className="text-sm text-muted">Sin coincidencias.</p>
      ) : null}

      {hits.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {hits.map((hit, idx) => (
            <li key={`${hit.sourceId}-${idx}`} className="rounded-md hud p-3">
              <p className="font-mono text-xs text-primary">{hit.sourceName}</p>
              <dl className="mt-2 grid gap-1 text-sm">
                {(field ? [field] : Object.keys(hit.values))
                  .filter((key) => hit.values[key])
                  .slice(0, 10)
                  .map((key) => (
                    <div key={key}>
                      <dt className="text-xs text-muted">{key}</dt>
                      <dd className="font-medium">{hit.values[key]}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AlbaranPane() {
  const empty: AlbaranDraft = {
    cliente: "",
    direccion: "",
    telefono: "",
    concepto: "",
    cantidad: "1",
    importe: "",
    tipo: "REPARACION",
  };

  const [draft, setDraft] = useState<AlbaranDraft>(empty);
  const [nextNum, setNextNum] = useState(peekNextAlbaranNumber);
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [issued, setIssued] = useState<AlbaranRecord | null>(null);
  const [history, setHistory] = useState<AlbaranRecord[]>([]);
  const analyzed = useRef(false);

  useEffect(() => {
    setHistory(loadAlbaranHistory());
    setNextNum(peekNextAlbaranNumber());
  }, []);

  useEffect(() => {
    if (analyzed.current) return;
    analyzed.current = true;
    void (async () => {
      if (isStaticHost()) return;
      try {
        const res = await analyzeAlbaranTemplate();
        setNextNum(adoptDocLastNumber(res.lastFromDoc));
      } catch {
        /* plantilla local */
      }
    })();
  }, []);

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const canGenerate =
    draft.cliente.trim() &&
    draft.concepto.trim() &&
    draft.cantidad.trim() &&
    draft.importe.trim();

  const generate = async () => {
    setBusy(true);
    try {
      const { rec, bytes } = await issueAlbaran(draft);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      const file = new File([blob], `Albaran-${rec.numero}.pdf`, { type: "application/pdf" });
      setPdfUrl(url);
      setPdfFile(file);
      setIssued(rec);
      setHistory(loadAlbaranHistory());
      setNextNum(peekNextAlbaranNumber());
      try {
        await savePdf(file, `${rec.cliente} ${rec.concepto} ${rec.numero}`);
      } catch {
        /* índice local opcional */
      }
      const inFolder = await writeAlbaranPdfToFolder(file);
      if (!inFolder) await writeFolderEstado();
      toast.success(
        inFolder
          ? `Albarán ${rec.numero} guardado en la carpeta /albaranes`
          : `Albarán ${rec.numero} listo. Elige la carpeta del teléfono para no perderlo.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setDraft({ ...empty, tipo: draft.tipo });
    setIssued(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfFile(null);
  };

  const sharePdf = async () => {
    if (!issued) return;
    const title = `Albarán ${issued.numero}`;
    const text = `Albarán ${issued.numero} — ${issued.cliente}\n${issued.fecha} · ${issued.concepto}\nTotal ${euro(issued.total)}\nGRUPO ASPOR S.L.`;
    try {
      if (pdfFile && navigator.canShare?.({ files: [pdfFile] })) {
        await navigator.share({ title, text, files: [pdfFile] });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
    if (pdfUrl) {
      const a = document.createElement("a");
      a.href = pdfUrl;
      a.download = `Albaran-${issued.numero}.pdf`;
      a.click();
      toast.message("PDF descargado. Adjúntalo al envío.");
    }
  };

  return (
    <div className="pane">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <IconAlbaran className="size-5" /> Albarán
        </h2>
      </div>

      {issued && pdfUrl ? (
        <div className="rounded-md hud p-4">
          <p className="font-medium">Albarán {issued.numero} — {issued.cliente}</p>
          <p className="mt-1 font-mono text-xs text-primary">
            {issued.fecha} · Total {euro(issued.total)}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button className="w-full" onClick={() => void sharePdf()}>
              <Share2 /> Compartir
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <a href={pdfUrl} download={`Albaran-${issued.numero}.pdf`}>
                <Download /> Descargar
              </a>
            </Button>
          </div>
          <Button className="mt-3 w-full" variant="secondary" onClick={reset}>
            Nuevo albarán
          </Button>
        </div>
      ) : (
        <div className="rounded-md hud p-4">
          <p className="mb-2 text-xs tracking-[0.16em] text-muted uppercase">Tipo</p>
          <div className="grid grid-cols-2 gap-2">
            {ALBARAN_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, tipo: t }))}
                className={cn("chip", draft.tipo === t && "chip-on")}
              >
                {t}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canGenerate) void generate();
            }}
          >
            {ALBARAN_STEPS.map((s) => (
              <label key={s.key} className="block">
                <span className="mb-1 block text-xs tracking-[0.12em] text-muted uppercase">{s.label}</span>
                <Input
                  value={draft[s.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                  placeholder={s.placeholder}
                  inputMode={s.inputMode}
                  aria-label={s.label}
                />
              </label>
            ))}
            <Button type="submit" className="w-full" disabled={busy || !canGenerate}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              Generar PDF · nº {nextNum}
            </Button>
          </form>
        </div>
      )}

      {history.length > 0 ? (
        <div>
          <p className="mb-2 text-xs tracking-[0.16em] text-muted uppercase">Anteriores</p>
          <ul className="flex flex-col gap-2">
            {history.slice(0, 6).map((h) => (
              <li key={`${h.numero}-${h.createdAt}`} className="rounded-md hud px-3 py-2 text-sm">
                <span className="font-mono text-primary">{h.numero}</span> · {h.cliente} · {h.fecha}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}


function HeaderRow({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      {icon}
      {title}
      {typeof count === "number" ? (
        <span className="font-mono text-xs text-muted">{count}</span>
      ) : null}
    </div>
  );
}
