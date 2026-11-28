"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Cloud,
  Cpu,
  KeyRound,
  Loader2,
  Pencil,
  Plug,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { Alert, Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type Provider = {
  id: string;
  label: string;
  kind: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  hasKey: boolean;
  createdAt: string;
};

type Preset = {
  id: string;
  name: string;
  kind: "gemini" | "openai" | "anthropic";
  baseUrl: string;
  model: string;
  needsKey: boolean;
  hint: string;
};

const PRESETS: Preset[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    needsKey: true,
    hint: "Chiave da aistudio.google.com/apikey",
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    needsKey: true,
    hint: "Chiave da platform.openai.com",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    needsKey: true,
    hint: "Chiave da console.anthropic.com",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    needsKey: true,
    hint: "API OpenAI-compatible di DeepSeek",
  },
  {
    id: "qwen",
    name: "Qwen (DashScope)",
    kind: "openai",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    needsKey: true,
    hint: "Endpoint compatibile OpenAI di Alibaba",
  },
  {
    id: "ollama",
    name: "Ollama (locale)",
    kind: "openai",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    needsKey: false,
    hint: "Richiede che il portale giri sulla stessa macchina di Ollama",
  },
  {
    id: "custom",
    name: "Altro (OpenAI-compatible)",
    kind: "openai",
    baseUrl: "",
    model: "",
    needsKey: true,
    hint: "Groq, OpenRouter, LM Studio, vLLM…",
  },
];

const KIND_LABEL: Record<string, string> = {
  gemini: "Gemini",
  openai: "OpenAI-compatible",
  anthropic: "Anthropic",
};

