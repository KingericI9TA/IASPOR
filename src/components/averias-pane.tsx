import { MapPin, Navigation, Phone, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IconAverias } from "@/components/cockpit-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AVERIA_ESTADO_LABEL,
  AVERIA_ESTADOS,
  extractIasporLine,
  formatIasporLine,
  lastClip,
  loadAverias,
  mapsDirUrl,
  mapsEmbedUrl,
  mapsQuery,
  mapsSearchUrl,
  parseIasporAviso,
  patchAveria,
  readClipboardText,
  rememberClip,
  removeAveria,
  upsertAveria,
  type Averia,
  type AveriaDraft,
  type AveriaEstado,
} from "@/lib/averias";
import { peekNextAlbaranNumber, type AlbaranDraft } from "@/lib/albaran";
import { writeFolderEstado } from "@/lib/taller-folder";
import { cn } from "@/lib/utils";

const EMPTY: AveriaDraft = {
  cliente: "",
  direccion: "",
  poblacion: "",
  telefono: "",
  averia: "",
  raw: "",
};

type Filter = "todas" | AveriaEstado;

export function AveriasPane({
  onHacerAlbaran,
}: {
  onHacerAlbaran: (draft: Partial<AlbaranDraft>) => void;
}) {
  const [list, setList] = useState<Averia[]>(() => loadAverias());
  const [filter, setFilter] = useState<Filter>("todas");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<AveriaDraft | null>(null);
  const [form, setForm] = useState<AveriaDraft>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [pasteBox, setPasteBox] = useState("");

  const ingestText = useCallback((text: string, { confirm = true } = {}) => {
    const line = extractIasporLine(text);
    if (!line) return false;
    const parsed = parseIasporAviso(line);
    if (!parsed) return false;
    if (confirm) {
      setPending(parsed);
      setShowForm(false);
      return true;
    }
    const res = upsertAveria(parsed);
    setList(res.list);
    setOpenId(res.item.id);
    setPending(null);
    rememberClip(parsed.raw);
    void writeFolderEstado();
    toast.success(res.existed ? "Esa avería ya estaba — la abrí" : "Avería pegada");
    return true;
  }, []);

  const scanClipboard = useCallback(async () => {
    const text = await readClipboardText();
    if (!text) return false;
    const line = extractIasporLine(text);
    if (!line || line === lastClip()) return false;
    return ingestText(text);
  }, [ingestText]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void scanClipboard();
    };
    const onPaste = (e: ClipboardEvent) => {
      const t = e.clipboardData?.getData("text") ?? "";
      if (extractIasporLine(t)) {
        e.preventDefault();
        ingestText(t);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("paste", onPaste);
    };
  }, [ingestText, scanClipboard]);

  const visible = useMemo(
    () => (filter === "todas" ? list : list.filter((a) => a.estado === filter)),
    [list, filter],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      todas: list.length,
      pendiente: 0,
      curso: 0,
      albaran: 0,
      cerrada: 0,
    };
    for (const a of list) c[a.estado] += 1;
    return c;
  }, [list]);

  const pegar = async () => {
    const ok = await scanClipboard();
    if (ok) return;
    toast.message("Copia el mensaje en WhatsApp y pulsa otra vez, o pégalo abajo");
  };

  const confirmPending = () => {
    if (!pending) return;
    const res = upsertAveria(pending);
    setList(res.list);
    setOpenId(res.item.id);
    rememberClip(pending.raw);
    setPending(null);
    void writeFolderEstado();
    toast.success(res.existed ? "Esa avería ya estaba" : "Avería lista");
  };

  const saveForm = () => {
    if (!form.cliente.trim() && !form.averia.trim()) {
      toast.error("Pon cliente o qué ocurre");
      return;
    }
    const res = upsertAveria({ ...form, raw: formatIasporLine(form) });
    setList(res.list);
    setOpenId(res.item.id);
    setShowForm(false);
    setForm(EMPTY);
    void writeFolderEstado();
    toast.success("Ficha guardada");
  };

  const setEstado = (id: string, estado: AveriaEstado) => {
    const next = patchAveria(id, { estado });
    if (next) {
      setList(loadAverias());
      void writeFolderEstado();
    }
  };

  const toAlbaran = (a: Averia) => {
    const direccion = mapsQuery(a);
    patchAveria(a.id, { estado: "albaran", albaranNumero: peekNextAlbaranNumber() });
    setList(loadAverias());
    void writeFolderEstado();
    onHacerAlbaran({
      cliente: a.cliente,
      direccion,
      telefono: a.telefono,
      concepto: a.averia,
      tipo: "REPARACION",
      cantidad: "1",
    });
  };

  const mapQ = pending ? mapsQuery(pending) : showForm ? mapsQuery(form) : "";

  return (
    <div className="pane">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <IconAverias className="size-5" /> Averías
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          En el grupo:{" "}
          <span className="font-mono text-xs text-primary">
            IASPOR: Cliente | Dirección | Población | Teléfono | Avería
          </span>
          . Copia el mensaje del grupo y pulsa Pegar aviso.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button type="button" onClick={() => void pegar()}>
          Pegar aviso
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setShowForm(true);
            setPending(null);
            setForm(EMPTY);
          }}
        >
          <Plus /> Nueva
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setPasteBox("");
            const el = document.getElementById("averia-paste");
            el?.focus();
          }}
        >
          Pegar aquí
        </Button>
      </div>

      <textarea
        id="averia-paste"
        value={pasteBox}
        onChange={(e) => setPasteBox(e.target.value)}
        onPaste={(e) => {
          const t = e.clipboardData.getData("text");
          if (extractIasporLine(t)) {
            e.preventDefault();
            ingestText(t);
            setPasteBox("");
          }
        }}
        placeholder="Pega aquí: IASPOR: Comunidad | juan alvargonzalez 3 | Gijón | 64539727 | Portón no abre"
        rows={2}
        className="w-full resize-y rounded-md border border-primary/25 bg-surface/80 px-3 py-2 font-mono text-sm text-fg placeholder:text-subtle"
        aria-label="Pegar mensaje IASPOR"
      />
      {pasteBox.trim() ? (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (!ingestText(pasteBox, { confirm: false })) toast.error("El mensaje tiene que empezar por IASPOR:");
            else setPasteBox("");
          }}
        >
          Crear ficha
        </Button>
      ) : null}

      {pending ? (
        <div className="rounded-md hud flex flex-col gap-3 p-4">
          <p className="text-xs tracking-[0.16em] text-muted uppercase">Aviso en el portapapeles</p>
          <FieldGrid
            value={pending}
            onChange={setPending}
          />
          {mapQ ? <MapsBlock query={mapQ} /> : null}
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={confirmPending}>
              Confirmar ficha
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Descartar
            </Button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <form
          className="rounded-md hud flex flex-col gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveForm();
          }}
        >
          <p className="text-xs tracking-[0.16em] text-muted uppercase">Nueva ficha</p>
          <FieldGrid value={form} onChange={setForm} />
          {mapsQuery(form) ? <MapsBlock query={mapsQuery(form)} /> : null}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              Guardar
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cerrar
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["todas", ...AVERIA_ESTADOS] as Filter[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn("chip h-9 min-h-9 px-3", filter === id && "chip-on")}
          >
            {id === "todas" ? "Todas" : AVERIA_ESTADO_LABEL[id]} ({counts[id]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md hud p-4 text-sm text-muted">
          No hay averías {filter === "todas" ? "aún" : `en ${AVERIA_ESTADO_LABEL[filter]}`}. Copia un{" "}
          <span className="font-mono text-primary">IASPOR:</span> del grupo y pégalo.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((a) => (
            <li key={a.id} className="rounded-md hud p-3">
              <button
                type="button"
                className="flex w-full items-start gap-3 text-left"
                onClick={() => setOpenId((id) => (id === a.id ? null : a.id))}
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-sm px-2 py-1 text-xs tracking-wide",
                    a.estado === "pendiente" && "bg-lamp-amber/20 text-lamp-amber",
                    a.estado === "curso" && "bg-primary/20 text-primary",
                    a.estado === "albaran" && "bg-ok/20 text-ok",
                    a.estado === "cerrada" && "bg-muted/20 text-muted",
                  )}
                >
                  {AVERIA_ESTADO_LABEL[a.estado]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{a.cliente || "Sin nombre"}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {[a.direccion, a.poblacion].filter(Boolean).join(", ") || "Sin dirección"}
                  </span>
                  <span className="mt-1 block text-sm">{a.averia || "—"}</span>
                </span>
              </button>

              {openId === a.id ? (
                <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
                  <FieldGrid
                    value={a}
                    onChange={(d) => {
                      const next = patchAveria(a.id, { ...d, raw: formatIasporLine(d) });
                      if (next) setList(loadAverias());
                    }}
                  />
                  {mapsQuery(a) ? <MapsBlock query={mapsQuery(a)} /> : null}
                  {a.telefono ? (
                    <a href={`tel:${a.telefono.replace(/\s+/g, "")}`} className="chip h-11 min-h-11 justify-center gap-2">
                      <Phone className="size-4" /> Llamar {a.telefono}
                    </a>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {AVERIA_ESTADOS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={cn("chip h-9 min-h-9 px-3", a.estado === st && "chip-on")}
                        onClick={() => setEstado(a.id, st)}
                      >
                        {AVERIA_ESTADO_LABEL[st]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="flex-1" onClick={() => toAlbaran(a)}>
                      Hacer albarán
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      aria-label="Borrar avería"
                      onClick={() => {
                        if (!window.confirm("¿Borrar esta avería?")) return;
                        setList(removeAveria(a.id));
                        void writeFolderEstado();
                        if (openId === a.id) setOpenId(null);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {a.albaranNumero ? (
                    <p className="font-mono text-xs text-ok">Albarán previsto nº {a.albaranNumero}</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldGrid({
  value,
  onChange,
}: {
  value: AveriaDraft;
  onChange: (next: AveriaDraft) => void;
}) {
  const set = (key: keyof AveriaDraft) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Input value={value.cliente} onChange={set("cliente")} placeholder="Cliente / comunidad" aria-label="Cliente" />
      <Input value={value.direccion} onChange={set("direccion")} placeholder="Dirección" aria-label="Dirección" />
      <Input value={value.poblacion} onChange={set("poblacion")} placeholder="Población" aria-label="Población" />
      <Input value={value.telefono} onChange={set("telefono")} placeholder="Teléfono" aria-label="Teléfono" inputMode="tel" />
      <Input
        className="sm:col-span-2"
        value={value.averia}
        onChange={set("averia")}
        placeholder="Qué ocurre"
        aria-label="Avería"
      />
    </div>
  );
}

function MapsBlock({ query }: { query: string }) {
  const search = mapsSearchUrl(query);
  const dir = mapsDirUrl(query);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <iframe
        title={`Mapa ${query}`}
        src={mapsEmbedUrl(query)}
        className="h-48 w-full bg-raised"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="grid grid-cols-2 gap-px bg-border">
        <a
          href={search}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 bg-surface text-sm text-primary hover:bg-raised"
        >
          <MapPin className="size-4" /> Maps
        </a>
        <a
          href={dir}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 bg-surface text-sm text-primary hover:bg-raised"
        >
          <Navigation className="size-4" /> Cómo llegar
        </a>
      </div>
    </div>
  );
}
