import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scanForUser } from "@/lib/cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const USER_BATCH = 12;
const TIME_BUDGET_MS = 45_000;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configurato: il cron è disattivato." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const bearer = req.headers.get("authorization");
  const authorized =
    bearer === `Bearer ${secret}` || url.searchParams.get("secret") === secret;

  if (!authorized) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  const startedAt = Date.now();
  const deadline = startedAt + TIME_BUDGET_MS;

  try {
    // Nessun filtro sui provider salvati: resolveAiConfig gestisce anche il
    // fallback via GEMINI_API_KEY di ambiente. Chi non ha AI viene saltato in fretta.
    const users = await prisma.user.findMany({
      select: { id: true, login: true },
      take: USER_BATCH,
      orderBy: { createdAt: "asc" },
    });

    const report: {
      user: string;
      accounts: string[];
      skipped?: string;
      results: unknown[];
    }[] = [];

    for (const user of users) {
      if (Date.now() > deadline) {
        report.push({ user: user.login, accounts: [], skipped: "deadline", results: [] });
        break;
      }

      try {
        const result = await scanForUser(user.id, {
          maxRepos: 2, // per account: con due account collegati finiscono in 4 repository
          maxFiles: 150,
          deadline,
        });
        report.push({
          user: user.login,
          accounts: result.accounts,
          skipped: result.skipped,
          results: result.results,
        });
      } catch (error) {
        report.push({
          user: user.login,
          accounts: [],
          skipped: error instanceof Error ? error.message : "errore",
          results: [],
        });
      }
    }

    const pending = await prisma.cleanupSuggestion.count({ where: { status: "pending" } });

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      users: report.length,
      pendingSuggestions: pending,
      report,
    });
  } catch (error) {
    console.error("[cron/cleanup]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore cron." },
      { status: 500 },
    );
  }
}
