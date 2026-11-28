"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FolderUp, Loader2, UploadCloud, X } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, Input } from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";
import {
  collectEntry,
  commonRootPrefix,
  normalizeDestination,
  skipPath,
  toBase64,
  validateDestination,
  type PickedFile,
} from "@/lib/local-files";

const MAX_FILES = 1500;
const MAX_FILE_BYTES = 2_500_000;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const BATCH_RAW_BYTES = 2_500_000;
const BATCH_FILES = 30;

export type PushResult = { commit: string; files: number };

type TargetFile = PickedFile & { target: string };

export function PushProjectDialog({
  open,
  onClose,
  owner,
  repo,
  branch,
  onPushed,
}: {
  open: boolean;
  onClose: () => void;
  owner: string;
  repo: string;
  branch: string;
  onPushed: (result: PushResult) => void;
}) {
  const { currentId } = useAccount();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [destination, setDestination] = useState("");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setSkipped(0);
    setDestination("");
    setMessage("");
    setDragging(false);
    setCollecting(false);
    setBusy(false);
    setPhase("");
    setProgress(0);
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, [open]);

  useEffect(() => {
    if (!open || busy) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open]);

  const rootPrefix = useMemo(() => commonRootPrefix(files), [files]);
  const totalBytes = useMemo(
    () => files.reduce((total, item) => total + item.file.size, 0),
    [files],
  );
  const oversized = useMemo(
    () => files.filter((item) => item.file.size > MAX_FILE_BYTES),
    [files],
  );
  const preview = files.slice(0, 8);

  function finalPath(path: string) {
    const stripped =
      rootPrefix && path.startsWith(`${rootPrefix}/`)
        ? path.slice(rootPrefix.length + 1)
        : path;
    const prefix = normalizeDestination(destination);
    return prefix ? `${prefix}/${stripped}` : stripped;
  }

  function addPicked(incoming: PickedFile[], skippedCount = 0) {
    if (skippedCount > 0) setSkipped((value) => value + skippedCount);
    if (incoming.length === 0) return;
    setFiles((previous) => {
      const map = new Map(previous.map((item) => [item.path, item]));
      for (const item of incoming) {
        if (!skipPath(item.path) && !map.has(item.path)) map.set(item.path, item);
      }
      return [...map.values()].sort((a, b) =>
        a.path.localeCompare(b.path, undefined, { numeric: true }),
      );
    });
  }

  function onInputPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(event.target.files ?? []);
    addPicked(list.map((file) => ({ path: file.webkitRelativePath || file.name, file })));
    event.target.value = "";
  }

  async function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (busy) return;

    const entries = Array.from(event.dataTransfer.items ?? [])
      .map((item) => item.webkitGetAsEntry())
      .filter((entry): entry is FileSystemEntry => Boolean(entry));

    if (entries.length === 0) {
      const dropped = Array.from(event.dataTransfer.files ?? []);
      addPicked(dropped.map((file) => ({ path: file.name, file })));
      return;
    }

    setCollecting(true);
    setError("");
    try {
      const collected: PickedFile[] = [];
      const skippedCount = { count: 0 };
      for (const entry of entries) {
        await collectEntry(entry, "", collected, skippedCount);
      }
      addPicked(collected, skippedCount.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile leggere i file trascinati.");
    } finally {
      setCollecting(false);
    }
  }

  async function push(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !currentId || !branch) return;
    if (files.length === 0) {
      setError("Scegli almeno un file o una cartella da caricare.");
      return;
    }
    if (oversized.length > 0) {
      setError(
        `Riduci i file oltre 2,5 MB: ${oversized
          .slice(0, 3)
          .map((item) => finalPath(item.path))
          .join(", ")}${oversized.length > 3 ? "…" : ""}`,
      );
      return;
    }
    if (files.length > MAX_FILES) {
      setError(`Puoi caricare al massimo ${MAX_FILES} file in una volta.`);
      return;
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      setError(`La selezione supera ${formatBytes(MAX_TOTAL_BYTES)}.`);
      return;
    }

    let prefix: string;
    try {
      prefix = validateDestination(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cartella di destinazione non valida.");
      return;
    }

    setBusy(true);
    setError("");
    setProgress(0);
    try {
      const mapped: TargetFile[] = files.map((item) => {
        const stripped =
          rootPrefix && item.path.startsWith(`${rootPrefix}/`)
            ? item.path.slice(rootPrefix.length + 1)
            : item.path;
        return { ...item, target: prefix ? `${prefix}/${stripped}` : stripped };
      });

      const blobs: { path: string; sha: string }[] = [];
      let sentBytes = 0;
      let batch: TargetFile[] = [];
      let batchBytes = 0;

      const flush = async () => {
        if (batch.length === 0) return;
        setPhase(
          `Caricamento file ${Math.min(blobs.length + batch.length, mapped.length)}/${mapped.length}…`,
        );
        const payload = await Promise.all(
          batch.map(async (item) => ({
            path: item.target,
            content: toBase64(await item.file.arrayBuffer()),
          })),
        );
        const response = await apiFetch<{ blobs: { path: string; sha: string }[] }>(
          "/api/github/create",
          {
            method: "POST",
            body: JSON.stringify({
              action: "blobs",
              accountId: currentId,
              owner,
              repo,
              files: payload,
            }),
          },
        );
        blobs.push(...response.blobs);
        sentBytes += batchBytes;
        setProgress(totalBytes > 0 ? Math.round((sentBytes / totalBytes) * 100) : 100);
        batch = [];
        batchBytes = 0;
      };

      for (const item of mapped) {
        if (
          batch.length > 0 &&
          (batchBytes + item.file.size > BATCH_RAW_BYTES || batch.length >= BATCH_FILES)
        ) {
          await flush();
        }
        batch.push(item);
        batchBytes += item.file.size;
      }
      await flush();

      setPhase("Creazione del commit…");
      setProgress(100);
      const result = await apiFetch<{ commit: string | null; files: number }>(
        "/api/github/create",
        {
          method: "POST",
          body: JSON.stringify({
            action: "commit",
            accountId: currentId,
            owner,
            repo,
            branch,
            message: message.trim() || `Importa ${mapped.length} file da locale`,
            files: blobs,
          }),
        },
      );
      onPushed({ commit: result.commit ?? "", files: result.files });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Push fallito.");
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  if (!open) return null;

  const invalid =
    files.length === 0 ||
    files.length > MAX_FILES ||
    oversized.length > 0 ||
    totalBytes > MAX_TOTAL_BYTES;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form
        onSubmit={push}
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-project-title"
        className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5  sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.05] text-signal-300">
              <FolderUp className="h-5 w-5" />
            </span>
            <div>
              <h2 id="push-project-title" className="text-lg font-semibold text-paper">
                Push dal computer
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-signal-400">
                Trascina file o cartelle e crea un commit su{" "}
                <span className="font-mono text-signal-400">
                  {owner}/{repo}
                </span>{" "}
                · <span className="font-mono text-signal-400">{branch || "—"}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Chiudi"
            className="grid h-8 w-8 shrink-0 place-items-center rounded text-signal-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        {!branch ? (
          <div className="mt-4">
            <Alert>Attendi il caricamento del repository, poi riprova.</Alert>
          </div>
        ) : null}

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            if (busy) return;
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragging(false);
          }}
          onDrop={(event) => void onDrop(event)}
          className={cn(
            "mt-5 rounded-md border border-dashed p-5 text-center transition",
            dragging
              ? "border-signal-300/60 bg-signal-500/[0.08]"
              : "border-white/[0.14] bg-white/[0.02]",
          )}
        >
          <span
            className={cn(
              "mx-auto grid h-12 w-12 place-items-center rounded-md border transition",
              dragging
                ? "border-signal-300/40 bg-signal-500/15 text-signal-200"
                : "border-white/10 bg-white/[0.04] text-signal-400",
            )}
          >
            {collecting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </span>
          <p className="mt-3 text-sm font-medium text-signal-200">
            {collecting ? "Lettura della selezione…" : "Trascina qui file o cartelle"}
          </p>
          <p className="mt-1 text-[11.5px] text-signal-400">
            Le cartelle mantengono la struttura. .git, node_modules, build e simili
            vengono ignorati.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || collecting}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Scegli file
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || collecting}
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderUp className="h-3.5 w-3.5" />
              Scegli cartella
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onInputPicked}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            onChange={onInputPicked}
            className="hidden"
          />
        </div>

        {files.length > 0 ? (
          <div className="mt-4 rounded-md border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="font-medium text-signal-200">
                {files.length} file · {formatBytes(totalBytes)}
                {skipped > 0 ? (
                  <span className="ml-1.5 font-normal text-signal-400">
                    ({skipped} elementi ignorati)
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setSkipped(0);
                  setProgress(0);
                }}
                disabled={busy}
                className="text-[11px] text-signal-400 transition hover:text-rose-300 disabled:opacity-50"
              >
                Svuota selezione
              </button>
            </div>
            {rootPrefix ? (
              <p className="mt-1.5 text-[11px] text-signal-200/80">
                La cartella <span className="font-mono">{rootPrefix}</span> diventa la radice
                del commit.
              </p>
            ) : null}
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-signal-400">
              {preview.map((item) => (
                <li key={item.path} className="truncate">
                  {finalPath(item.path)}
                </li>
              ))}
              {files.length > preview.length ? (
                <li className="text-signal-500">+ altri {files.length - preview.length} file</li>
              ) : null}
            </ul>
            {oversized.length > 0 ? (
              <p className="mt-2 text-[11px] text-rose-300">
                {oversized.length} file superano 2,5 MB e non possono essere caricati.
              </p>
            ) : null}
            {busy || progress > 0 ? (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-paper transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {phase ? <p className="mt-1.5 text-[11px] text-signal-400">{phase}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-signal-400">
            Cartella di destinazione <span className="font-normal text-signal-500">(facoltativa)</span>
            <Input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="es. src/esercizi"
              disabled={busy}
              className="mt-1.5 font-mono !text-[12px]"
            />
          </label>
          <label className="block text-xs font-medium text-signal-400">
            Messaggio del commit
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Importa esercizi da locale"
              maxLength={200}
              disabled={busy}
              className="mt-1.5"
            />
          </label>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-signal-500">
          I file con lo stesso percorso vengono sovrascritti; quelli non selezionati restano
          invariati. Massimo {MAX_FILES} file, 2,5 MB ciascuno,{" "}
          {formatBytes(MAX_TOTAL_BYTES)} in totale.
        </p>

        <div className="mt-4 flex justify-end gap-2 border-t border-white/[0.06] pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Annulla
          </Button>
          <Button type="submit" loading={busy} disabled={invalid || !branch}>
            {!busy ? <Check className="h-4 w-4" /> : null}
            Carica e fai commit
          </Button>
        </div>
      </form>
    </div>
  );
}
