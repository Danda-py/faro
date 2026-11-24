import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encryptToken } from "@/lib/crypto";
import { getUser, getUserEmails } from "@/lib/github";
import { sessionCookieOptions, signSession, SESSION_COOKIE } from "@/lib/session";
import { appOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OAuthState = {
  state: string;
  mode: "login" | "link";
  next: string;
  userId?: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = appOrigin(req);

  const fail = (reason: string) => {
    const res = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(reason)}`, origin),
    );
    res.cookies.delete("oauth_state");
    return res;
  };

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = (await cookies()).get("oauth_state")?.value;

  if (!code || !state || !storedState) return fail("missing_code");

  let parsed: OAuthState;
  try {
    parsed = JSON.parse(Buffer.from(storedState, "base64url").toString("utf8")) as OAuthState;
  } catch {
    return fail("bad_state");
  }
  if (parsed.state !== state) return fail("state_mismatch");

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("oauth_not_configured");

  let accessToken: string | undefined;
  let scope: string | undefined;

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${origin}/api/auth/github/callback`,
      }),
      cache: "no-store",
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      scope?: string;
      error_description?: string;
    };
    accessToken = tokenJson.access_token;
    scope = tokenJson.scope;
    if (!accessToken) return fail(tokenJson.error_description || "token_exchange");
  } catch {
    return fail("token_exchange");
  }

  const [ghUser, emails] = await Promise.all([
    getUser(accessToken),
    getUserEmails(accessToken),
  ]);

  const githubId = String(ghUser.id);
  const email =
    ghUser.email ?? emails.find((item) => item.primary && item.verified)?.email ?? null;

  const accountData = {
    githubId,
    login: ghUser.login,
    name: ghUser.name,
    avatarUrl: ghUser.avatar_url,
    email,
    tokenCipher: encryptToken(accessToken),
    scope: scope ?? null,
  };

  let userId = parsed.mode === "link" ? parsed.userId ?? null : null;

  try {
    if (userId) {
      await prisma.githubAccount.upsert({
        where: { userId_githubId: { userId, githubId } },
        create: { userId, ...accountData },
        update: {
          login: accountData.login,
          name: accountData.name,
          avatarUrl: accountData.avatarUrl,
          email: accountData.email,
          tokenCipher: accountData.tokenCipher,
          scope: accountData.scope,
        },
      });
    } else {
      const existing = await prisma.githubAccount.findFirst({ where: { githubId } });
      if (existing) {
        userId = existing.userId;
        await prisma.githubAccount.update({
          where: { id: existing.id },
          data: {
            login: accountData.login,
            name: accountData.name,
            avatarUrl: accountData.avatarUrl,
            email: accountData.email,
            tokenCipher: accountData.tokenCipher,
            scope: accountData.scope,
          },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { login: accountData.login, name: accountData.name, avatarUrl: accountData.avatarUrl },
        });
      } else {
        const user = await prisma.user.create({
          data: {
            primaryGithubId: githubId,
            login: accountData.login,
            name: accountData.name,
            email,
            avatarUrl: accountData.avatarUrl,
            accounts: { create: { ...accountData } },
          },
        });
        userId = user.id;
      }
    }

    const total = await prisma.githubAccount.count({ where: { userId } });
    const withDefault = await prisma.githubAccount.count({
      where: { userId, isDefault: true },
    });
    if (total > 0 && withDefault === 0) {
      const first = await prisma.githubAccount.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });
      if (first) {
        await prisma.githubAccount.update({
          where: { id: first.id },
          data: { isDefault: true },
        });
      }
    }
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    console.error("[auth] persist failed", { code, name: error instanceof Error ? error.name : "unknown" });

    if (code === "P2021" || code === "P2022") return fail("database_schema");
    if (code === "P1000") return fail("database_auth");
    if (code === "P1001" || code === "P1002" || code === "P1017") {
      return fail("database_connection");
    }
    return fail("db_error");
  }

  if (!userId) return fail("unknown_user");

  const token = await signSession(userId);
  const target = parsed.next.startsWith("/") ? parsed.next : "/dashboard";
  const res = NextResponse.redirect(new URL(target, origin));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  res.cookies.delete("oauth_state");
  return res;
}
