import { Download, Loader2, Plus, Share2, Trash2 } from "lucide-react";
import { IconPresupuesto } from "@/components/cockpit-icons";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { euro, parseImporte } from "@/lib/albaran";
import {
  buildCaratulaPdf,
  buildTipoPdf,
  inspectPresupuestoFolder,
  expandPresupuestoFolders,
  previewPresupuestoTipo,
  cachePreFiles,
  loadCachedPreFiles,
  localTipoPreview,
  linesTotal,
  conIva,
  puntoAparte,
  type CaratulaDraft,
  type DriveItem,
  type PreLine,
  type TipoPreview,
} from "@/lib/presupuesto";
import { cn } from "@/lib/utils";

type Phase = "boot" | "cliente" | "concepto" | "tipo" | "preview" | "modify" | "ready";

export function PresupuestoPane() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [sample, setSample] = useState("");
  const [draft, setDraft] = useState<CaratulaDraft>({
    cliente: "",
    direccion: "",
    localidad: "",
    telefono: "",
    concepto: "",
  });
  const [tipo, setTipo] = useState("");
  const [preview, setPreview] = useState<TipoPreview | null>(null);
  const [cantidades, setCantidades] = useState("");
  const [importe, setImporte] = useState("");
  const [lines, setLines] = useState<PreLine[]>([{ qty: "1", desc: "", amount: "" }]);
  const [cuerpoTexto, setCuerpoTexto] = useState("");
  const [epigrafeCantidades, setEpigrafeCantidades] = useState("Concepto");
  const [epigrafeImporte, setEpigrafeImporte] = useState("Importe total");
  const [busy, setBusy] = useState(false);
  const [caratula, setCaratula] = useState<File | null>(null);
  const [hojas, setHojas] = useState<File[]>([]);
  const [totalAcum, setTotalAcum] = useState(0);
  const [offline, setOffline] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const current = urls.current;
    return () => current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    void (async () => {
      const cached = loadCachedPreFiles();
      if (cached.length) {
        setFiles(cached);
        setOffline(true);
        setPhase("cliente");
      }
      try {
        const res = await inspectPresupuestoFolder();
        if (res.files.length) {
          setFiles(res.files);
          cachePreFiles(res.files);
          setOffline(false);
        }
        setSample(res.sampleAfter);
        setPhase("cliente");
        void (async () => {
          try {
            const more = await expandPresupuestoFolders();
            if (more.files.length) {
              setFiles(more.files);
              cachePreFiles(more.files);
            }
          } catch {
            /* keep root list */
          }
        })();
      } catch {
        if (!cached.length) {
          setPhase("cliente");
        }
      }
    })();
  }, []);

  const holdCaratula = async () => {
    setBusy(true);
    try {
      const { bytes } = await buildCaratulaPdf(draft);
      const file = new File([bytes as BlobPart], "Caratula.pdf", { type: "application/pdf" });
      setCaratula(file);
      toast.success("Carátula reservada");
      setPhase("tipo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar la carátula");
    } finally {
      setBusy(false);
    }
  };

  const buscarTipo = async () => {
    setBusy(true);
    try {
      const res = await previewPresupuestoTipo({ data: { tipo, files } });
      if (!res.ok) {
        toast.message("Sin Drive o sin ficha. Plantilla ASPOR local.");
        setPreview(localTipoPreview(tipo));
        setCantidades("");
        setImporte("");
        setCuerpoTexto("");
        setLines([{ qty: "1", desc: draft.concepto || tipo, amount: "" }]);
        setPhase("modify");
        return;
      }
      setPreview(res);
      setCantidades(res.cantidadesHint);
      setImporte(res.totalHint);
      setCuerpoTexto(puntoAparte(res.text || ""));
      setLines([
        {
          qty: "1",
          desc: res.cantidadesHint || draft.concepto || res.file.name.replace(/\.(docx|doc|pdf)$/i, ""),
          amount: res.totalHint,
        },
      ]);
      setPhase("modify");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se encontró el documento");
    } finally {
      setBusy(false);
    }
  };

  const uniqueName = (fileName: string, existing: File[]) => {
    const names = new Set(existing.map((f) => f.name.toLowerCase()));
    if (!names.has(fileName.toLowerCase())) return fileName;
    const base = fileName.replace(/\.pdf$/i, "");
    let n = 2;
    while (names.has(`${base}-${n}.pdf`.toLowerCase())) n += 1;
    return `${base}-${n}.pdf`;
  };

  const commitHoja = async (current: File[]) => {
    if (!preview) return current;
    let cover = caratula;
    if (!cover) {
      const { bytes } = await buildCaratulaPdf(draft);
      cover = new File([bytes as BlobPart], "Caratula.pdf", { type: "application/pdf" });
      setCaratula(cover);
    }
    const { bytes, fileName } = await buildTipoPdf({
      ...draft,
      tipoName: preview.file.name,
      cantidades: lines.map((l) => `${l.qty} ${l.desc}`).join("\n") || cantidades,
      importe: String(conIva(linesTotal(lines) || parseImporte(importe))),
      epigrafeCantidades,
      epigrafeImporte,
      lines,
      bodyText: cuerpoTexto,
      images: [],
      sourcePdf: preview.sourcePdf,
    });
    const file = new File([bytes as BlobPart], uniqueName(fileName, current), { type: "application/pdf" });
    const next = [...current, file];
    setHojas(next);
    setTotalAcum((t) => t + conIva(linesTotal(lines) || parseImporte(importe)));
    return next;
  };

  const resetHojaForm = () => {
    setTipo("");
    setPreview(null);
    setCantidades("");
    setImporte("");
    setLines([{ qty: "1", desc: "", amount: "" }]);
    setCuerpoTexto("");
  };

  const addSheet = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await commitHoja(hojas);
      toast.success("Hoja añadida. Elige otra.");
      resetHojaForm();
      setPhase("tipo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo añadir la hoja");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!preview && !hojas.length) return;
    setBusy(true);
    try {
      if (preview) await commitHoja(hojas);
      else if (!caratula) {
        const { bytes } = await buildCaratulaPdf(draft);
        setCaratula(new File([bytes as BlobPart], "Caratula.pdf", { type: "application/pdf" }));
      }
      setPhase("ready");
      toast.success("Presupuesto listo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    } finally {
      setBusy(false);
    }
  };

  const pair = () => [caratula, ...hojas].filter((f): f is File => !!f);
  const suma = linesTotal(lines);
  const neto = suma || parseImporte(importe);
  const totalVista = conIva(neto);

  const patchLine = (i: number, patch: Partial<PreLine>) => {
    setLines((prev) => {
      const next = prev.map((l, n) => (n === i ? { ...l, ...patch } : l));
      if (patch.amount !== undefined) {
        const sum = linesTotal(next);
        queueMicrotask(() => setImporte(sum ? String(sum) : ""));
      }
      return next;
    });
  };

  const share = async () => {
    const filesTo = pair();
    if (!filesTo.length) return;
    try {
      if (navigator.canShare?.({ files: filesTo })) {
        await navigator.share({ title: "Presupuesto ASPOR", files: filesTo });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "Presupuesto ASPOR", text: `${draft.cliente} · ${draft.concepto}` });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
    download();
  };

  const download = () => {
    for (const f of pair()) {
      const url = URL.createObjectURL(f);
      urls.current.push(url);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      a.click();
    }
  };

  const reset = () => {
    setPhase("cliente");
    setDraft({ cliente: "", direccion: "", localidad: "", telefono: "", concepto: "" });
    setTipo("");
    setPreview(null);
    setCantidades("");
    setImporte("");
    setLines([{ qty: "1", desc: "", amount: "" }]);
    setCuerpoTexto("");
    setEpigrafeCantidades("Concepto");
    setEpigrafeImporte("Importe total");
    setCaratula(null);
    setHojas([]);
    setTotalAcum(0);
  };

  return (
    <div className="pane">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <IconPresupuesto className="size-5" /> Presupuesto
          {offline ? (
            <span className="chip min-h-7 px-2 font-sans text-[0.65rem] tracking-normal normal-case">Sin Drive</span>
          ) : null}
        </h2>
      </div>

      {phase === "boot" ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Abriendo raíz, años y meses…
        </p>
      ) : null}

      {phase === "cliente" ? (
        <form
          className="rounded-md hud p-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.cliente.trim()) return;
            setPhase("concepto");
          }}
        >
          <p className="text-xs tracking-[0.16em] text-muted uppercase">Datos del cliente</p>
          <Input
            value={draft.cliente}
            onChange={(e) => setDraft((d) => ({ ...d, cliente: e.target.value }))}
            placeholder="Nombre de cliente"
            aria-label="Nombre de cliente"
            autoFocus
          />
          <Input
            value={draft.direccion}
            onChange={(e) => setDraft((d) => ({ ...d, direccion: e.target.value }))}
            placeholder="Dirección"
            aria-label="Dirección"
          />
          <Input
            value={draft.localidad}
            onChange={(e) => setDraft((d) => ({ ...d, localidad: e.target.value }))}
            placeholder="Localidad / Provincia"
            aria-label="Localidad / Provincia"
          />
          <label className="block">
            <span className="mb-1 block text-xs tracking-[0.12em] text-muted uppercase">TEL/MAIL</span>
            <Input
              value={draft.telefono}
              onChange={(e) => setDraft((d) => ({ ...d, telefono: e.target.value }))}
              placeholder="985... o correo@..."
              aria-label="TEL/MAIL"
            />
          </label>
          <Button type="submit" disabled={!draft.cliente.trim()}>
            Siguiente
          </Button>
        </form>
      ) : null}

      {phase === "concepto" ? (
        <form
          className="rounded-md hud p-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.concepto.trim()) return;
            void holdCaratula();
          }}
        >
          <p className="text-xs tracking-[0.16em] text-muted uppercase">Presupuesto de:</p>
          <p className="text-xs text-muted">
            Se redacta bajo el epígrafe, en negrita
            {sample ? `, como en el original: “${sample.slice(0, 90)}…”` : "."}
          </p>
          <textarea
            className="min-h-24 w-full rounded-md border border-primary/25 bg-surface/80 px-3 py-2 text-sm text-fg"
            value={draft.concepto}
            onChange={(e) => setDraft((d) => ({ ...d, concepto: e.target.value }))}
            placeholder="Ej. Instalación de puerta seccional de 3 × 2,25 m con motor FAAC 746"
            aria-label="Presupuesto de"
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setPhase("cliente")}>
              Atrás
            </Button>
            <Button type="submit" className="flex-1" disabled={!draft.concepto.trim() || busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Reservar carátula
            </Button>
          </div>
        </form>
      ) : null}

      {phase === "tipo" ? (
        <form
          className="rounded-md hud p-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!tipo.trim()) return;
            void buscarTipo();
          }}
        >
          <p className="text-xs tracking-[0.16em] text-muted uppercase">Tipo de presupuesto</p>
          <p className="text-xs text-muted">
            {hojas.length
              ? `Carátula + ${hojas.length} hoja${hojas.length === 1 ? "" : "s"}. Añade otra o busca el siguiente tipo.`
              : "Carátula reservada. Busca por modelo, cliente o carpeta (año/mes)."}
          </p>
          {hojas.length > 0 ? (
            <ul className="text-xs text-muted">
              {hojas.map((f) => (
                <li key={f.name} className="font-mono">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            placeholder="Ej. FAAC 746, SECCIONAL, Dimitry…"
            aria-label="Tipo de presupuesto"
            autoFocus
          />
          {files.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {files
                .filter((f) => !/caratula/i.test(f.name))
                .filter((f) => {
                  const q = tipo.trim().toLowerCase();
                  if (q.length < 2) return !f.path;
                  const hay = `${f.name} ${f.path ?? ""}`.toLowerCase();
                  return hay.includes(q);
                })
                .slice(0, 10)
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn("chip h-8 min-h-8 px-3", tipo === f.name && "chip-on")}
                    onClick={() => setTipo(f.name)}
                    title={f.path}
                  >
                    {f.name.replace(/\.(docx|pdf|doc|rtf)$/i, "")}
                    {f.path ? <span className="ml-1 opacity-60">{f.path.split(" / ").slice(0, 2).join("/")}</span> : null}
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-xs text-muted">
              Si no aparecen fichas, abre la carpeta y ponla como “cualquier persona con el enlace puede ver”.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setPhase("concepto")}>
              Atrás
            </Button>
            <Button type="submit" className="flex-1" disabled={tipo.trim().length < 2 || busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Buscar documento
            </Button>
          </div>
          {hojas.length > 0 ? (
            <Button type="button" className="h-12 font-semibold" onClick={() => void finish()} disabled={busy}>
              Finalizar presupuesto
            </Button>
          ) : null}
        </form>
      ) : null}

      {phase === "modify" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void finish();
          }}
        >
          <div>
            <p className="text-xs tracking-[0.16em] text-muted uppercase">Hoja {hojas.length + 1}</p>
            <p className="mt-1 text-lg font-semibold leading-tight">
              {preview?.file.name.replace(/\.(docx|doc|pdf|rtf)$/i, "") ?? "Documento"}
            </p>
          </div>

          <div>
            <label className="text-xs tracking-[0.14em] text-muted uppercase" htmlFor="word-text">
              Texto del Word (misma estructura, sin fotos)
            </label>
            <textarea
              id="word-text"
              className="pre-paper mt-2 font-mono text-[0.95rem] leading-snug"
              value={cuerpoTexto}
              onChange={(e) => setCuerpoTexto(e.target.value)}
              placeholder="El texto del Word aparece aquí, con párrafos y tablas. Las fotos se omiten."
              aria-label="Texto del documento"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs tracking-[0.14em] text-muted uppercase">Líneas</p>
            {lines.map((row, i) => (
              <div key={i} className="pre-line">
                <div className="flex items-center justify-between">
                  <span className="text-xs tracking-[0.12em] text-muted uppercase">Línea {i + 1}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Quitar línea"
                    disabled={lines.length === 1}
                    onClick={() => {
                      setLines((prev) => {
                        const next = prev.filter((_, n) => n !== i);
                        const rows = next.length ? next : [{ qty: "1", desc: "", amount: "" }];
                        queueMicrotask(() => setImporte(String(linesTotal(rows) || "")));
                        return rows;
                      });
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Input
                  value={row.desc}
                  onChange={(e) => patchLine(i, { desc: e.target.value })}
                  aria-label={`Concepto línea ${i + 1}`}
                  placeholder="Qué es (motor, mandos, instalación…)"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted">
                    Ud.
                    <Input
                      className="mt-1"
                      value={row.qty}
                      onChange={(e) => patchLine(i, { qty: e.target.value })}
                      inputMode="decimal"
                      aria-label={`Cantidad línea ${i + 1}`}
                      placeholder="1"
                    />
                  </label>
                  <label className="text-xs text-muted">
                    Importe
                    <Input
                      className="mt-1"
                      value={row.amount}
                      onChange={(e) => patchLine(i, { amount: e.target.value })}
                      inputMode="decimal"
                      aria-label={`Importe línea ${i + 1}`}
                      placeholder="0,00"
                    />
                  </label>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="h-12"
              onClick={() => setLines((prev) => [...prev, { qty: "1", desc: "", amount: "" }])}
            >
              <Plus className="size-4" /> Añadir línea
            </Button>
          </div>

          <div className="pre-line">
            <p className="text-xs tracking-[0.14em] text-muted uppercase">Totales</p>
            <p className="text-sm text-muted">Base (ud. × importe): {euro(neto).replace(" EUR", " €")}</p>
            <p className="text-sm text-muted">IVA 21%: {euro(totalVista - neto).replace(" EUR", " €")}</p>
            <p className="text-xl font-semibold text-primary">
              {epigrafeImporte.trim() || "Importe total"}: {euro(totalVista).replace(" EUR", " €")}
            </p>
            <p className="text-xs text-muted">Total = cantidad × 1,21</p>
          </div>

          <div className="pre-dock">
            <Button type="button" variant="secondary" className="h-14 font-semibold" onClick={() => void addSheet()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              Añadir
            </Button>
            <Button type="button" className="h-14 font-semibold" onClick={() => void finish()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Download />}
              Finalizar
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={() => setPhase("tipo")}>
            Atrás
          </Button>
        </form>
      ) : null}

      {phase === "ready" ? (
        <div className="rounded-md hud p-4">
          <p className="font-medium">{draft.cliente}</p>
          <p className="mt-1 font-mono text-xs text-primary">
            {draft.concepto} · {hojas.length} hoja{hojas.length === 1 ? "" : "s"} · Total{" "}
            {euro(totalAcum || totalVista).replace(" EUR", " €")}
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {pair().map((f) => (
              <li key={f.name} className="font-mono text-xs text-muted">
                {f.name}
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button className="w-full" onClick={() => void share()}>
              <Share2 /> Compartir
            </Button>
            <Button variant="secondary" className="w-full" onClick={download}>
              <Download /> Descargar
            </Button>
          </div>
          <Button className="mt-3 w-full" variant="secondary" onClick={reset}>
            Nuevo presupuesto
          </Button>
        </div>
      ) : null}
    </div>
  );
}
