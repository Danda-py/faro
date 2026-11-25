"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  Eraser,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, PageHeader } from "@/components/ui";
import { cn, formatBytes } from "@/lib/utils";

type Suggestion = {
  id: string;
  accountLogin: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
  reason: string;
  confidence: number;
  size: number;
  createdAt: string;
};

export function CleanupView() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [cronEnabled, setCronEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ suggestions: Suggestion[]; cronEnabled: boolean }>(
        "/api/cleanup/suggestions",
      );
      setSuggestions(data.suggestions);
      setCronEnabled(data.cronEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento fallito.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const groups = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    for (const item of suggestions) {
      const key = `${item.owner}/${item.repo}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [suggestions]);

  async function runScan() {
    setScanning(true);
    setError("");
    setNotice("");
    try {
      const data = await apiFetch<{
        accounts: string[];
        results: { account: string; repo: string; candidates?: number; error?: string }[];
      }>("/api/cleanup/run", { method: "POST" });
      const found = data.results.reduce((sum, item) => sum + (item.candidates ?? 0), 0);
      const repos = data.results.filter((item) => item.repo !== "-").length;
      setNotice(
        `Scansione completata su ${data.accounts.length} account: ${found} proposte in ${repos} repository.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scansione fallita.");
    } finally {
      setScanning(false);
    }
  }

  async function act(suggestion: Suggestion, action: "delete" | "dismiss") {
    if (
      action === "delete" &&
      !window.confirm(
        `Eliminare ${suggestion.path} da ${suggestion.owner}/${suggestion.repo}? Verrà creato un commit.`,
      )
    ) {
      return;
    }
    setBusyId(suggestion.id);
    setError("");
    try {
      await apiFetch("/api/cleanup/suggestions", {
        method: "POST",
        body: JSON.stringify({ id: suggestion.id, action }),
      });
      setSuggestions((previous) => previous.filter((item) => item.id !== suggestion.id));
      setNotice(action === "delete" ? "File eliminato." : "Proposta ignorata.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione fallita.");
    } finally {
      setBusyId(null);
    }
  }

  async function dismissGroup(owner: string, repo: string) {
    setError("");
    try {
      await apiFetch("/api/cleanup/suggestions", {
        method: "POST",
        body: JSON.stringify({ all: true, owner, repo }),
      });
      await load();
      setNotice("Proposte del repository ignorate.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operazione fallita.");
    }
  }

  const totalSize = suggestions.reduce((sum, item) => sum + item.size, 0);
  const lastScan = suggestions.reduce<string | null>(
    (latest, item) => (!latest || item.createdAt > latest ? item.createdAt : latest),
    null,
  );

  return (
    <div className="space-y-5 py-2">
      <PageHeader
        eyebrow="Manutenzione"
        title="Pulizia repository"
        icon={<Eraser className="h-4 w-4" />}
        description="L'AI propone backup, duplicati e file inutilizzati. Nulla viene eliminato senza la tua conferma."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => void load()} loading={loading} aria-label="Aggiorna proposte">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={() => void runScan()} loading={scanning}>
              <Eraser className="h-3.5 w-3.5" />
              Scansiona ora
            </Button>
          </>
        }
      />

      <div className="glass flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-[12px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-violet-300" />
          {cronEnabled
            ? "Scansione automatica attiva: ogni giorno ~04:00 UTC su tutti gli account collegati"
            : "Scansione automatica disattivata: imposta CRON_SECRET su Vercel"}
        </span>
        <span className="text-zinc-600">·</span>
        <span>{suggestions.length} proposte in attesa</span>
        <span className="text-zinc-600">·</span>
        <span>{formatBytes(totalSize)} potenzialmente liberati</span>
        {lastScan ? (
          <>
            <span className="text-zinc-600">·</span>
            <span>ultima scansione {new Date(lastScan).toLocaleString("it-IT")}</span>
          </>
        ) : null}
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : null}

      {!loading && groups.length === 0 ? (
        <div className="glass p-10 text-center">
          <Eraser className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-300">Nessuna proposta in attesa.</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">
            Lancia una scansione manuale oppure attendi il cron notturno: le proposte
            compariranno qui.
          </p>
        </div>
      ) : null}

      {groups.map(([groupKey, items]) => (
        <section key={groupKey} className="glass overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-[13.5px] font-medium text-zinc-200">
                {groupKey}
              </h2>
              <p className="text-[11px] text-zinc-600">
                branch {items[0].ref} · {items.length} proposte
              </p>
            </div>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => void dismissGroup(items[0].owner, items[0].repo)}
            >
              <X className="h-3.5 w-3.5" />
              Ignora tutte
            </Button>
          </div>

          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-[12px] text-zinc-300">
                    {item.path}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    {item.reason} · {Math.round(item.confidence * 100)}% ·{" "}
                    {formatBytes(item.size)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === item.id}
                    onClick={() => void act(item, "dismiss")}
                    title="Ignora"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={busyId === item.id}
                    onClick={() => void act(item, "delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Elimina
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className={cn("text-[11px] text-zinc-600", groups.length === 0 && "text-center")}>
        Le proposte vengono rigenerate ad ogni scansione: se un file torna utile, ignorale.
      </p>
    </div>
  );
}
