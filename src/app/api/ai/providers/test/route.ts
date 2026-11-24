import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import {
  PROVIDER_DEFAULTS,
  generate,
  isAiKind,
  type AiConfig,
} from "@/lib/ai";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      id?: string;
      kind?: string;
      baseUrl?: string;
      model?: string;
      apiKey?: string;
      label?: string;
    };

    let config: AiConfig | null = null;

    if (body.id) {
      const provider = await prisma.aiProvider.findFirst({
        where: { id: body.id, userId: session.userId },
      });
      if (!provider || !isAiKind(provider.kind)) {
        return NextResponse.json({ error: "Provider non trovato." }, { status: 404 });
      }
      config = {
        id: provider.id,
        label: provider.label,
        kind: provider.kind,
        baseUrl: provider.baseUrl,
        model: provider.model,
        apiKey: provider.apiKeyCipher ? decryptToken(provider.apiKeyCipher) : null,
        fromEnv: false,
      };
    } else {
      if (!isAiKind(body.kind)) {
        return NextResponse.json({ error: "Tipo provider non valido." }, { status: 400 });
      }
      const defaults = PROVIDER_DEFAULTS[body.kind];
      config = {
        id: null,
        label: body.label?.trim() || body.kind,
        kind: body.kind,
        baseUrl: body.baseUrl?.trim() || defaults.baseUrl,
        model: body.model?.trim() || defaults.model,
        apiKey: body.apiKey?.trim() || null,
        fromEnv: false,
      };
    }

    const result = await generate(config, {
      system: "Rispondi in modo estremamente breve.",
      turns: [{ role: "user", text: "Rispondi esattamente con: OK" }],
      temperature: 0,
      maxTokens: 24,
    });

    return NextResponse.json({
      ok: true,
      reply: result.text.slice(0, 120),
      model: config.model,
      provider: config.label,
    });
  } catch (error) {
    return handleError(error);
  }
}
