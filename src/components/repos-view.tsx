"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FolderGit2,
  Globe,
  Lock,
  RefreshCw,
  Search,
  Star,
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
        const data = await apiFetch<{ repos: Repo[]; hasMore: boolean }>(
          `/api/github/repos?${params.toString()}`,
        );
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
    if (!term) return repos;
    return repos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(term) ||
        repo.fullName.toLowerCase().includes(term) ||
        (repo.description ?? "").toLowerCase().includes(term),
    );
  }, [query, repos]);

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
            {repos.length} repository · {current?.login}
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

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca un repository…"
          className="!pl-10"
        />
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
          <Link
            key={repo.id}
            href={`/repos/${repo.owner}/${repo.name}`}
            className="glass glass-hover group flex min-h-[152px] flex-col justify-between p-4"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-zinc-600">{repo.owner}</p>
                  <h2 className="truncate text-[15px] font-medium text-zinc-100">
                    {repo.name}
                  </h2>
                </div>
                <span className="mt-0.5 text-zinc-600">
                  {repo.private ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Globe className="h-3.5 w-3.5" />
                  )}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 min-h-[34px] text-[12.5px] leading-relaxed text-zinc-500">
                {repo.description || "Nessuna descrizione."}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
              <div className="flex items-center gap-3">
                {repo.language ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                    {repo.language}
                  </span>
                ) : null}
                {repo.stars > 0 ? (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {repo.stars}
                  </span>
                ) : null}
                <span>{timeAgo(repo.updatedAt)}</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
          </Link>
        ))}
      </div>

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
