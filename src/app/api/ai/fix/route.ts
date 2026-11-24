import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { resolveAccount } from "@/lib/accounts";
import { decodeContent, getContent, isProbablyBinary, rawBuffer } from "@/lib/github";
import { generate, parseJsonLoose, resolveAiConfig } from "@/lib/ai";
import { handleError, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM = `Sei un ingegnere del software senior che revisiona file di codice.
Ricevi il percorso di un file, un'istruzione dell'utente e il contenuto attuale.
Rispondi SOLO con un oggetto JSON valido con questa forma esatta:
{"summary": string, "notes": string[], "content": string}
- "content" deve contenere l'INTERO file corretto, senza blocchi markdown e senza spiegazioni.
- "summary" è una frase che descrive la correzione principale.
- "notes" sono al massimo 5 note brevi sulle modifiche.
Mantieni stile, indentazione e architettura esistenti. Non aggiungere funzionalità non richieste.`;

type FixResponse = { summary?: string; notes?: string[]; content?: string };

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = (await req.json()) as {
      accountId?: string;
      owner?: string;
      repo?: string;
      path?: string;
      ref?: string;
      instruction?: string;
    };

    if (!body.owner || !body.repo || !body.path) {
      return NextResponse.json({ error: "Dati incompleti." }, { status: 400 });
    }

    const account = await resolveAccount(session.userId, body.accountId);
    if (!account) return NextResponse.json({ error: "Nessun account collegato." }, { status: 400 });

    const config = await resolveAiConfig(session.userId);
    if (!config) {
      return NextResponse.json(
        { error: "Nessun provider AI configurato. Vai in Impostazioni → Assistente AI." },
        { status: 400 },
      );
    }

    const file = await getContent(account.token, body.owner, body.repo, body.path, body.ref);
    if (Array.isArray(file) || file.type !== "file") {
      return NextResponse.json({ error: "Il percorso non è un file." }, { status: 400 });
    }

    const buffer = rawBuffer(file);
    if (isProbablyBinary(body.path, buffer)) {
      return NextResponse.json(
        { error: "I file binari non possono essere corretti dall'AI." },
        { status: 400 },
      );
    }

    const current = decodeContent(file);
    if (current.length > 120000) {
      return NextResponse.json(
        { error: "File troppo grande per la revisione (limite 120k caratteri)." },
        { status: 400 },
      );
    }

    const instruction =
      body.instruction?.trim() ||
      "Correggi bug, semplifica il codice duplicato e applica le buone pratiche, senza cambiare il comportamento.";

    const result = await generate(config, {
      system: SYSTEM,
      json: true,
      temperature: 0.2,
      maxTokens: 8192,
      turns: [
        {
          role: "user",
          text: [
            `Repository: ${body.owner}/${body.repo}`,
            `File: ${body.path}`,
            `Istruzione: ${instruction}`,
            "Contenuto attuale:",
            current,
          ].join("\n"),
        },
      ],
    });

    const parsed = parseJsonLoose<FixResponse>(result.text);
    if (!parsed.content || typeof parsed.content !== "string") {
      return NextResponse.json(
        { error: "Il modello non ha restituito il file corretto." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      path: body.path,
      summary: parsed.summary ?? "Revisione completata.",
      notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 8) : [],
      content: parsed.content,
      provider: { label: config.label, model: config.model },
    });
  } catch (error) {
    return handleError(error);
  }
}
