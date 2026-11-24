import { NextResponse } from "next/server";
import { GithubError } from "@/lib/github";
import { AiError } from "@/lib/ai";

export function unauthorized() {
  return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function handleError(error: unknown) {
  if (error instanceof GithubError) {
    const status = error.status === 401 || error.status === 403 ? error.status : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof AiError) {
    const status = error.status >= 500 ? 503 : error.status;
    return NextResponse.json({ error: error.message, provider: error.provider }, { status });
  }
  console.error("[api]", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Errore inatteso." },
    { status: 500 },
  );
}

export function searchParams(req: Request) {
  return new URL(req.url).searchParams;
}

export function appOrigin(req: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}
