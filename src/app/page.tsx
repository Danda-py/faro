import Link from "next/link";
import { redirect } from "next/navigation";
import { Github } from "lucide-react";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    label: "repository",
    title: "Tutti i tuoi repo",
    text: "Pubblici e privati, letti direttamente da GitHub. Niente copie locali da tenere allineate.",
  },
  {
    label: "file",
    title: "Modifica e commit",
    text: "Apri un file, correggilo, salvalo: ogni modifica è un commit sul branch che scegli.",
  },
  {
    label: "assistente",
    title: "AI quando serve",
    text: "Revisione di un file, pulizia dei doppioni, chat sul repository. Con la chiave che decidi tu.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8">
      <header className="flex items-center justify-between border-b border-white/[0.07] pb-5">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[13px] tracking-[0.18em] text-paper">FARO</span>
          <span className="font-mono text-[10.5px] text-signal-500">workspace github</span>
        </div>
        <Link
          href="/api/auth/github/start"
          className="inline-flex h-9 items-center gap-2 rounded border border-white/15 px-3.5 text-[12.5px] text-signal-200 transition-colors hover:border-white/30 hover:text-paper"
        >
          <Github className="h-3.5 w-3.5" />
          Accedi
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-16 py-16">
        <section className="max-w-2xl">
          <p className="font-mono text-[10.5px] text-signal-500">
            portale personale · uso scolastico
          </p>
          <h1 className="mt-4 text-[32px] font-medium leading-[1.15] tracking-[-0.02em] text-paper sm:text-[44px]">
            Repository, file e revisioni in un unico spazio di lavoro.
          </h1>
          <p className="mt-5 max-w-xl text-[14.5px] leading-relaxed text-signal-300">
            Faro prende i tuoi account GitHub e li mette in fila: un solo posto per leggere i
            repository, caricare una cartella, correggere un file e far pulire quello che non
            serve più.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/api/auth/github/start"
              className="inline-flex h-10 items-center gap-2 rounded bg-paper px-4 text-[13.5px] font-medium text-ink-950 transition-colors hover:bg-white"
            >
              <Github className="h-4 w-4" />
              Continua con GitHub
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded border border-white/15 px-4 text-[13.5px] text-signal-200 transition-colors hover:border-white/30 hover:text-paper"
            >
              Ho già un account
            </Link>
          </div>
        </section>

        <section className="grid gap-8 border-t border-white/[0.07] pt-8 sm:grid-cols-3 sm:gap-10">
          {FEATURES.map((feature) => (
            <div key={feature.label}>
              <p className="font-mono text-[10.5px] text-signal-500">{feature.label}</p>
              <h2 className="mt-2 text-[14px] font-medium text-paper">{feature.title}</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-signal-400">
                {feature.text}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="flex items-center justify-between border-t border-white/[0.07] py-5 font-mono text-[10.5px] text-signal-500">
        <span>Next.js · Neon · Vercel</span>
        <span>Faro</span>
      </footer>
    </div>
  );
}
