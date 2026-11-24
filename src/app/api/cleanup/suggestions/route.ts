import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { deleteContent } from "@/lib/github";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const suggestions = await prisma.cleanupSuggestion.findMany({
    where: { userId: session.userId, status: "pending" },
    orderBy: [{ repo: "asc" }, { confidence: "desc" }],
    take: 300,
  });

  return NextResponse.json({
    suggestions: suggestions.map((item) => ({
      id: item.id,
      accountLogin: item.accountLogin,
      owner: item.owner,
      repo: item.repo,
      ref: item.ref,
      path: item.path,
      reason: item.reason,
      confidence: item.confidence,
      size: item.size,
      createdAt: item.createdAt.toISOString(),
    })),
    cronEnabled: Boolean(process.env.CRON_SECRET),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      id?: string;
      action?: "delete" | "dismiss";
      all?: boolean;
      owner?: string;
      repo?: string;
    };

    if (body.all) {
      const where = {
        userId: session.userId,
        status: "pending",
        ...(body.owner ? { owner: body.owner } : {}),
        ...(body.repo ? { repo: body.repo } : {}),
      };
      const result = await prisma.cleanupSuggestion.updateMany({
        where,
        data: { status: "dismissed" },
      });
      return NextResponse.json({ ok: true, updated: result.count });
    }

    if (!body.id) return NextResponse.json({ error: "id mancante." }, { status: 400 });

    const suggestion = await prisma.cleanupSuggestion.findFirst({
      where: { id: body.id, userId: session.userId, status: "pending" },
    });
    if (!suggestion) {
      return NextResponse.json({ error: "Proposta non trovata." }, { status: 404 });
    }

    if (body.action === "dismiss") {
      await prisma.cleanupSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "dismissed" },
      });
      return NextResponse.json({ ok: true, status: "dismissed" });
    }

    if (body.action === "delete") {
      const account = await resolveAccount(session.userId, suggestion.accountId);
      if (!account) {
        return NextResponse.json(
          { error: `L'account @${suggestion.accountLogin} non è più collegato.` },
          { status: 400 },
        );
      }

      await deleteContent(account.token, suggestion.owner, suggestion.repo, {
        path: suggestion.path,
        sha: suggestion.sha,
        message: `Pulizia: rimuovi ${suggestion.path}`,
        branch: suggestion.ref,
      });

      await prisma.cleanupSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "deleted" },
      });

      return NextResponse.json({ ok: true, status: "deleted" });
    }

    return NextResponse.json({ error: "Azione non valida." }, { status: 400 });
  } catch (error) {
    return handleError(error);
  }
}
