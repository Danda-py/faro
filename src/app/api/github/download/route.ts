import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { getContent, rawBuffer } from "@/lib/github";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const params = new URL(req.url).searchParams;
    const owner = params.get("owner");
    const repo = params.get("repo");
    const path = params.get("path");
    const ref = params.get("ref") || undefined;

    if (!owner || !repo || !path) {
      return NextResponse.json({ error: "Dati incompleti." }, { status: 400 });
    }

    const account = await resolveAccount(session.userId, params.get("accountId"));
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    const content = await getContent(account.token, owner, repo, path, ref);
    if (Array.isArray(content) || content.type !== "file") {
      return NextResponse.json({ error: "Il percorso non è un file." }, { status: 400 });
    }

    const buffer = rawBuffer(content);
    const fileName = path.split("/").pop() || "file";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
