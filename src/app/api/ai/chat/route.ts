import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generate, resolveAiConfig, type AiTurn } from "@/lib/ai";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM = `Sei l'assistente AI di Faro, un portale personale per gestire repository GitHub.
Rispondi sempre in italiano, in modo conciso e tecnico.
Quando ricevi il contenuto di un file, usalo come contesto reale e non inventare righe che non esistono.
Se ti viene chiesto di correggere del codice, restituisci il codice nella sua interezza dentro un blocco \`\`\` con il linguaggio corretto.
Non aggiungere funzionalità che non sono state richieste.`;

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const messages = await prisma.aiMessage.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json({
    messages: messages.reverse().map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return unauthorized();

  await prisma.aiMessage.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      messages?: { role: "user" | "assistant"; content: string }[];
      context?: { title?: string; content?: string } | null;
    };

    const history = (body.messages ?? [])
      .filter((message) => message.content?.trim())
      .slice(-16);

    const last = history[history.length - 1];
    if (!last || last.role !== "user") {
      return NextResponse.json({ error: "Nessun messaggio utente." }, { status: 400 });
    }

    const config = await resolveAiConfig(session.userId);
    if (!config) {
      return NextResponse.json(
        { error: "Nessun provider AI configurato. Vai in Impostazioni → Assistente AI." },
        { status: 400 },
      );
    }

    const turns: AiTurn[] = history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      text: message.content,
    }));

    if (body.context?.content) {
      turns.unshift({
        role: "user",
        text: `Contesto dal repository — ${body.context.title ?? "file"}:\n\n${body.context.content.slice(0, 60000)}`,
      });
      turns.unshift({
        role: "model",
        text: "Ho ricevuto il contesto del file. Dimmi cosa devo fare.",
      });
    }

    const result = await generate(config, {
      system: SYSTEM,
      turns,
      temperature: 0.5,
    });

    await prisma.aiMessage.createMany({
      data: [
        { userId: session.userId, role: "user", content: last.content.slice(0, 20000) },
        { userId: session.userId, role: "assistant", content: result.text.slice(0, 40000) },
      ],
    });

    return NextResponse.json({
      reply: result.text,
      usage: result.usage,
      provider: { label: config.label, model: config.model },
    });
  } catch (error) {
    return handleError(error);
  }
}
