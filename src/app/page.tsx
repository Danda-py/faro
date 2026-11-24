import Link from "next/link";
import { redirect } from "next/navigation";
import { Github, FolderGit2, Sparkles, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: FolderGit2,
    title: "Tutti i tuoi repository",
    text: "Sfoglia, cerca, apri e modifica i file dei tuoi repo — pubblici e privati — da un'unica vista.",
  },
  {
    icon: Sparkles,
    title: "AI al tuo fianco",
    text: "Correzioni guidate, refactor e pulizia dei file inutilizzati direttamente sul repository.",
  },
  {
    icon: ShieldCheck,
    title: "Account separati",
    text: "Collega gli account personale e scolastico: cambi contesto con un clic, senza logout.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-300 text-slate-950 shadow-glow">
            <Github className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Faro<span className="text-violet-400">.</span>
          </span>
        </div>
        <Link
          href="/api/auth/github/start"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08]"
        >
          <Github className="h-4 w-4" />
          Accedi
        </Link>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-12 py-16">
        <section className="animate-fade-up text-center">
          <span className="chip mx-auto mb-6 flex w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Personale · pronto per la scuola
          </span>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            Il tuo GitHub, <span className="gradient-text">in un unico posto</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-zinc-400">
            Un portale minimale per gestire repository, caricare e correggere file, e far
            ripulire tutto da un'AI. Con più account collegati e lo stesso spazio di lavoro.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/api/auth/github/start"
              className="inline-flex h-12 items-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 text-sm font-medium text-white shadow-[0_14px_42px_-20px_rgba(99,102,241,0.9)] transition hover:brightness-110"
            >
              <Github className="h-4 w-4" />
              Continua con GitHub
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-6 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Ho già un account
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass glass-hover animate-fade-up p-5 [animation-delay:120ms]"
            >
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
                <feature.icon className="h-5 w-5" />
              </span>
              <h2 className="text-sm font-medium text-zinc-100">{feature.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{feature.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-white/[0.07] py-6 text-center text-xs text-zinc-600">
        Costruito con Next.js, Neon e AI · deploy su Vercel
      </footer>
    </div>
  );
}
