import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { listRepos } from "@/lib/github";
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

    return NextResponse.json({
      account: { id: account.id, login: account.login },
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
