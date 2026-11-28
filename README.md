# Faro

Portale personale per gestire repository GitHub, modificare file e farsi assistere da un'AI
a scelta. Pensato per uso personale, pronto per essere esteso a compagni di scuola.

> Il nome: **Faro** — una luce puntata sui tuoi repository. Corto, italiano, coerente con
> l'estetica in vetro e luce del portale.

## Cosa fa

- **Login con GitHub** (OAuth) e sessione firmata su cookie `httpOnly`.
- **Più account GitHub collegati** (personale, scuola, lavoro) con switch immediato.
  Non esiste una copia locale dei dati: ogni vista legge da GitHub in tempo reale, quindi
  entrambi gli account sono sempre allineati. Le modifiche sono commit immediati.
- **Gestione file**: albero del repository, editor, creazione, upload dal computer,
  download, eliminazione. Ogni modifica è un commit sul branch selezionato.
  Nell'editor `Ctrl/⌘+S` salva, `Tab`/`Shift+Tab` indentano, invio mantiene il rientro.
  Il menu **VS Code** clona e apre il repository nell'editor locale (`vscode://`),
  apre la versione web `github.dev` o copia il comando `git clone`.
- **AI multi-provider** configurabile dal portale:
  - Gemini, OpenAI, Anthropic Claude, DeepSeek, Qwen (DashScope), Ollama e qualsiasi
    endpoint OpenAI-compatible (Groq, OpenRouter, LM Studio, vLLM…).
  - Un provider è "attivo"; gli altri restano salvati e si cambiano con un clic.
  - Chiavi cifrate a riposo e mai restituite al browser.
  - Pulsante **Testa** per verificare la connessione prima di usarla.
- **Correzione file**: l'AI legge il file aperto e propone la versione corretta con note.
- **Pulizia repository**:
  - Scansione manuale dal workspace.
  - **Scansione schedulata con Vercel Cron** (`0 4 * * *`): analizza i repository
    aggiornati di recente e salva le proposte nella pagina *Pulizia*.
  - Nulla viene cancellato in automatico: ogni eliminazione richiede conferma.
- **Chat AI** con cronologia salvata su database.
- **UI glassmorphism**: vetro sfocato, gradienti viola/ciano, animazioni leggere.

## Stack

| Pezzo | Scelta |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Stili | Tailwind CSS 3 |
| Database | Neon Postgres + Prisma |
| Auth | GitHub OAuth + JWT di sessione (`jose`) |
| AI | Adapter REST: Gemini, Anthropic, OpenAI-compatible |
| Hosting | Vercel (+ Vercel Cron) |

## Avvio locale

```bash
npm install
cp .env.example .env.local   # compila i valori
npm run db:push              # crea le tabelle su Neon
npm run dev
```

### 1. Database Neon

