import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { searchCode } from "@/lib/github";
import { badRequest, handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const params = new URL(req.url).searchParams;
  const owner = params.get("owner")?.trim();
  const repo = params.get("repo")?.trim();
  const term = params.get("q")?.trim();

  if (!owner || !repo) return badRequest("owner e repo sono obbligatori.");
  if (!term || term.length < 2) return badRequest("Scrivi almeno 2 caratteri da cercare.");

  try {
    const account = await resolveAccount(session.userId, params.get("accountId"));
    if (!account) {
      return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });
    }

    const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
    const result = await searchCode(account.token, owner, repo, term, page);
    return NextResponse.json({ term, ...result });
  } catch (error) {
    return handleError(error);
  }
}
