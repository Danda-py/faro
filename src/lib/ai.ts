import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

export type AiKind = "gemini" | "openai" | "anthropic";
export type AiTurn = { role: "user" | "model"; text: string };
export type AiResult = { text: string; usage?: { totalTokens?: number } };

export type AiConfig = {
  id: string | null;
  label: string;
  kind: AiKind;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  fromEnv: boolean;
};

export type GenerateOptions = {
  system?: string;
  turns: AiTurn[];
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
};

export const AI_KINDS: AiKind[] = ["gemini", "openai", "anthropic"];

export const PROVIDER_DEFAULTS: Record<AiKind, { baseUrl: string; model: string }> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
  },
};

export class AiError extends Error {
  constructor(
    public status: number,
    message: string,
    public provider?: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function isAiKind(value: unknown): value is AiKind {
  return value === "gemini" || value === "openai" || value === "anthropic";
}

/**
 * Configurazione AI dell'utente: primo provider salvato, altrimenti fallback
 * alla GEMINI_API_KEY di ambiente (se presente).
 */
export async function resolveAiConfig(userId: string): Promise<AiConfig | null> {
  const provider = await prisma.aiProvider.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  if (provider && isAiKind(provider.kind)) {
    return {
      id: provider.id,
      label: provider.label,
      kind: provider.kind,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKey: provider.apiKeyCipher ? decryptToken(provider.apiKeyCipher) : null,
      fromEnv: false,
    };
  }

  const envKey = process.env.GEMINI_API_KEY;
  if (envKey) {
    return {
      id: null,
      label: "Gemini (env)",
      kind: "gemini",
      baseUrl: PROVIDER_DEFAULTS.gemini.baseUrl,
      model: process.env.GEMINI_MODEL || PROVIDER_DEFAULTS.gemini.model,
      apiKey: envKey,
      fromEnv: true,
    };
  }

  return null;
}

export async function generate(config: AiConfig, options: GenerateOptions): Promise<AiResult> {
  switch (config.kind) {
    case "gemini":
      return generateGemini(config, options);
    case "openai":
      return generateOpenAi(config, options);
    case "anthropic":
      return generateAnthropic(config, options);
    default:
      throw new AiError(400, `Provider non supportato: ${config.kind}`);
  }
}

async function generateGemini(config: AiConfig, options: GenerateOptions): Promise<AiResult> {
  if (!config.apiKey) throw new AiError(503, `Configura la API key per ${config.label}.`);

  const body: Record<string, unknown> = {
    contents: options.turns.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens ?? 8192,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (options.system) body.systemInstruction = { parts: [{ text: options.system }] };

  const data = await postJson(
    `${trimSlash(config.baseUrl)}/models/${encodeURIComponent(config.model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify(body),
    },
    config.label,
  );

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) throw new AiError(502, "Risposta vuota dal modello.", config.label);
  return { text, usage: { totalTokens: data?.usageMetadata?.totalTokenCount } };
}

async function generateOpenAi(config: AiConfig, options: GenerateOptions): Promise<AiResult> {
  const messages: { role: string; content: string }[] = [];
  if (options.system) messages.push({ role: "system", content: options.system });
  for (const turn of options.turns) {
    messages.push({
      role: turn.role === "model" ? "assistant" : "user",
      content: turn.text,
    });
  }

  const data = await postJson(
    `${trimSlash(config.baseUrl)}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 4096,
      }),
    },
    config.label,
  );

  const content = data?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) throw new AiError(502, "Risposta vuota dal modello.", config.label);

  return { text, usage: { totalTokens: data?.usage?.total_tokens } };
}

async function generateAnthropic(config: AiConfig, options: GenerateOptions): Promise<AiResult> {
  if (!config.apiKey) throw new AiError(503, `Configura la API key per ${config.label}.`);

  const data = await postJson(
    `${trimSlash(config.baseUrl)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.4,
        ...(options.system ? { system: options.system } : {}),
        messages: options.turns.map((turn) => ({
          role: turn.role === "model" ? "assistant" : "user",
          content: turn.text,
        })),
      }),
    },
    config.label,
  );

  const text = Array.isArray(data?.content)
    ? data.content
        .filter((block: { type?: string }) => block.type === "text")
        .map((block: { text?: string }) => block.text ?? "")
        .join("")
        .trim()
    : "";

  if (!text) throw new AiError(502, "Risposta vuota dal modello.", config.label);

  return {
    text,
    usage: {
      totalTokens:
        (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0) || undefined,
    },
  };
}

async function postJson(
  url: string,
  init: RequestInit,
  provider: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    throw new AiError(
      502,
      `Impossibile raggiungere ${provider}. Controlla la base URL e la rete.`,
      provider,
    );
  }

  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errorField = data?.error as
      | { message?: string }
      | string
      | undefined;
    const message =
      (typeof errorField === "string" ? errorField : errorField?.message) ||
      (typeof data?.message === "string" ? data.message : null) ||
      `${provider}: errore ${res.status}.`;
    throw new AiError(
      res.status === 401 || res.status === 403 ? 401 : 502,
      message,
      provider,
    );
  }

  if (!data) throw new AiError(502, `Risposta non valida da ${provider}.`, provider);
  return data;
}

function trimSlash(url: string) {
  return url.replace(/\/+$/, "");
}

/** Estrae il primo oggetto JSON da una risposta che potrebbe contenere testo attorno. */
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new AiError(502, "Il modello non ha restituito JSON valido.");
  }
}