1. Crea un progetto su [neon.tech](https://neon.tech).
2. Copia la connection string **Pooled** in `DATABASE_URL` e quella **Direct** in `DIRECT_URL`.

### 2. GitHub OAuth App

1. [github.com/settings/developers](https://github.com/settings/developers) → *New OAuth App*.
2. Homepage: `http://localhost:3000`
3. Callback: `http://localhost:3000/api/auth/github/callback`
4. Copia `Client ID` e `Client Secret` nelle variabili d'ambiente.
5. In produzione aggiorna la callback con il dominio Vercel.

Scope richiesti: `repo read:user user:email offline_access` (servono per leggere e scrivere
anche nei repository privati).

GitHub emette access token validi **8 ore** con un refresh token valido 6 mesi:
Faro salva entrambi (cifrati) e rinnova il token da solo, quindi il collegamento non
scade più dopo qualche ora di inattività. `offline_access` assicura il refresh token
anche se l'OAuth App non è configurata per i token a scadenza.

### 3. AI

Non è più necessario configurare Gemini nelle variabili d'ambiente: dopo il login vai in
**Impostazioni → Assistente AI** e aggiungi un provider. La chiave viene cifrata con
`AUTH_SECRET` e salvata nel database.

`GEMINI_API_KEY` resta supportata solo come fallback se non hai salvato nessun provider.

### 4. `AUTH_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Firma le sessioni e deriva la chiave AES-256-GCM per token GitHub e chiavi AI.

### 5. Cron di pulizia

`vercel.json` registra `/api/cron/cleanup` ogni giorno alle **04:00 UTC** (Vercel Cron usa
UTC: in Italia sono le 05:00 o le 06:00 con l'ora legale). La configurazione è nel codice,
ma il cron esiste in produzione solo quando il progetto è collegato a Vercel e deployato.

1. In Vercel collega/importa questo progetto GitHub e fai un deploy Production.
2. Imposta `CRON_SECRET` tra le variabili d'ambiente di Production (usa lo stesso valore
   casuale configurato dal progetto; non inserirlo nel repository).
3. Fai un nuovo deploy dopo aver salvato le variabili. Vercel invierà automaticamente
   `Authorization: Bearer $CRON_SECRET`.
4. Senza `CRON_SECRET` l'endpoint risponde 503 e il job non produce proposte.

In locale puoi lanciarlo a mano:

```bash
curl "http://localhost:3000/api/cron/cleanup?secret=$CRON_SECRET"
```

Il job scansiona **tutti gli account GitHub collegati** di ogni utente (scuola, personale,
lavoro), non solo quello predefinito: per ognuno prende i 2 repository aggiornati più di
recente. Limiti: massimo 12 utenti per esecuzione, budget globale di 45 secondi con
`maxDuration = 60`. Le proposte sono rigenerate a ogni scansione; quelle ancora in attesa
per lo stesso repository vengono sostituite, quelle ignorate o eliminate restano a storico.

## Deploy su Vercel

1. Importa il repository su Vercel.
2. Aggiungi le variabili di `.env.example` (Production + Preview).
3. Imposta `NEXT_PUBLIC_APP_URL` al dominio di produzione e `CRON_SECRET`.
4. Aggiorna la callback OAuth su GitHub.
5. Esegui una volta `npm run db:push` con le variabili di produzione.

## Provider AI supportati

| Provider | Tipo | Base URL tipica | Modello di esempio |
| --- | --- | --- | --- |
| Google Gemini | `gemini` | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.5-flash` |
| OpenAI | `openai` | `https://api.openai.com/v1` | `gpt-4.1-mini` |
| Anthropic | `anthropic` | `https://api.anthropic.com/v1` | `claude-sonnet-4-5` |
| DeepSeek | `openai` | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Qwen | `openai` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Ollama | `openai` | `http://localhost:11434/v1` | `llama3.1` |
| Altri | `openai` | qualsiasi | — |

Nota: Ollama in locale funziona solo se Faro gira sulla stessa macchina; da Vercel non è
raggiungibile.

## Struttura

```
src/
  app/
    (app)/            area autenticata (dashboard, ai, cleanup, accounts, settings, repos)
    api/
      auth/github/    start + callback OAuth
      accounts/       CRUD account GitHub collegati
      github/         repos, tree, file (GET/PUT/DELETE), download
      ai/             chat, fix, cleanup, providers (+ test)
      cleanup/        run manuale + proposte salvate
      cron/cleanup    job schedulato Vercel
    login/            pagina di accesso
  components/         UI glass e viste client
  lib/                db, session, crypto, github, ai, cleanup
prisma/schema.prisma  User, GithubAccount, AiProvider, AiMessage, CleanupSuggestion
vercel.json           cron giornaliero
```

## Note di sicurezza

- Token GitHub e chiavi AI sono cifrati a riposo (AES-256-GCM) con chiave derivata da
  `AUTH_SECRET`; non vengono mai restituiti al client (solo `hasKey` booleano).
- Tutte le chiamate a GitHub e ai provider AI avvengono nelle route server.
- Il cron è protetto da `CRON_SECRET`.
- La pulizia non elimina nulla in automatico: propone, tu confermi.
- Per estendere l'accesso a compagni: aggiungi `role`/`team` su `User` e un controllo nelle
  route; la struttura multi-account è già per-utente.
