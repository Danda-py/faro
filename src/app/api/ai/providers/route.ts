import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";
import { AI_KINDS, PROVIDER_DEFAULTS, isAiKind } from "@/lib/ai";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const providers = await prisma.aiProvider.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    providers: providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      model: provider.model,
      isDefault: provider.isDefault,
      hasKey: Boolean(provider.apiKeyCipher),
      createdAt: provider.createdAt.toISOString(),
    })),
    envFallback: Boolean(process.env.GEMINI_API_KEY),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      id?: string;
      label?: string;
      kind?: string;
      baseUrl?: string;
      model?: string;
      apiKey?: string;
      clearKey?: boolean;
      setDefault?: boolean;
    };

    if (!isAiKind(body.kind)) {
      return NextResponse.json(
        { error: `Tipo provider non valido. Usa uno tra: ${AI_KINDS.join(", ")}.` },
        { status: 400 },
      );
    }

    const defaults = PROVIDER_DEFAULTS[body.kind];
    const label = body.label?.trim() || body.kind;
    const baseUrl = body.baseUrl?.trim() || defaults.baseUrl;
    const model = body.model?.trim() || defaults.model;

    const existing = body.id
      ? await prisma.aiProvider.findFirst({
          where: { id: body.id, userId: session.userId },
        })
      : null;

    if (body.id && !existing) {
      return NextResponse.json({ error: "Provider non trovato." }, { status: 404 });
    }

    const total = await prisma.aiProvider.count({ where: { userId: session.userId } });
    const shouldBeDefault = body.setDefault === true || (!existing && total === 0);

    if (body.setDefault) {
      await prisma.aiProvider.updateMany({
        where: { userId: session.userId },
        data: { isDefault: false },
      });
    }

    const keyData: { apiKeyCipher?: string | null } = {};
    if (body.clearKey) keyData.apiKeyCipher = null;
    else if (body.apiKey?.trim()) keyData.apiKeyCipher = encryptToken(body.apiKey.trim());

    const provider = existing
      ? await prisma.aiProvider.update({
          where: { id: existing.id },
          data: {
            label,
            kind: body.kind,
            baseUrl,
            model,
            ...keyData,
            ...(shouldBeDefault ? { isDefault: true } : {}),
          },
        })
      : await prisma.aiProvider.create({
          data: {
            userId: session.userId,
            label,
            kind: body.kind,
            baseUrl,
            model,
            apiKeyCipher: keyData.apiKeyCipher ?? null,
            isDefault: shouldBeDefault,
          },
        });

    return NextResponse.json({
      provider: {
        id: provider.id,
        label: provider.label,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: provider.model,
        isDefault: provider.isDefault,
        hasKey: Boolean(provider.apiKeyCipher),
        createdAt: provider.createdAt.toISOString(),
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
    const body = (await req.json()) as { id?: string };
    if (!body.id) return NextResponse.json({ error: "id mancante." }, { status: 400 });

    const provider = await prisma.aiProvider.findFirst({
      where: { id: body.id, userId: session.userId },
    });
    if (!provider) return NextResponse.json({ error: "Provider non trovato." }, { status: 404 });

    await prisma.aiProvider.updateMany({
      where: { userId: session.userId },
      data: { isDefault: false },
    });
    await prisma.aiProvider.update({
      where: { id: provider.id },
      data: { isDefault: true },
    });

    return NextResponse.json({ ok: true });
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

    const provider = await prisma.aiProvider.findFirst({
      where: { id: body.id, userId: session.userId },
    });
    if (!provider) return NextResponse.json({ error: "Provider non trovato." }, { status: 404 });

    await prisma.aiProvider.delete({ where: { id: provider.id } });

    if (provider.isDefault) {
      const remaining = await prisma.aiProvider.findFirst({
        where: { userId: session.userId },
        orderBy: { createdAt: "asc" },
      });
      if (remaining) {
        await prisma.aiProvider.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
