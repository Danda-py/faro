import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { resolveAiConfig } from "@/lib/ai";
import { scanRepository } from "@/lib/cleanup";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      owner?: string;
      repo?: string;
      ref?: string;
    };

    if (!body.owner || !body.repo) {
      return NextResponse.json({ error: "owner e repo sono obbligatori." }, { status: 400 });
    }

    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    const config = await resolveAiConfig(session.userId);
    if (!config) {
      return NextResponse.json(
        { error: "Nessun provider AI configurato. Vai in Impostazioni → Assistente AI." },
        { status: 400 },
      );
    }

    const scan = await scanRepository({
      token: account.token,
      config,
      owner: body.owner,
      repo: body.repo,
      ref: body.ref,
    });

    return NextResponse.json({
      candidates: scan.candidates,
      notes: scan.notes,
      scanned: scan.scanned,
      truncated: scan.truncated,
      provider: { label: config.label, model: config.model },
    });
  } catch (error) {
    return handleError(error);
  }
}
