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
  // offline_access garantisce un refresh token anche se l'OAuth App non è
  // configurata per i token a scadenza: il token (8 ore) si rinnova da solo.
  authorize.searchParams.set("scope", "repo read:user user:email user offline_access");
  authorize.searchParams.set("state", state);
  if (mode === "link") {
    // GitHub riusa la sessione del browser: senza prompt=select_account chi
    // aggiunge un secondo account verrebbe riportato sullo stesso profilo.
    authorize.searchParams.set("prompt", "select_account");
  }

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
