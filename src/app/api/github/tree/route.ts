import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { resolveAccount } from "@/lib/accounts";
import { getRepo, getTree, listBranches, moveOrDeleteFolder } from "@/lib/github";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 4000;

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      owner?: string;
      repo?: string;
      branch?: string;
      sourcePath?: string;
      destinationPath?: string;
      action?: "move" | "delete";
    };
    if (!body.owner || !body.repo || !body.branch || !body.sourcePath || !body.action) {
      return NextResponse.json({ error: "Dati della cartella incompleti." }, { status: 400 });
    }
    if (body.action === "move" && !body.destinationPath?.trim()) {
      return NextResponse.json({ error: "Indica il nuovo percorso della cartella." }, { status: 400 });
    }
    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });
    const result = await moveOrDeleteFolder(account.token, body.owner, body.repo, {
      branch: body.branch,
      sourcePath: body.sourcePath,
      ...(body.action === "move" ? { destinationPath: body.destinationPath } : {}),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const params = new URL(req.url).searchParams;
    const owner = params.get("owner");
    const repo = params.get("repo");
    const ref = params.get("ref") || undefined;
    if (!owner || !repo) {
      return NextResponse.json({ error: "owner e repo sono obbligatori." }, { status: 400 });
    }

    const account = await resolveAccount(session.userId, params.get("accountId"));
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    const [repoInfo, branches] = await Promise.all([
      getRepo(account.token, owner, repo),
      listBranches(account.token, owner, repo).catch(() => []),
    ]);

    const tree = await getTree(
      account.token,
      owner,
      repo,
      ref || repoInfo.default_branch,
    );

    // "Repository aperto di recente" è un extra: se il database non risponde
    // non deve impedire l'apertura del repository.
    try {
      await prisma.githubRepoPreference.upsert({
        where: { accountId_repoId: { accountId: account.id, repoId: repoInfo.id } },
        create: { accountId: account.id, repoId: repoInfo.id, owner: repoInfo.owner.login, repo: repoInfo.name, hidden: false, lastOpenedAt: new Date() },
        update: { owner: repoInfo.owner.login, repo: repoInfo.name, lastOpenedAt: new Date() },
      });
    } catch (error) {
      console.error("[github/tree] preferenze non disponibili", error);
    }

    const blobs = tree.tree
      .filter((entry) => entry.type === "blob")
      .slice(0, MAX_ENTRIES)
      .map((entry) => ({ path: entry.path, size: entry.size ?? 0, sha: entry.sha }));

    return NextResponse.json({
      repo: {
        name: repoInfo.name,
        owner: repoInfo.owner.login,
        fullName: repoInfo.full_name,
        private: repoInfo.private,
        defaultBranch: repoInfo.default_branch,
        description: repoInfo.description,
      },
      branches: branches.map((branch) => branch.name),
      truncated: tree.truncated || tree.tree.length > MAX_ENTRIES,
      tree: blobs,
    });
  } catch (error) {
    return handleError(error);
  }
}
