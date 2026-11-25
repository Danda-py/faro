"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FileArchive,
  FolderUp,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, Input } from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";
import {
  collectEntry,
  commonRootPrefix,
  skipPath,
  toBase64,
  type PickedFile,
} from "@/lib/local-files";

export type CreatedRepo = {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
};

const MAX_FILES = 1500;
const MAX_FILE_BYTES = 2_500_000;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const BATCH_RAW_BYTES = 2_500_000;
const BATCH_FILES = 30;

function repoNameFromFolder(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
}

export function CreateRepoDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (repo: CreatedRepo) => void;
}) {
  const { currentId } = useAccount();
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedRepo | null>(null);

  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setNameTouched(false);
    setDescription("");
    setIsPrivate(true);
    setFiles([]);
    setSkipped(0);
    setDragging(false);
    setCollecting(false);
    setError("");
    setPhase("");
    setProgress(0);
    setBusy(false);
    setCreated(null);
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

  useEffect(() => {
    if (nameTouched || !rootPrefix) return;
    const suggestion = repoNameFromFolder(rootPrefix);
    if (suggestion) setName(suggestion);
  }, [nameTouched, rootPrefix]);

  const totalBytes = useMemo(
    () => files.reduce((total, item) => total + item.file.size, 0),
    [files],
  );
  const oversized = useMemo(
    () => files.filter((item) => item.file.size > MAX_FILE_BYTES),
    [files],
  );
  const preview = files.slice(0, 6);

  function finalPath(path: string) {
    return rootPrefix && path.startsWith(`${rootPrefix}/`)
      ? path.slice(rootPrefix.length + 1)
      : path;
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
      setError(
        err instanceof Error ? err.message : "Impossibile leggere i file trascinati.",
      );
    } finally {
      setCollecting(false);
    }
  }

  async function createRepo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Dai un nome alla repository.");
      return;
    }
    if (oversized.length > 0) {
      setError(`Riduci i file oltre 2,5 MB: ${oversized.slice(0, 3).map((item) => finalPath(item.path)).join(", ")}${oversized.length > 3 ? "…" : ""}`);
      return;
    }
    if (files.length > MAX_FILES) {
      setError(`Puoi importare al massimo ${MAX_FILES} file in una volta.`);
      return;
    }
    if (totalBytes > MAX_TOTAL_BYTES) {
      setError(`La selezione supera ${formatBytes(MAX_TOTAL_BYTES)}.`);
      return;
    }

    setBusy(true);
    setError("");
    setProgress(0);
    let repo = created;
    try {
      if (!repo) {
        setPhase("Creazione della repository su GitHub…");
        const result = await apiFetch<{ repo: CreatedRepo }>("/api/github/create", {
          method: "POST",
          body: JSON.stringify({
            action: "repo",
            accountId: currentId,
            name: trimmedName,
            description,
            private: isPrivate,
          }),
        });
        repo = result.repo;
        setCreated(repo);
      }

      if (files.length > 0) {
        const blobs: { path: string; sha: string }[] = [];
        let sentBytes = 0;
        let batch: PickedFile[] = [];
        let batchBytes = 0;

        const flush = async () => {
          if (batch.length === 0) return;
          setPhase(
            `Caricamento file ${Math.min(blobs.length + batch.length, files.length)}/${files.length}…`,
          );
          const payload = await Promise.all(
            batch.map(async (item) => ({
              path: finalPath(item.path),
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
                owner: repo!.owner,
                repo: repo!.name,
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

        for (const item of files) {
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

        setPhase("Creazione del commit iniziale…");
        setProgress(100);
        await apiFetch("/api/github/create", {
          method: "POST",
          body: JSON.stringify({
            action: "commit",
            accountId: currentId,
            owner: repo.owner,
            repo: repo.name,
            branch: repo.defaultBranch,
            message: "Importa file da Faro",
            files: blobs,
          }),
        });
      }

      onCreated(repo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione della repository fallita.");
    } finally {
      setBusy(false);
      setPhase("");
    }
  }

  if (!open) return null;

  const invalid =
    !name.trim() ||
    files.length > MAX_FILES ||
    oversized.length > 0 ||
    totalBytes > MAX_TOTAL_BYTES;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <form
        onSubmit={createRepo}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-repo-title"
        className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-violet-300">
              <FileArchive className="h-5 w-5" />
            </span>
            <div>
              <h2 id="create-repo-title" className="text-lg font-semibold text-zinc-50">
                Nuova repository
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Trascina file o cartelle: la struttura viene riprodotta su GitHub con un
                unico commit iniziale.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Chiudi"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 space-y-2">
            <Alert>{error}</Alert>
            {created ? (
              <p className="text-[11.5px] text-zinc-500">
                La repository{" "}
                <a
                  href={`https://github.com/${created.fullName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-300 underline decoration-violet-400/40 hover:text-violet-200"
                >
                  {created.fullName}
                </a>{" "}
                è stata creata: puoi riprovare il caricamento senza duplicarla.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-400">
            Nome repository
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameTouched(true);
              }}
              placeholder="il-mio-progetto"
              maxLength={100}
              autoFocus
              disabled={busy || Boolean(created)}
              className="mt-1.5"
            />
          </label>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(event) => setIsPrivate(event.target.checked)}
                disabled={busy || Boolean(created)}
                className="h-4 w-4 rounded border-white/20 bg-white/5"
              />
              Repository privato
            </label>
          </div>
          <label className="block text-xs font-medium text-zinc-400 sm:col-span-2">
            Descrizione <span className="font-normal text-zinc-600">(facoltativa)</span>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A cosa serve questo progetto"
              maxLength={350}
              disabled={busy || Boolean(created)}
              className="mt-1.5"
            />
          </label>
        </div>

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
            "mt-5 rounded-2xl border border-dashed p-5 text-center transition",
            dragging
              ? "border-violet-300/60 bg-violet-500/[0.1]"
              : "border-white/[0.14] bg-white/[0.02]",
          )}
        >
          <span
            className={cn(
              "mx-auto grid h-12 w-12 place-items-center rounded-2xl border transition",
              dragging
                ? "border-violet-300/40 bg-violet-500/15 text-violet-200"
                : "border-white/10 bg-white/[0.04] text-zinc-400",
            )}
          >
            {collecting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UploadCloud className="h-5 w-5" />
            )}
          </span>
          <p className="mt-3 text-sm font-medium text-zinc-200">
            {collecting ? "Lettura della selezione…" : "Trascina qui file o cartelle"}
          </p>
          <p className="mt-1 text-[11.5px] text-zinc-500">
            Le cartelle mantengono la loro struttura; le cartelle vuote ricevono un
            .gitkeep.
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
          <input ref={fileInputRef} type="file" multiple onChange={onInputPicked} className="hidden" />
          <input ref={folderInputRef} type="file" multiple onChange={onInputPicked} className="hidden" />
        </div>

        {files.length > 0 ? (
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="font-medium text-zinc-200">
                {files.length} file · {formatBytes(totalBytes)}
                {skipped > 0 ? (
                  <span className="ml-1.5 font-normal text-zinc-500">
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
                className="text-[11px] text-zinc-500 transition hover:text-rose-300 disabled:opacity-50"
              >
                Svuota selezione
              </button>
            </div>
            {rootPrefix ? (
              <p className="mt-1.5 text-[11px] text-cyan-200/80">
                La cartella <span className="font-mono">{rootPrefix}</span> diventa la radice
                della repository.
              </p>
            ) : null}
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-500">
              {preview.map((item) => (
                <li key={item.path} className="truncate">
                  {finalPath(item.path)}
                </li>
              ))}
              {files.length > preview.length ? (
                <li className="text-zinc-600">+ altri {files.length - preview.length} file</li>
              ) : null}
            </ul>
            {oversized.length > 0 ? (
              <p className="mt-2 text-[11px] text-rose-300">
                {oversized.length} file superano 2,5 MB e non possono essere importati.
              </p>
            ) : null}
            {files.length > MAX_FILES ? (
              <p className="mt-2 text-[11px] text-rose-300">
                Massimo {MAX_FILES} file per repository: rimuovi {files.length - MAX_FILES}{" "}
                file.
              </p>
            ) : null}
            {totalBytes > MAX_TOTAL_BYTES ? (
              <p className="mt-2 text-[11px] text-rose-300">
                La selezione supera {formatBytes(MAX_TOTAL_BYTES)}.
              </p>
            ) : null}
            {busy || progress > 0 ? (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {phase ? <p className="mt-1.5 text-[11px] text-zinc-500">{phase}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-[11px] leading-relaxed text-zinc-600">
            Massimo {MAX_FILES} file, 2,5 MB ciascuno, {formatBytes(MAX_TOTAL_BYTES)} in
            totale.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Annulla
            </Button>
            <Button type="submit" loading={busy} disabled={invalid}>
              {!busy ? <Check className="h-4 w-4" /> : null}
              {created ? "Riprova caricamento" : "Crea repository"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
