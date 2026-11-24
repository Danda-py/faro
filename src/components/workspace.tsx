"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  FileCode2,
  FilePlus2,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, Input } from "@/components/ui";
import { cn, fileExtension, formatBytes } from "@/lib/utils";

type TreeEntry = { path: string; size: number; sha: string };

type TreePayload = {
  repo: {
    name: string;
    owner: string;
    fullName: string;
    private: boolean;
    defaultBranch: string;
    description: string | null;
  };
  branches: string[];
  tree: TreeEntry[];
  truncated: boolean;
};

type FilePayload = {
  path: string;
  sha: string;
  size: number;
  binary: boolean;
  content: string;
  downloadUrl: string | null;
};

type FixPayload = {
  path: string;
  summary: string;
  notes: string[];
  content: string;
};

type CleanupCandidate = {
  path: string;
  reason: string;
  confidence: number;
  sha: string;
  size: number;
};

type CleanupPayload = {
  candidates: CleanupCandidate[];
  notes: string;
  scanned: number;
};

export function Workspace({ owner, repo }: { owner: string; repo: string }) {
  const { currentId, current } = useAccount();

  const [treeData, setTreeData] = useState<TreePayload | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [branch, setBranch] = useState("");
  const [filter, setFilter] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [file, setFile] = useState<FilePayload | null>(null);
  const [draft, setDraft] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [uploadContent, setUploadContent] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [aiInstruction, setAiInstruction] = useState("");
  const [fixing, setFixing] = useState(false);
  const [fix, setFix] = useState<FixPayload | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupPayload | null>(null);
  const [toDelete, setToDelete] = useState<string[]>([]);

  const loadTree = useCallback(
    async (ref?: string) => {
      if (!currentId) return;
      setTreeLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ accountId: currentId, owner, repo });
        if (ref) params.set("ref", ref);
        const data = await apiFetch<TreePayload>(`/api/github/tree?${params.toString()}`);
        setTreeData(data);
        setBranch(ref || data.repo.defaultBranch);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossibile leggere il repository.");
      } finally {
        setTreeLoading(false);
      }
    },
    [currentId, owner, repo],
  );

  useEffect(() => {
    setTreeData(null);
    setFile(null);
    setSelected(null);
    setCleanup(null);
    setFix(null);
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const openFile = useCallback(
    async (path: string) => {
      if (!currentId) return;
      setSelected(path);
      setFileLoading(true);
      setError("");
      setFix(null);
      try {
        const params = new URLSearchParams({ accountId: currentId, owner, repo, path });
        if (branch) params.set("ref", branch);
        const data = await apiFetch<FilePayload>(`/api/github/file?${params.toString()}`);
        setFile(data);
        setDraft(data.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossibile aprire il file.");
      } finally {
        setFileLoading(false);
      }
    },
    [branch, currentId, owner, repo],
  );

  async function saveFile(message?: string) {
    if (!file || !currentId) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ sha: string }>("/api/github/file", {
        method: "PUT",
        body: JSON.stringify({
          accountId: currentId,
          owner,
          repo,
          path: file.path,
          content: draft,
          message,
          branch,
          sha: file.sha,
        }),
      });
      setFile({ ...file, sha: result.sha, size: draft.length, content: draft });
      setNotice("File aggiornato su GitHub.");
      void loadTree(branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio fallito.");
    } finally {
      setSaving(false);
    }
  }

  async function createFile() {
    const path = newPath.trim().replace(/^\/+/, "");
    if (!path || !currentId) return;
    setCreating(true);
    setError("");
    try {
      await apiFetch("/api/github/file", {
        method: "PUT",
        body: JSON.stringify({
          accountId: currentId,
          owner,
          repo,
          path,
          content: uploadContent ?? "",
          message: `Aggiungi ${path}`,
          branch,
        }),
      });
      setShowNew(false);
      setNewPath("");
      setUploadContent(null);
      await loadTree(branch);
      await openFile(path);
      setNotice("File creato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione fallita.");
    } finally {
      setCreating(false);
    }
  }

  async function removeFile() {
    if (!file || !currentId) return;
    if (!window.confirm(`Eliminare ${file.path}? Verrà creato un commit su GitHub.`)) return;
    setError("");
    try {
      await apiFetch("/api/github/file", {
        method: "DELETE",
        body: JSON.stringify({
          accountId: currentId,
          owner,
          repo,
          path: file.path,
          sha: file.sha,
          branch,
        }),
      });
      setFile(null);
      setSelected(null);
      setDraft("");
      setNotice("File eliminato.");
      void loadTree(branch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eliminazione fallita.");
    }
  }

  function download() {
    if (!file || !currentId) return;
    const params = new URLSearchParams({
      accountId: currentId,
      owner,
      repo,
      path: file.path,
    });
    if (branch) params.set("ref", branch);
    window.open(`/api/github/download?${params.toString()}`, "_blank");
  }

  async function runFix() {
    if (!file || !currentId) return;
    setFixing(true);
    setError("");
    setFix(null);
    try {
      const data = await apiFetch<FixPayload>("/api/ai/fix", {
        method: "POST",
        body: JSON.stringify({
          accountId: currentId,
          owner,
          repo,
          path: file.path,
          ref: branch,
          instruction: aiInstruction,
        }),
      });
      setFix(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revisione AI fallita.");
    } finally {
      setFixing(false);
    }
  }

  async function runScan() {
    if (!currentId) return;
    setScanning(true);
    setError("");
    try {
      const data = await apiFetch<CleanupPayload>("/api/ai/cleanup", {
        method: "POST",
        body: JSON.stringify({ accountId: currentId, owner, repo, ref: branch }),
      });
      setCleanup(data);
      setToDelete(data.candidates.map((candidate) => candidate.path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scansione fallita.");
    } finally {
      setScanning(false);
    }
  }

  async function deleteSelected() {
    if (!cleanup || !currentId || toDelete.length === 0) return;
    if (
      !window.confirm(
        `Eliminare ${toDelete.length} file? Ogni eliminazione crea un commit su GitHub.`,
      )
    ) {
      return;
    }
    setError("");
    let removed = 0;
    for (const candidate of cleanup.candidates.filter((item) =>
      toDelete.includes(item.path),
    )) {
      try {
        await apiFetch("/api/github/file", {
          method: "DELETE",
          body: JSON.stringify({
            accountId: currentId,
            owner,
            repo,
            path: candidate.path,
            sha: candidate.sha,
            branch,
            message: `Pulizia: rimuovi ${candidate.path}`,
          }),
        });
        removed += 1;
      } catch (err) {
        setError(
          err instanceof Error
            ? `${candidate.path}: ${err.message}`
            : `Impossibile eliminare ${candidate.path}.`,
        );
      }
    }
    setCleanup(null);
    setToDelete([]);
    setNotice(`${removed} file eliminati.`);
    if (file && toDelete.includes(file.path)) {
      setFile(null);
      setSelected(null);
    }
    void loadTree(branch);
  }

  function onUploadPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadContent(String(reader.result ?? ""));
      setNewPath(picked.name);
      setShowNew(true);
      setNotice(`Pronto per il caricamento: ${picked.name}`);
    };
    reader.readAsText(picked);
    event.target.value = "";
  }

  const filteredTree = useMemo(() => {
    const entries = treeData?.tree ?? [];
    const term = filter.trim().toLowerCase();
    const result = term
      ? entries.filter((entry) => entry.path.toLowerCase().includes(term))
      : entries;
    return result.slice(0, 500);
  }, [filter, treeData]);

  const dirty = Boolean(file && draft !== file.content);

  return (
    <div className="space-y-4 py-2">
      <header className="animate-fade-up flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] text-zinc-600">
              {owner}
              {treeData?.repo.private ? <Lock className="h-3 w-3" /> : null}
            </p>
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {treeData?.repo.name ?? repo}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branch}
            onChange={(event) => {
              const next = event.target.value;
              setBranch(next);
              setFile(null);
              setSelected(null);
              void loadTree(next);
            }}
            className="input-base h-9 w-auto !py-0 !text-[12.5px]"
          >
            {(treeData?.branches ?? [branch]).map((name) => (
              <option key={name} value={name} className="bg-ink-900">
                {name}
              </option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={() => void loadTree(branch)} loading={treeLoading}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" />
            Carica
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowNew((value) => !value);
              setUploadContent(null);
            }}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Nuovo
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onUploadPicked}
            className="hidden"
          />
        </div>
      </header>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {showNew ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void createFile();
          }}
          className="glass flex flex-wrap items-end gap-2 p-3"
        >
          <div className="min-w-[220px] flex-1">
            <span className="label-base">Percorso del nuovo file</span>
            <Input
              value={newPath}
              onChange={(event) => setNewPath(event.target.value)}
              placeholder="src/nuovo-file.ts"
              autoFocus
            />
          </div>
          <Button type="submit" loading={creating} disabled={!newPath.trim()}>
            <Check className="h-4 w-4" />
            {uploadContent !== null ? "Carica file" : "Crea"}
          </Button>
          <Button
            type="button"
            variant="subtle"
            onClick={() => {
              setShowNew(false);
              setNewPath("");
              setUploadContent(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <section className="glass flex max-h-[70vh] flex-col overflow-hidden">
          <div className="border-b border-white/5 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Cerca file…"
                className="!py-2 !pl-9 !text-[12.5px]"
              />
            </div>
            <p className="mt-2 px-1 text-[10.5px] text-zinc-600">
              {treeData ? `${filteredTree.length} di ${treeData.tree.length} file` : "—"}
              {treeData?.truncated ? " · lista troncata" : ""}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {treeLoading && !treeData ? (
              <div className="flex items-center justify-center py-10 text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : null}
            {filteredTree.map((entry) => (
              <button
                key={entry.path}
                onClick={() => void openFile(entry.path)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition",
                  selected === entry.path
                    ? "bg-violet-500/15 text-violet-100"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
                )}
                title={entry.path}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{entry.path}</span>
              </button>
            ))}
            {!treeLoading && treeData && filteredTree.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-zinc-600">
                Nessun file trovato.
              </p>
            ) : null}
          </div>
        </section>

        <section className="glass flex min-h-[520px] flex-col overflow-hidden">
          {file ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12.5px] text-zinc-200">
                    {file.path}
                  </p>
                  <p className="text-[10.5px] text-zinc-600">
                    {formatBytes(file.size)} · {fileExtension(file.path) || "file"}
                    {dirty ? " · modificato" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="subtle" size="sm" onClick={download} title="Scarica">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => void removeFile()} title="Elimina">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    loading={saving}
                    disabled={!dirty || file.binary}
                    onClick={() => void saveFile()}
                  >
                    <Save className="h-3.5 w-3.5" />
                    Salva
                  </Button>
                </div>
              </div>

              {file.binary ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                  <FileCode2 className="h-6 w-6 text-zinc-600" />
                  <p className="text-sm text-zinc-400">
                    File binario: puoi solo scaricarlo.
                  </p>
                  <Button variant="ghost" size="sm" onClick={download}>
                    <Download className="h-3.5 w-3.5" />
                    Scarica
                  </Button>
                </div>
              ) : (
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  spellCheck={false}
                  className="min-h-[420px] flex-1 resize-none bg-transparent p-4 font-mono text-[12.5px] leading-relaxed text-zinc-200 outline-none"
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              {fileLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              ) : (
                <>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-500">
                    <FileCode2 className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-zinc-400">
                    Seleziona un file per aprirlo nell&apos;editor.
                  </p>
                  <p className="text-xs text-zinc-600">
                    Puoi creare nuovi file o caricarne uno dal tuo computer.
                  </p>
                </>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3 2xl:max-h-[70vh] 2xl:overflow-y-auto">
          <div className="glass p-4">
            <h2 className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              <Wand2 className="h-4 w-4 text-violet-300" />
              Correggi con l'AI
            </h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
              {file
                ? "L'AI legge il file aperto e propone una versione corretta. Nulla viene inviato a GitHub senza il tuo Salva."
                : "Apri un file per correggerlo con l'AI."}
            </p>
            <textarea
              value={aiInstruction}
              onChange={(event) => setAiInstruction(event.target.value)}
              rows={2}
              placeholder="Es. rimuovi il codice duplicato e gestisci gli errori"
              className="input-base mt-3 resize-y !text-[12.5px]"
            />
            <Button
              className="mt-2.5 w-full"
              size="sm"
              loading={fixing}
              disabled={!file || file.binary}
              onClick={() => void runFix()}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Analizza file
            </Button>

            {fix ? (
              <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[12.5px] text-zinc-200">{fix.summary}</p>
                {fix.notes.length ? (
                  <ul className="space-y-1 text-[11.5px] text-zinc-500">
                    {fix.notes.map((note) => (
                      <li key={note}>· {note}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraft(fix.content);
                      setNotice("Correzione caricata nell'editor: controlla e salva.");
                    }}
                  >
                    Applica
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDraft(fix.content);
                      void saveFile(`Revisione AI di ${fix.path}`);
                    }}
                  >
                    Applica e salva
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass p-4">
            <h2 className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              <Trash2 className="h-4 w-4 text-cyan-300" />
              Pulizia repository
            </h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
              L'AI individua backup, duplicati e file inutilizzati. Sei tu a confermare
              cosa eliminare.
            </p>
            <Button
              className="mt-3 w-full"
              size="sm"
              variant="ghost"
              loading={scanning}
              onClick={() => void runScan()}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Scansiona {treeData ? treeData.tree.length : ""} file
            </Button>

            {cleanup ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-zinc-500">
                  {cleanup.scanned} file analizzati · {cleanup.candidates.length} candidati
                </p>
                {cleanup.notes ? (
                  <p className="text-[11px] italic text-zinc-600">{cleanup.notes}</p>
                ) : null}
                {cleanup.candidates.map((candidate) => (
                  <label
                    key={candidate.path}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2"
                  >
                    <input
                      type="checkbox"
                      checked={toDelete.includes(candidate.path)}
                      onChange={(event) =>
                        setToDelete((previous) =>
                          event.target.checked
                            ? [...previous, candidate.path]
                            : previous.filter((path) => path !== candidate.path),
                        )
                      }
                      className="mt-0.5 h-3.5 w-3.5 accent-violet-500"
                    />
                    <span className="min-w-0">
                      <span className="block break-all font-mono text-[11.5px] text-zinc-300">
                        {candidate.path}
                      </span>
                      <span className="block text-[10.5px] text-zinc-600">
                        {candidate.reason} · {Math.round(candidate.confidence * 100)}%
                      </span>
                    </span>
                  </label>
                ))}
                {cleanup.candidates.length === 0 ? (
                  <p className="text-[11.5px] text-emerald-300/80">
                    Nessun file da eliminare: il repository è in ordine.
                  </p>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    className="w-full"
                    onClick={() => void deleteSelected()}
                    disabled={toDelete.length === 0}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Elimina selezionati ({toDelete.length})
                  </Button>
                )}
              </div>
            ) : null}
          </div>

          <div className="glass p-4">
            <h2 className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              Chat con il contesto
            </h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
              Apri l&apos;assistente per domande libere sul repository
              {current ? ` (${current.label || current.login})` : ""}.
            </p>
            <Link href="/ai" className="mt-3 block">
              <Button size="sm" variant="ghost" className="w-full">
                Apri assistente
              </Button>
            </Link>
            <p className="mt-2 text-[10.5px] text-zinc-600">
              Branch <span className="font-mono text-zinc-500">{branch || "—"}</span> ·
              account <span className="font-mono text-zinc-500">{current?.login || "—"}</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
