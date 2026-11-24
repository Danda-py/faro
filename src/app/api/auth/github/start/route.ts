import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSession } from "@/lib/session";
import { appOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "link" ? "link" : "login";
  const rawNext = url.searchParams.get("next") || "/dashboard";
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID non configurato. Aggiungilo in .env.local." },
      { status: 500 },
    );
  }

  let userId: string | null = null;
  if (mode === "link") {
    const session = await getSession();
    if (!session) return NextResponse.redirect(new URL("/login", appOrigin(req)));
    userId = session.userId;
  }

  const state = crypto.randomUUID();
  const payload = Buffer.from(JSON.stringify({ state, mode, next, userId })).toString(
    "base64url",
  );

  const redirectUri = `${appOrigin(req)}/api/auth/github/callback`;
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "repo read:user user:email user");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set("oauth_state", payload, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
