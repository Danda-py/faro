"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Github, Save } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { Alert, Button, Input } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/client-api";

type Profile = {
  login: string;
  name: string;
  bio: string;
  company: string;
  location: string;
  blog: string;
  twitter_username: string;
};

const emptyProfile: Profile = {
  login: "",
  name: "",
  bio: "",
  company: "",
  location: "",
  blog: "",
  twitter_username: "",
};

export function GithubProfileSettings() {
  const { accounts, current, refresh } = useAccount();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(current?.id ?? null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reauthorize, setReauthorize] = useState(false);
  const [saved, setSaved] = useState(false);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? current;
  const hasProfileWriteScope = selectedAccount?.scope?.split(/[\\s,]+/).includes("user") ?? false;

  useEffect(() => {
    setSelectedAccountId(current?.id ?? null);
  }, [current?.id]);

  useEffect(() => {
    let active = true;
    if (!selectedAccount) {
      setProfile(emptyProfile);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setReauthorize(false);
    setSaved(false);
    const params = new URLSearchParams({ profile: selectedAccount.id });
    apiFetch<{ profile: Profile }>(`/api/accounts?${params.toString()}`)
      .then((data) => {
        if (active) setProfile(data.profile);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Caricamento del profilo fallito.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedAccount?.id]);

  function update(field: keyof Omit<Profile, "login">, value: string) {
    setSaved(false);
    setProfile((previous) => ({ ...previous, [field]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) return;
    setSaving(true);
    setError("");
    setReauthorize(false);
    setSaved(false);
    try {
      const data = await apiFetch<{ profile: Profile }>("/api/accounts", {
        method: "PATCH",
        body: JSON.stringify({
          id: selectedAccount.id,
          profile: {
            name: profile.name,
            bio: profile.bio,
            company: profile.company,
            location: profile.location,
            blog: profile.blog,
            twitter_username: profile.twitter_username,
          },
        }),
      });
      setProfile(data.profile);
      await refresh();
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError("GitHub ha rifiutato la modifica: il token potrebbe non avere il permesso profilo necessario oppure essere scaduto.");
        setReauthorize(true);
      } else {
        setError(err instanceof Error ? err.message : "Salvataggio del profilo fallito.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="glass p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
          <Github className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Profilo GitHub</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Modifica le informazioni pubbliche del profilo selezionato direttamente su GitHub.
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-zinc-500">
          Collega un account GitHub per modificare il profilo.
        </p>
      ) : (
        <form onSubmit={save} className="mt-5 space-y-4">
          {accounts.length > 1 ? (
            <label className="label-base block max-w-sm">
              Account da modificare
              <select
                className="input-base mt-1.5"
                value={selectedAccount?.id ?? ""}
                onChange={(event) => setSelectedAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label ? `${account.label} · ` : ""}@{account.login}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {selectedAccount && !hasProfileWriteScope ? (
            <Alert>
              Questo account non risulta autorizzato a modificare il profilo. Ricollegalo per concedere il permesso GitHub <code>user</code>.
              <Link href={`/api/auth/github/start?mode=link&next=${encodeURIComponent("/settings")}`} className="ml-1 font-medium text-violet-200 underline decoration-violet-300/40 underline-offset-2 hover:text-violet-100">
                Ricollega @{selectedAccount.login}
              </Link>
            </Alert>
          ) : null}
          {error ? (
            <Alert>
              {error}
              {reauthorize && selectedAccount ? (
                <Link href={`/api/auth/github/start?mode=link&next=${encodeURIComponent("/settings")}`} className="ml-1 font-medium text-violet-200 underline decoration-violet-300/40 underline-offset-2 hover:text-violet-100">
                  Ricollega @{selectedAccount.login}
                </Link>
              ) : null}
            </Alert>
          ) : null}
          {saved ? <Alert tone="success">Profilo GitHub aggiornato.</Alert> : null}
          {loading ? <p className="text-xs text-zinc-500">Caricamento profilo…</p> : null}
          {selectedAccount ? (
            <a href={`https://github.com/${encodeURIComponent(selectedAccount.login)}`} target="_blank" rel="noopener noreferrer" className="inline-flex text-xs text-violet-300 transition hover:text-violet-200">
              Apri il profilo @{selectedAccount.login} su GitHub ↗
            </a>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label-base">
              Nome visualizzato
              <Input className="mt-1.5" value={profile.name} onChange={(event) => update("name", event.target.value)} maxLength={255} disabled={loading} />
            </label>
            <label className="label-base">
              Azienda
              <Input className="mt-1.5" value={profile.company} onChange={(event) => update("company", event.target.value)} maxLength={255} disabled={loading} />
            </label>
            <label className="label-base">
              Località
              <Input className="mt-1.5" value={profile.location} onChange={(event) => update("location", event.target.value)} maxLength={255} disabled={loading} />
            </label>
            <label className="label-base">
              Sito web
              <Input className="mt-1.5" value={profile.blog} onChange={(event) => update("blog", event.target.value)} maxLength={255} placeholder="https://…" disabled={loading} />
            </label>
            <label className="label-base sm:col-span-2">
              Bio
              <textarea className="input-base mt-1.5 min-h-24 resize-y" value={profile.bio} onChange={(event) => update("bio", event.target.value)} maxLength={160} disabled={loading} />
              <span className="mt-1 block text-right text-[10px] text-zinc-600">{profile.bio.length}/160</span>
            </label>
            <label className="label-base">
              Username X
              <Input className="mt-1.5" value={profile.twitter_username} onChange={(event) => update("twitter_username", event.target.value)} maxLength={39} placeholder="username" disabled={loading} />
            </label>
            <div className="flex items-end justify-end">
              <Button type="submit" loading={saving} disabled={loading || !profile.login}>
                {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                Salva profilo
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-zinc-600">Lo username GitHub non è modificabile da qui; cambialo nelle impostazioni GitHub.</p>
        </form>
      )}
    </section>
  );
}
