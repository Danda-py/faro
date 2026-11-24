import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { deleteRepo, listRepos, updateRepo } from "@/lib/github";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const params = new URL(req.url).searchParams;
    const account = await resolveAccount(session.userId, params.get("accountId"));
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
    const repos = await listRepos(account.token, page);
    const hidden = await prisma.githubRepoPreference.findMany({
      where: { accountId: account.id, hidden: true },
      select: { repoId: true },
    });

    return NextResponse.json({
      account: { id: account.id, login: account.login },
      hiddenRepoIds: hidden.map((item) => item.repoId),
      page,
      hasMore: repos.length === 100,
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        archived: repo.archived,
        fork: repo.fork,
        description: repo.description,
        defaultBranch: repo.default_branch,
        language: repo.language,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      repoId?: number;
      owner?: string;
      repo?: string;
      hidden?: boolean;
    };
    if (!body.accountId || !Number.isInteger(body.repoId) || !body.owner || !body.repo || typeof body.hidden !== "boolean") {
      return NextResponse.json({ error: "Dati repository non validi." }, { status: 400 });
    }
    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Account GitHub non trovato." }, { status: 404 });

    await prisma.githubRepoPreference.upsert({
      where: { accountId_repoId: { accountId: account.id, repoId: body.repoId! } },
      create: {
        accountId: account.id,
        repoId: body.repoId!,
        owner: body.owner,
        repo: body.repo,
        hidden: body.hidden,
      },
      update: { owner: body.owner, repo: body.repo, hidden: body.hidden },
    });
    return NextResponse.json({ ok: true, hidden: body.hidden });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      owner?: string;
      repo?: string;
      name?: string;
      description?: string | null;
      private?: boolean;
      archived?: boolean;
    };
    if (!body.accountId || !body.owner || !body.repo) {
      return NextResponse.json({ error: "accountId, owner e repo sono obbligatori." }, { status: 400 });
    }
    if (body.name !== undefined && (!body.name.trim() || body.name.length > 100)) {
      return NextResponse.json({ error: "Il nome deve contenere da 1 a 100 caratteri." }, { status: 400 });
    }
    if (body.description !== undefined && (body.description?.length ?? 0) > 350) {
      return NextResponse.json({ error: "La descrizione non può superare 350 caratteri." }, { status: 400 });
    }
    const patch: { name?: string; description?: string | null; private?: boolean; archived?: boolean } = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.description !== undefined) patch.description = body.description?.trim() || null;
    if (typeof body.private === "boolean") patch.private = body.private;
    if (typeof body.archived === "boolean") patch.archived = body.archived;
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nessuna proprietà da aggiornare." }, { status: 400 });
    }

    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Account GitHub non trovato." }, { status: 404 });
    const repo = await updateRepo(account.token, body.owner, body.repo, patch);
    return NextResponse.json({
      repo: {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        archived: repo.archived,
        fork: repo.fork,
        description: repo.description,
        defaultBranch: repo.default_branch,
        language: repo.language,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as { accountId?: string; owner?: string; repo?: string };
    if (!body.accountId || !body.owner || !body.repo) {
      return NextResponse.json({ error: "accountId, owner e repo sono obbligatori." }, { status: 400 });
    }
    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Account GitHub non trovato." }, { status: 404 });
    await deleteRepo(account.token, body.owner, body.repo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
