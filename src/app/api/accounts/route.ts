import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { publicAccount, resolveAccount } from "@/lib/accounts";
import { getUser, updateGithubProfile } from "@/lib/github";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const accounts = await prisma.githubAccount.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  const params = new URL(req.url).searchParams;
  const profileAccountId = params.get("profile");
  if (!profileAccountId) {
    return NextResponse.json({ accounts: accounts.map(publicAccount) });
  }

  try {
    const account = await resolveAccount(session.userId, profileAccountId);
    if (!account) return NextResponse.json({ error: "Account non trovato." }, { status: 404 });
    const profile = await getUser(account.token);
    return NextResponse.json({
      profile: {
        login: profile.login,
        name: profile.name ?? "",
        bio: profile.bio ?? "",
        company: profile.company ?? "",
        location: profile.location ?? "",
        blog: profile.blog ?? "",
        twitter_username: profile.twitter_username ?? "",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      id?: string;
      label?: string | null;
      isDefault?: boolean;
      profile?: {
        name?: string;
        bio?: string;
        company?: string;
        location?: string;
        blog?: string;
        twitter_username?: string;
      };
    };
    if (!body.id) return NextResponse.json({ error: "id mancante." }, { status: 400 });

    const account = await prisma.githubAccount.findFirst({
      where: { id: body.id, userId: session.userId },
    });
    if (!account) return NextResponse.json({ error: "Account non trovato." }, { status: 404 });

    if (body.profile) {
      const accountWithToken = await resolveAccount(session.userId, account.id);
      if (!accountWithToken) return NextResponse.json({ error: "Account non trovato." }, { status: 404 });
      if (!account.scope?.split(/[\\s,]+/).includes("user")) {
        return NextResponse.json(
          { error: "Questo account non ha autorizzato il permesso GitHub user. Ricollega l'account per modificare il profilo." },
          { status: 403 },
        );
      }
      const profile = body.profile;
      const lengths: Record<string, number> = {
        name: 255,
        bio: 160,
        company: 255,
        location: 255,
        blog: 255,
        twitter_username: 39,
      };
      for (const [field, limit] of Object.entries(lengths)) {
        const value = profile[field as keyof typeof profile];
        if (value !== undefined && typeof value !== "string") {
          return NextResponse.json({ error: `Il campo ${field} deve essere un testo.` }, { status: 400 });
        }
        if (value !== undefined && value.length > limit) {
          return NextResponse.json({ error: `${field} supera il limite di ${limit} caratteri.` }, { status: 400 });
        }
      }
      const updatedProfile = await updateGithubProfile(accountWithToken.token, {
        ...(profile.name !== undefined ? { name: profile.name.trim() || null } : {}),
        ...(profile.bio !== undefined ? { bio: profile.bio.trim() || null } : {}),
        ...(profile.company !== undefined ? { company: profile.company.trim() || null } : {}),
        ...(profile.location !== undefined ? { location: profile.location.trim() || null } : {}),
        ...(profile.blog !== undefined ? { blog: profile.blog.trim() || null } : {}),
        ...(profile.twitter_username !== undefined
          ? { twitter_username: profile.twitter_username.trim().replace(/^@/, "") || null }
          : {}),
      });
      await prisma.githubAccount.update({
        where: { id: account.id },
        data: {
          name: updatedProfile.name,
          avatarUrl: updatedProfile.avatar_url,
          email: updatedProfile.email,
        },
      });
      const owner = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { primaryGithubId: true },
      });
      if (owner?.primaryGithubId === account.githubId) {
        await prisma.user.update({
          where: { id: session.userId },
          data: {
            name: updatedProfile.name,
            avatarUrl: updatedProfile.avatar_url,
            email: updatedProfile.email,
          },
        });
      }
      return NextResponse.json({ profile: updatedProfile });
    }

    if (body.isDefault) {
      await prisma.githubAccount.updateMany({
        where: { userId: session.userId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.githubAccount.update({
      where: { id: account.id },
      data: {
        ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      },
    });

    return NextResponse.json({ account: publicAccount(updated) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as { id?: string };
    if (!body.id) return NextResponse.json({ error: "id mancante." }, { status: 400 });

    const account = await prisma.githubAccount.findFirst({
      where: { id: body.id, userId: session.userId },
    });
    if (!account) return NextResponse.json({ error: "Account non trovato." }, { status: 404 });

    await prisma.githubAccount.delete({ where: { id: account.id } });

    const remaining = await prisma.githubAccount.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
    });

    if (account.isDefault && remaining[0]) {
      await prisma.githubAccount.update({
        where: { id: remaining[0].id },
        data: { isDefault: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
