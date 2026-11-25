import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Github, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  missing_code: "GitHub non ha restituito il codice di autorizzazione. Riprova.",
  bad_state: "Sessione OAuth non valida. Riprova.",
  state_mismatch: "Verifica di sicurezza fallita. Riprova.",
  token_exchange: "Scambio del token fallito. Controlla le credenziali OAuth.",
  oauth_not_configured: "OAuth GitHub non configurato sul server.",
  database_schema:
    "Il database Faro non ha ancora lo schema aggiornato. Dal terminale del progetto esegui `npm run db:push`, poi riprova.",
  database_auth:
    "Neon ha rifiutato le credenziali del database. Controlla DATABASE_URL e DIRECT_URL; se la password è stata condivisa, ruotala prima.",
  database_connection:
    "Il server Faro non riesce a raggiungere Neon. Verifica DATABASE_URL, DIRECT_URL e che il database sia attivo.",
  db_error: "Impossibile salvare l'account sul database. Controlla i log server per il codice Prisma.",
  unknown_user: "Impossibile identificare l'utente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const { error } = await searchParams;
  const message = error ? ERRORS[error] ?? "Accesso non riuscito. Riprova." : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]"
      />

      <div className="relative w-full max-w-[420px] animate-fade-up">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-300 via-indigo-400 to-cyan-300 text-slate-950 shadow-[0_14px_36px_-14px_rgba(129,140,248,0.95),inset_0_1px_0_rgba(255,255,255,0.45)]">
            <Github className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-zinc-50">
            Faro<span className="text-violet-400">.</span>
          </span>
        </Link>

        <div className="glass p-7 sm:p-8">
          <p className="eyebrow text-center">Accesso privato</p>
          <h1 className="mt-2 text-center text-[22px] font-semibold tracking-[-0.02em] text-zinc-50">
            Bentornato
          </h1>
          <p className="mx-auto mt-2 max-w-[300px] text-center text-[13px] leading-relaxed text-zinc-500">
            Accedi con GitHub per entrare nel tuo spazio di lavoro.
          </p>

          {message ? (
            <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/[0.08] px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-100">
              {message}
            </div>
          ) : null}

          <Link
            href="/api/auth/github/start"
            className="group mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-indigo-300/25 bg-gradient-to-b from-indigo-500 to-indigo-600 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_16px_40px_-20px_rgba(99,102,241,1)] transition duration-200 hover:from-indigo-400 hover:to-indigo-500"
          >
            <Github className="h-4 w-4" />
            Continua con GitHub
            <ArrowRight className="h-3.5 w-3.5 opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </Link>

          <div className="mt-6 border-t border-white/[0.07] pt-4">
            <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-zinc-600">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
              Il token GitHub viene cifrato sul server e usato solo per conto tuo. Nessuna
              password viene salvata.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
          Con l&apos;accesso accetti di collegare il tuo account GitHub a questo portale privato.
        </p>
      </div>
    </div>
  );
}
