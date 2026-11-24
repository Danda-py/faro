import Link from "next/link";
import { redirect } from "next/navigation";
import { Github, ShieldCheck } from "lucide-react";
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
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-slate-950 shadow-glow">
            <Github className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Faro<span className="text-violet-400">.</span>
          </span>
        </Link>

        <div className="glass p-7">
          <h1 className="text-center text-xl font-semibold tracking-tight">Bentornato</h1>
          <p className="mt-2 text-center text-sm text-zinc-500">
            Accedi con GitHub per entrare nel tuo spazio di lavoro.
          </p>

          {message ? (
            <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
              {message}
            </div>
          ) : null}

          <Link
            href="/api/auth/github/start"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-sm font-medium text-white shadow-[0_14px_42px_-20px_rgba(99,102,241,0.9)] transition hover:brightness-110"
          >
            <Github className="h-4 w-4" />
            Continua con GitHub
          </Link>

          <p className="mt-5 flex items-start gap-2 text-[11.5px] leading-relaxed text-zinc-600">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
            Il token GitHub viene cifrato sul server e usato solo per conto tuo. Nessuna
            password viene salvata.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Con l&apos;accesso accetti di collegare il tuo account GitHub a questo portale privato.
        </p>
      </div>
    </div>
  );
}
