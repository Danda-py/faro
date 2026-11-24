import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { AiProviders } from "@/components/ai-providers";
import { Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        include: {
          _count: { select: { accounts: true, messages: true, aiProviders: true } },
        },
      })
    : null;

  const pending =
    session
      ? await prisma.cleanupSuggestion.count({
          where: { userId: session.userId, status: "pending" },
        })
      : 0;

  const checks = [
    {
      label: "Database Neon",
      ok: Boolean(process.env.DATABASE_URL),
      detail: process.env.DATABASE_URL ? "DATABASE_URL configurata" : "DATABASE_URL mancante",
    },
    {
      label: "OAuth GitHub",
      ok: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      detail:
        process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
          ? "Client ID e secret configurati"
          : "Aggiungi GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET",
    },
    {
      label: "Assistente AI",
      ok: (user?._count.aiProviders ?? 0) > 0 || Boolean(process.env.GEMINI_API_KEY),
      detail:
        (user?._count.aiProviders ?? 0) > 0
          ? `${user?._count.aiProviders} provider configurati da te`
          : process.env.GEMINI_API_KEY
            ? "Nessun provider salvato: fallback su GEMINI_API_KEY"
            : "Aggiungi un provider qui sotto per attivare l'AI",
    },
    {
      label: "Pulizia schedulata",
      ok: Boolean(process.env.CRON_SECRET),
      detail: process.env.CRON_SECRET
        ? "Cron protetto e attivo (vedi vercel.json)"
        : "Imposta CRON_SECRET per abilitare il cron notturno",
    },
    {
      label: "Sessione sicura",
      ok: Boolean(process.env.AUTH_SECRET),
      detail: process.env.AUTH_SECRET
        ? "AUTH_SECRET presente (firma + cifratura chiavi)"
        : "AUTH_SECRET mancante: login e chiavi non funzionano",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <header className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Modelli AI, stato della configurazione e del tuo account.
        </p>
      </header>

      <AiProviders />

      <section className="glass p-5">
        <h2 className="text-sm font-medium text-zinc-200">Profilo</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
            <p className="label-base !text-[10px]">Utente</p>
            <p className="truncate text-sm text-zinc-200">@{user?.login ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
            <p className="label-base !text-[10px]">Account GitHub</p>
            <p className="text-sm text-zinc-200">{user?._count.accounts ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
            <p className="label-base !text-[10px]">Messaggi AI</p>
            <p className="text-sm text-zinc-200">{user?._count.messages ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
            <p className="label-base !text-[10px]">Pulizia in attesa</p>
            <p className="text-sm text-zinc-200">{pending}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs">
          <Link href="/accounts" className="text-violet-300 transition hover:text-violet-200">
            Gestisci gli account collegati →
          </Link>
          <Link href="/cleanup" className="text-violet-300 transition hover:text-violet-200">
            Proposte di pulizia →
          </Link>
        </div>
      </section>

      <section className="glass p-5">
        <h2 className="text-sm font-medium text-zinc-200">Ambiente</h2>
        <ul className="mt-4 space-y-2.5">
          {checks.map((check) => (
            <li
              key={check.label}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-3"
            >
              <span
                className={
                  check.ok
                    ? "grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-300"
                    : "grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 text-rose-300"
                }
              >
                {check.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-zinc-200">{check.label}</p>
                <p className="truncate text-[11.5px] text-zinc-500">{check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass p-5">
        <h2 className="text-sm font-medium text-zinc-200">Deploy su Vercel</h2>
        <ol className="mt-3 space-y-2 text-[13px] leading-relaxed text-zinc-500">
          <li>1. Su Vercel importa il repository e aggiungi le variabili di `.env.example`.</li>
          <li>
            2. Aggiorna la callback OAuth dell&apos;app GitHub in{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-violet-200">
              https://tuo-dominio/api/auth/github/callback
            </code>
            .
          </li>
          <li>
            3. Imposta{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-violet-200">
              NEXT_PUBLIC_APP_URL
            </code>{" "}
            e{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-violet-200">
              CRON_SECRET
            </code>{" "}
            (Vercel lo invia al cron come Bearer token).
          </li>
          <li>4. Esegui `npm run db:push` una volta per creare le tabelle su Neon.</li>
        </ol>
      </section>
    </div>
  );
}
