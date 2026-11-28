"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Loader2,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, Input, PageHeader } from "@/components/ui";
import { cn } from "@/lib/utils";

type Item = { id: string; role: string; content: string; createdAt: string };

export function AiChat() {
  const { current } = useAccount();
  const [messages, setMessages] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ messages: Item[] }>("/api/ai/chat");
      setMessages(data.messages);
    } catch {
      /* primo accesso */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const optimistic: Item = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const history = [...messages, optimistic];
    setMessages(history);
    setDraft("");
    setBusy(true);
    setError("");

    try {
      const data = await apiFetch<{ reply: string }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: history
            .filter((message) => !message.id.startsWith("local-"))
            .concat({ role: "user", content } as never)
            .map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      setMessages((previous) => [
        ...previous,
        {
          id: `reply-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore dall'assistente.");
      setMessages((previous) =>
        previous.filter((message) => message.id !== optimistic.id),
      );
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm("Cancellare tutta la cronologia della chat?")) return;
    try {
      await apiFetch("/api/ai/chat", { method: "DELETE" });
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossibile svuotare la chat.");
    }
  }

  const suggestions = useMemo(
    () => [
      "Spiega come strutturare un progetto Next.js con Prisma su Vercel.",
      "Riscrivi questa funzione in modo più leggibile:",
      "Quali file posso eliminare in un repo Node per tenerlo pulito?",
    ],
    [],
  );

  return (
    <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-4xl flex-col py-2">
      <PageHeader
        className="pb-4"
        eyebrow="Assistente"
        title="Assistente AI"
        icon={<Sparkles className="h-4 w-4" />}
        description={`L'assistente AI, con il contesto dei tuoi repository${current ? ` · account ${current.label || current.login}` : ""}.`}
        actions={
          messages.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => void clearHistory()}>
              <Trash2 className="h-3.5 w-3.5" />
              Nuova chat
            </Button>
          ) : null
        }
      />

      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {!loaded ? (
            <div className="flex h-full items-center justify-center text-signal-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-md border border-white/10 bg-white/5 text-signal-300">
                <Sparkles className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[15px] font-medium text-signal-200">
                  Chiedimi quello che vuoi
                </p>
                <p className="mt-1 text-[13px] text-signal-400">
                  Refactor, spiegazioni, correzioni di file.
                </p>
              </div>
              <div className="flex max-w-lg flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-left text-[12px] text-signal-400 transition hover:border-signal-400/30 hover:bg-white/[0.07] hover:text-signal-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {busy ? (
            <div className="flex items-center gap-2 text-xs text-signal-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              L'assistente sta pensando…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/5 bg-white/[0.02] p-3">
          {error ? (
            <div className="mb-2">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              placeholder="Scrivi un messaggio… (Invio per inviare)"
              className="input-base max-h-40 min-h-[46px] flex-1 resize-y"
            />
            <Button type="submit" loading={busy} className="h-[46px]">
              Invia
            </Button>
          </form>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-signal-500">
        <UserRound className="h-3 w-3" />
        Serve un file specifico? Apri il repository e usa la scheda AI nel workspace.
        <ArrowUpRight className="h-3 w-3" />
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: Item }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded text-[10px] font-medium",
          isUser
            ? "bg-white/10 text-signal-300"
            : "bg-paper text-ink-950",
        )}
      >
        {isUser ? "TU" : <Sparkles className="h-3.5 w-3.5" />}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-md px-4 py-2.5 text-[13.5px] leading-relaxed",
          isUser
            ? "border border-white/10 bg-white/[0.06] text-signal-200"
            : "text-signal-300",
        )}
      >
        <Markdown text={message.content} />
      </div>
    </div>
  );
}

function Markdown({ text }: { text: string }) {
  const parts = text.split(/```/);
  return (
    <div className="space-y-2 whitespace-pre-wrap break-words">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <pre
            key={index}
            className="overflow-x-auto rounded-md border border-white/10 bg-ink-950/70 p-3 font-mono text-[12px] leading-relaxed text-signal-300"
          >
            <code>{part.replace(/^[a-z0-9+#-]*\n/i, "")}</code>
          </pre>
        ) : (
          <span key={index} className="block">
            {part}
          </span>
        ),
      )}
    </div>
  );
}

export function InlineCheck({ done }: { done: boolean }) {
  return (
    <span
      className={cn(
        "grid h-5 w-5 place-items-center rounded-md",
        done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-signal-500",
      )}
    >
      <Check className="h-3 w-3" />
    </span>
  );
}
