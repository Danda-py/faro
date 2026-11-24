import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { AiProviders } from "@/components/ai-providers";
import { GithubProfileSettings } from "@/components/github-profile-settings";

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

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <header className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="mt-1.5 text-sm text-zinc-500">
          Gestisci i provider AI e il tuo profilo GitHub.
        </p>
      </header>

      <AiProviders />

      <GithubProfileSettings />

      <section className="glass p-5">
        <h2 className="text-sm font-medium text-zinc-200">Profilo account</h2>
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

    </div>
  );
}
