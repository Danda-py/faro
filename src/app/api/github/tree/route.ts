import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { getRepo, getTree, listBranches } from "@/lib/github";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX_ENTRIES = 4000;

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
