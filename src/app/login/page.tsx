import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Github } from "lucide-react";
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
      <div className="w-full max-w-[380px]">
        <Link href="/" className="flex items-baseline gap-3">
          <span className="font-mono text-[13px] tracking-[0.18em] text-paper">FARO</span>
          <span className="font-mono text-[10.5px] text-signal-500">accesso</span>
        </Link>

        <h1 className="mt-10 text-[24px] font-medium tracking-[-0.02em] text-paper">
          Accedi con GitHub
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-signal-300">
          Serve solo ad autorizzare il portale a leggere e scrivere sui tuoi repository. Nessuna
          password viene chiesta o salvata.
        </p>

        {message ? (
          <div className="mt-5 border-l border-rose-400/60 py-0.5 pl-3 text-[12.5px] leading-relaxed text-rose-200">
            {message}
          </div>
        ) : null}

        <Link
          href="/api/auth/github/start"
          className="group mt-6 flex h-10 w-full items-center justify-center gap-2 rounded bg-paper text-[13.5px] font-medium text-ink-950 transition-colors hover:bg-white"
        >
          <Github className="h-4 w-4" />
          Continua con GitHub
          <ArrowRight className="h-3.5 w-3.5 opacity-40 transition group-hover:opacity-70" />
        </Link>

        <div className="mt-8 border-t border-white/[0.07] pt-4">
          <p className="font-mono text-[10.5px] leading-relaxed text-signal-500">
            Il token GitHub viene cifrato sul server e usato solo per conto tuo.
          </p>
        </div>
      </div>
    </div>
  );
}
