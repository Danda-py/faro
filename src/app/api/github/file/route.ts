import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import {
  decodeContent,
  deleteContent,
  getContent,
  isProbablyBinary,
  putContent,
  rawBuffer,
} from "@/lib/github";
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
      return NextResponse.json(
        { error: "owner, repo e path sono obbligatori." },
        { status: 400 },
      );
    }

    const account = await resolveAccount(session.userId, params.get("accountId"));
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    const content = await getContent(account.token, owner, repo, path, ref);

    if (Array.isArray(content) || content.type !== "file") {
      return NextResponse.json({ error: "Il percorso non è un file." }, { status: 400 });
    }

    const buffer = rawBuffer(content);
    const binary = isProbablyBinary(path, buffer);

    return NextResponse.json({
      path: content.path,
      sha: content.sha,
      size: content.size,
      binary,
      content: binary ? "" : decodeContent(content),
      downloadUrl: content.download_url,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      owner?: string;
      repo?: string;
      path?: string;
      content?: string;
      message?: string;
      branch?: string;
      sha?: string;
    };

    if (!body.owner || !body.repo || !body.path || typeof body.content !== "string") {
      return NextResponse.json({ error: "Dati incompleti." }, { status: 400 });
    }

    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    const result = await putContent(account.token, body.owner, body.repo, {
      path: body.path,
      content: body.content,
      message: body.message?.trim() || `Aggiorna ${body.path}`,
      branch: body.branch,
      sha: body.sha,
    });

    return NextResponse.json({
      ok: true,
      sha: result.content.sha,
      commit: result.commit.sha,
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      owner?: string;
      repo?: string;
      path?: string;
      sha?: string;
      message?: string;
      branch?: string;
    };

    if (!body.owner || !body.repo || !body.path || !body.sha) {
      return NextResponse.json({ error: "Dati incompleti." }, { status: 400 });
    }

    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    await deleteContent(account.token, body.owner, body.repo, {
      path: body.path,
      sha: body.sha,
      message: body.message?.trim() || `Elimina ${body.path}`,
      branch: body.branch,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
