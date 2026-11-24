import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { scanForUser } from "@/lib/cleanup";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const result = await scanForUser(session.userId, {
      maxRepos: 2, // per account collegato
      maxFiles: 150,
      deadline: Date.now() + 45_000,
    });

    if (result.skipped === "no-ai") {
      return NextResponse.json(
        { error: "Nessun provider AI configurato. Vai in Impostazioni → Assistente AI." },
        { status: 400 },
      );
    }
    if (result.skipped === "no-account") {
      return NextResponse.json({ error: "Nessun account GitHub collegato." }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
