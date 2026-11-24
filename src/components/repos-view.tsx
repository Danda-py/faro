"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Eye,
  EyeOff,
  FolderGit2,
  Globe,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, Input } from "@/components/ui";
import { timeAgo } from "@/lib/utils";

type Repo = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  archived: boolean;
  fork: boolean;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  updatedAt: string;
};

export function ReposView() {
  const { accounts, currentId, current } = useAccount();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<Repo | null>(null);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [editArchived, setEditArchived] = useState(false);

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (!currentId) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          accountId: currentId,
          page: String(targetPage),
        });
        const data = await apiFetch<{ repos: Repo[]; hasMore: boolean; hiddenRepoIds: number[] }>(
          `/api/github/repos?${params.toString()}`,
        );
        if (!append) setHiddenIds(data.hiddenRepoIds);
        setRepos((previous) => (append ? [...previous, ...data.repos] : data.repos));
        setHasMore(data.hasMore);
        setPage(targetPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Caricamento fallito.");
      } finally {
        setLoading(false);
      }
    },
    [currentId],
  );

  useEffect(() => {
    setRepos([]);
    setPage(1);
    setHasMore(false);
    if (currentId) void load(1, false);
  }, [currentId, load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return repos.filter((repo) => {
      if (!showHidden && hiddenIds.includes(repo.id)) return false;
      if (!term) return true;
      return (
        repo.name.toLowerCase().includes(term) ||
        repo.fullName.toLowerCase().includes(term) ||
        (repo.description ?? "").toLowerCase().includes(term)
      );
    });
  }, [query, repos, hiddenIds, showHidden]);

  async function toggleHidden(repo: Repo) {
    if (!currentId) return;
    const hidden = !hiddenIds.includes(repo.id);
    try {
      await apiFetch("/api/github/repos", {
        method: "POST",
        body: JSON.stringify({
          accountId: currentId,
          repoId: repo.id,
          owner: repo.owner,
          repo: repo.name,
          hidden,
        }),
      });
      setHiddenIds((ids) => hidden ? [...ids, repo.id] : ids.filter((id) => id !== repo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile aggiornare la dashboard.");
    }
  }

  function openEditor(repo: Repo) {
    setEditing(repo);
    setEditName(repo.name);
    setEditDescription(repo.description ?? "");
    setEditPrivate(repo.private);
    setEditArchived(repo.archived);
  }

  async function saveRepo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !currentId) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiFetch<{ repo: Repo }>("/api/github/repos", {
        method: "PATCH",
        body: JSON.stringify({
          accountId: currentId,
          owner: editing.owner,
          repo: editing.name,
          name: editName,
          description: editDescription,
          private: editPrivate,
          archived: editArchived,
        }),
      });
      setRepos((items) => items.map((item) => item.id === editing.id ? data.repo : item));
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile modificare il repository.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRepo(repo: Repo) {
    if (!currentId || !window.confirm(`Eliminare definitivamente ${repo.fullName} da GitHub? Questa azione non si può annullare.`)) return;
    setError("");
    try {
      await apiFetch("/api/github/repos", {
        method: "DELETE",
        body: JSON.stringify({ accountId: currentId, owner: repo.owner, repo: repo.name }),
      });
      setRepos((items) => items.filter((item) => item.id !== repo.id));
      setHiddenIds((ids) => ids.filter((id) => id !== repo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile eliminare il repository.");
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="glass p-8">
          <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/5 text-violet-300">
            <UserRound className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-semibold">Nessun account collegato</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
            Collega il tuo account GitHub per vedere repository, file e usare l&apos;AI.
          </p>
          <Link href="/accounts" className="mt-6 inline-flex">
            <Button>Collega un account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <header className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Repository di{" "}
            <span className="gradient-text">{current?.label || current?.login || "—"}</span>
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            {repos.filter((repo) => !hiddenIds.includes(repo.id)).length} repository visibili · {current?.login}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load(1, false)}
          loading={loading}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Aggiorna
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca un repository…"
          className="!pl-10"
        />
        </div>
        {hiddenIds.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setShowHidden((value) => !value)}>
            {showHidden ? "Nascondi repository nascosti" : `Mostra nascosti (${hiddenIds.length})`}
          </Button>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {loading && repos.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="glass h-36 animate-pulse bg-white/[0.03]" />
          ))}
        </div>
      ) : null}

      {!loading && filtered.length === 0 && !error ? (
        <div className="glass p-10 text-center">
          <FolderGit2 className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-400">Nessun repository trovato.</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((repo) => (
          <article
            key={repo.id}
            className="glass glass-hover group relative flex min-h-[172px] flex-col justify-between p-4"
          >
            <Link href={`/repos/${repo.owner}/${repo.name}`} className="block pr-8">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-zinc-600">{repo.owner}</p>
                  <h2 className="truncate text-[15px] font-medium text-zinc-100">{repo.name}</h2>
                </div>
                <span className="mt-0.5 text-zinc-600">
                  {repo.private ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 min-h-[34px] text-[12.5px] leading-relaxed text-zinc-500">
                {repo.description || "Nessuna descrizione."}
              </p>
            </Link>
            <a
              href={`https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visita ${repo.fullName} su GitHub`}
              title="Visita su GitHub"
              className="absolute bottom-11 right-3 grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.08] hover:text-cyan-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <details className="absolute right-3 top-3">
              <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-lg text-zinc-500 hover:bg-white/[0.08] hover:text-white" aria-label={`Azioni per ${repo.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-white/10 bg-[#111522]/95 p-1.5 shadow-2xl backdrop-blur-xl">
                <a href={`https://github.com/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white">
                  <ExternalLink className="h-3.5 w-3.5" /> Visita su GitHub
                </a>
                <button onClick={() => openEditor(repo)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white">
                  <Pencil className="h-3.5 w-3.5" /> Modifica proprietà
                </button>
                <button onClick={() => void toggleHidden(repo)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/[0.07] hover:text-white">
                  {hiddenIds.includes(repo.id) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {hiddenIds.includes(repo.id) ? "Mostra in dashboard" : "Nascondi dalla dashboard"}
                </button>
                <button onClick={() => void removeRepo(repo)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10">
                  <Trash2 className="h-3.5 w-3.5" /> Elimina da GitHub…
                </button>
              </div>
            </details>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
              <div className="flex items-center gap-3">
                {repo.language ? <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />{repo.language}</span> : null}
                {repo.stars > 0 ? <span className="flex items-center gap-1"><Star className="h-3 w-3" />{repo.stars}</span> : null}
                <span>{timeAgo(repo.updatedAt)}</span>
                {hiddenIds.includes(repo.id) ? <span className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">Nascosto</span> : null}
              </div>
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
          </article>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
          <form onSubmit={saveRepo} className="glass w-full max-w-lg space-y-4 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="repo-edit-title">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="repo-edit-title" className="text-lg font-semibold">Modifica repository</h2><p className="mt-1 text-xs text-zinc-500">Le modifiche sono applicate subito su GitHub.</p></div>
              <button type="button" onClick={() => setEditing(null)} className="text-sm text-zinc-500 hover:text-zinc-200">Chiudi</button>
            </div>
            <label className="block text-xs font-medium text-zinc-400">Nome<input className="input-base mt-1" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={100} required /></label>
            <label className="block text-xs font-medium text-zinc-400">Descrizione<textarea className="input-base mt-1 min-h-24 resize-y" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={350} /></label>
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={editPrivate} onChange={(event) => setEditPrivate(event.target.checked)} /> Repository privato</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={editArchived} onChange={(event) => setEditArchived(event.target.checked)} /> Archivia repository</label>
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEditing(null)}>Annulla</Button><Button type="submit" loading={saving}><Pencil className="h-3.5 w-3.5" />Salva modifiche</Button></div>
          </form>
        </div>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            onClick={() => void load(page + 1, true)}
            loading={loading}
          >
            Carica altri repository
          </Button>
        </div>
      ) : null}
    </div>
  );
}
