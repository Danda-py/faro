import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { AiProviders } from "@/components/ai-providers";
import { GithubProfileSettings } from "@/components/github-profile-settings";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        include: {
          _count: { select: { accounts: true } },
        },
      })
    : null;


  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <PageHeader
        eyebrow="Preferenze"
        title="Impostazioni"
        description="Gestisci i provider AI e il tuo profilo GitHub."
      />

      <AiProviders />

      <GithubProfileSettings />

      <section className="glass p-5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-zinc-100">Profilo account</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="panel p-3.5">
            <p className="label-base !text-[10px]">Utente</p>
            <p className="truncate text-sm text-zinc-200">@{user?.login ?? "—"}</p>
          </div>
          <div className="panel p-3.5">
            <p className="label-base !text-[10px]">Account GitHub</p>
            <p className="text-sm text-zinc-200">{user?._count.accounts ?? 0}</p>
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
