"use client";

import { useEffect, useState } from "react";
import { Github, Link2, Plus, Star, Trash2 } from "lucide-react";
import { useAccount, type Account } from "@/components/account-provider";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export function AccountsView() {
  const { accounts, currentId, setCurrentId, refresh } = useAccount();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function patch(id: string, payload: { label?: string | null; isDefault?: boolean }) {
    setBusyId(id);
    setError("");
    try {
      await apiFetch("/api/accounts", {
        method: "PATCH",
        body: JSON.stringify({ id, ...payload }),
      });
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento fallito.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function remove(account: Account) {
    if (
      !window.confirm(
        `Scollegare @${account.login}? I repository resteranno su GitHub, ma perderai l'accesso da qui.`,
      )
    ) {
      return;
    }
    setBusyId(account.id);
    setError("");
    try {
      await apiFetch("/api/accounts", {
        method: "DELETE",
        body: JSON.stringify({ id: account.id }),
      });
      await refresh();
      setNotice("Account scollegato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rimozione fallita.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2">
      <header className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight">Account collegati</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Aggiungi più account GitHub — personale, scuola o lavoro — e passa da uno all&apos;altro
          senza rifare il login.
        </p>
      </header>

      <a
        href="/api/auth/github/start?mode=link&next=/accounts"
        className="glass glass-hover flex items-center justify-between gap-4 p-4"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
            <Plus className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-medium text-zinc-100">
              Collega un altro account
            </span>
            <span className="block text-[12px] text-zinc-500">
              Ti reindirizziamo su GitHub per autorizzare l&apos;accesso.
            </span>
          </span>
        </span>
        <Link2 className="h-4 w-4 text-zinc-500" />
      </a>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="space-y-3">
        {accounts.map((account) => {
          const isCurrent = account.id === currentId;
          const isEditing = editingId === account.id;
          return (
            <div
              key={account.id}
              className={cn(
                "glass p-4 transition",
                isCurrent && "border-violet-400/30 shadow-[0_0_50px_-24px_rgba(139,92,246,0.8)]",
              )}
            >
              <div className="flex flex-wrap items-start gap-3">
                {account.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={account.avatarUrl}
                    alt={account.login}
                    className="h-11 w-11 rounded-xl ring-1 ring-white/15"
                  />
                ) : (
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-xs">
                    {account.login.slice(0, 2).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      {account.label || account.login}
                    </p>
                    {account.isDefault ? (
                      <span className="chip !border-amber-400/25 !bg-amber-400/10 !text-amber-200">
                        <Star className="h-3 w-3" />
                        predefinito
                      </span>
                    ) : null}
                    {isCurrent ? (
                      <span className="chip !border-violet-400/25 !bg-violet-400/10 !text-violet-200">
                        attivo
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-zinc-500">
                    @{account.login}
                    {account.email ? ` · ${account.email}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {!isCurrent ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCurrentId(account.id);
                        setNotice(`Ora stai usando @${account.login}.`);
                      }}
                    >
                      Usa
                    </Button>
                  ) : null}
                  {!account.isDefault ? (
                    <Button
                      variant="subtle"
                      size="sm"
                      loading={busyId === account.id}
                      onClick={() => void patch(account.id, { isDefault: true })}
                      title="Imposta come predefinito"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => {
                      setEditingId(isEditing ? null : account.id);
                      setLabelDraft(account.label ?? "");
                    }}
                    title="Rinomina"
                  >
                    <Github className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    loading={busyId === account.id}
                    onClick={() => void remove(account)}
                    title="Scollega"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {isEditing ? (
                <form
                  className="mt-3 flex gap-2 border-t border-white/5 pt-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const ok = await patch(account.id, { label: labelDraft });
                    if (ok) {
                      setEditingId(null);
                      setNotice("Etichetta aggiornata.");
                    }
                  }}
                >
                  <Input
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    placeholder="Es. Scuola, Personale, Lavoro"
                    maxLength={40}
                    autoFocus
                  />
                  <Button type="submit" size="sm" loading={busyId === account.id}>
                    Salva
                  </Button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      {accounts.length === 0 ? (
        <div className="glass p-8 text-center">
          <Github className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
          <p className="text-sm text-zinc-400">Nessun account ancora collegato.</p>
        </div>
      ) : null}
    </div>
  );
}