export function AiProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [envFallback, setEnvFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [label, setLabel] = useState(PRESETS[0].name);
  const [kind, setKind] = useState<Preset["kind"]>(PRESETS[0].kind);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].baseUrl);
  const [model, setModel] = useState(PRESETS[0].model);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ providers: Provider[]; envFallback: boolean }>(
        "/api/ai/providers",
      );
      setProviders(data.providers);
      setEnvFallback(data.envFallback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caricamento provider fallito.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  function applyPreset(next: Preset) {
    setPreset(next);
    setKind(next.kind);
    setLabel(next.name);
    setBaseUrl(next.baseUrl);
    setModel(next.model);
    setApiKey("");
  }

  function openNew() {
    setEditingId(null);
    applyPreset(PRESETS[0]);
    setFormOpen(true);
    setError("");
  }

  function openEdit(provider: Provider) {
    setEditingId(provider.id);
    setPreset(PRESETS.find((item) => item.kind === provider.kind) ?? PRESETS[6]);
    setLabel(provider.label);
    setKind(provider.kind as Preset["kind"]);
    setBaseUrl(provider.baseUrl);
    setModel(provider.model);
    setApiKey("");
    setFormOpen(true);
    setError("");
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/ai/providers", {
        method: "POST",
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          label,
          kind,
          baseUrl,
          model,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          setDefault: !editingId && providers.length === 0,
        }),
      });
      setFormOpen(false);
      setApiKey("");
      await load();
      setNotice(editingId ? "Provider aggiornato." : "Provider aggiunto.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio fallito.");
    } finally {
      setSaving(false);
    }
  }

  async function test(id: string) {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const data = await apiFetch<{ reply: string }>("/api/ai/providers/test", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      setNotice(`Connessione OK: ${data.reply}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test fallito.");
    } finally {
      setBusyId(null);
    }
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    try {
      await apiFetch("/api/ai/providers", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      });
      await load();
      setNotice("Provider predefinito aggiornato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento fallito.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(provider: Provider) {
    if (!window.confirm(`Rimuovere ${provider.label}?`)) return;
    setBusyId(provider.id);
    try {
      await apiFetch("/api/ai/providers", {
        method: "DELETE",
        body: JSON.stringify({ id: provider.id }),
      });
      await load();
      setNotice("Provider rimosso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rimozione fallita.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium text-signal-200">
            <Plug className="h-4 w-4 text-signal-300" />
            Assistente AI
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-signal-400">
            Scegli il modello che alimenta correzioni, pulizia e chat. Le chiavi sono cifrate
            e restano sul server.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          Aggiungi provider
        </Button>
      </div>

      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-3">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      {formOpen ? (
        <div className="mt-4 rounded-md border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-signal-200">
              {editingId ? "Modifica provider" : "Nuovo provider"}
            </h3>
            <button
              onClick={() => setFormOpen(false)}
              className="grid h-7 w-7 place-items-center rounded text-signal-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((item) => (
              <button
                key={item.id}
                onClick={() => applyPreset(item)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11.5px] transition",
                  preset.id === item.id
                    ? "border-signal-400/40 bg-signal-500/15 text-signal-100"
                    : "border-white/10 bg-white/[0.03] text-signal-400 hover:border-white/20 hover:text-signal-200",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label-base">Nome</span>
              <Input value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            <label className="block">
              <span className="label-base">Modello</span>
              <Input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="es. gemini-2.5-flash"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label-base">Base URL</span>
              <Input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
                className="font-mono !text-[12px]"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="label-base">
                API key {editingId ? "(lascia vuoto per non cambiarla)" : ""}
              </span>
              <Input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type="password"
                autoComplete="off"
                placeholder={preset.needsKey ? "sk-…" : "non richiesta per Ollama"}
              />
              <span className="mt-1.5 block text-[11px] text-signal-500">{preset.hint}</span>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" loading={saving} onClick={() => void save()}>
              <Check className="h-3.5 w-3.5" />
              Salva
            </Button>
            {preset.needsKey || kind === "openai" ? (
              <Button
                size="sm"
                variant="ghost"
                loading={busyId === "new"}
                onClick={async () => {
                  setBusyId("new");
                  setError("");
                  try {
                    const data = await apiFetch<{ reply: string }>(
                      "/api/ai/providers/test",
                      {
                        method: "POST",
                        body: JSON.stringify({
                          kind,
                          baseUrl,
                          model,
                          apiKey: apiKey.trim() || undefined,
                          label,
                        }),
                      },
                    );
                    setNotice(`Connessione OK: ${data.reply}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Test fallito.");
                  } finally {
                    setBusyId(null);
                  }
                }}
              >
                <Plug className="h-3.5 w-3.5" />
                Testa
              </Button>
            ) : null}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-signal-500">
              <KeyRound className="h-3 w-3" />
              {KIND_LABEL[kind]}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-signal-500">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : null}

        {providers.map((provider) => (
          <div
            key={provider.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-md border p-3",
              provider.isDefault
                ? "border-signal-400/30 bg-signal-500/[0.07]"
                : "border-white/5 bg-white/[0.02]",
            )}
          >
            <span className="grid h-9 w-9 place-items-center rounded border border-white/10 bg-white/5 text-signal-300">
              {provider.kind === "openai" && provider.baseUrl.includes("localhost") ? (
                <Cpu className="h-4 w-4" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[13px] text-signal-200">
                {provider.label}
                {provider.isDefault ? (
                  <span className="chip !border-signal-400/25 !bg-signal-400/10 !text-signal-200">
                    <Star className="h-3 w-3" />
                    attivo
                  </span>
                ) : null}
                {!provider.hasKey && provider.kind !== "openai" ? (
                  <span className="chip !border-amber-400/25 !bg-amber-400/10 !text-amber-200">
                    senza chiave
                  </span>
                ) : null}
              </p>
              <p className="truncate font-mono text-[11px] text-signal-500">
                {provider.model} · {provider.baseUrl}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="subtle"
                size="sm"
                loading={busyId === provider.id}
                onClick={() => void test(provider.id)}
                title="Testa connessione"
              >
                <Plug className="h-3.5 w-3.5" />
              </Button>
              {!provider.isDefault ? (
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={() => void makeDefault(provider.id)}
                  title="Rendi attivo"
                >
                  <Star className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <Button
                variant="subtle"
                size="sm"
                onClick={() => openEdit(provider)}
                title="Modifica"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="subtle"
                size="sm"
                loading={busyId === provider.id}
                onClick={() => void remove(provider)}
                title="Rimuovi"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {!loading && providers.length === 0 ? (
          <div className="rounded-md border border-white/5 bg-white/[0.02] p-4 text-[12.5px] text-signal-400">
            {envFallback
              ? "Nessun provider salvato: viene usata la GEMINI_API_KEY di ambiente come fallback."
              : "Nessun provider configurato: l'AI resta disattivata finché non ne aggiungi uno."}
          </div>
        ) : null}
      </div>
    </section>
  );
}
