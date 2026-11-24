import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { publicAccount } from "@/lib/accounts";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const accounts = await prisma.githubAccount.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ accounts: accounts.map(publicAccount) });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      id?: string;
      label?: string | null;
      isDefault?: boolean;
    };
    if (!body.id) return NextResponse.json({ error: "id mancante." }, { status: 400 });

    const account = await prisma.githubAccount.findFirst({
      where: { id: body.id, userId: session.userId },
    });
    if (!account) return NextResponse.json({ error: "Account non trovato." }, { status: 404 });

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
