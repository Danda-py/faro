import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import {
  decodeContent,
  getContent,
  getRepo,
  getTree,
  isProbablyBinary,
  listRepos,
  rawBuffer,
} from "@/lib/github";
import { generate, parseJsonLoose, resolveAiConfig, type AiConfig } from "@/lib/ai";

export type CleanupCandidate = {
  path: string;
  reason: string;
  confidence: number;
  sha: string;
  size: number;
};

export type ScanResult = {
  candidates: CleanupCandidate[];
  notes: string;
  scanned: number;
  truncated: boolean;
  ref: string;
};

export const CLEANUP_SYSTEM = `Sei un manutentore esperto di repository. Devi individuare i file davvero inutili.
Analizza l'elenco dei file e proponi SOLO candidati alla cancellazione ad alta sicurezza:
backup (.bak, .old, .orig, ~), duplicati evidenti, file temporanei, asset chiaramente non referenziati.
NON proporre mai: manifest e lockfile, configurazioni, README, licenze, .gitignore, workflow in .github,
migrazioni, file sorgente applicativi, test, documentazione o asset di branding.
Rispondi SOLO con JSON valido:
{"candidates":[{"path":string,"reason":string,"confidence":number}],"notes":string}
"confidence" è un numero tra 0 e 1. Se non trovi nulla di sicuro, restituisci "candidates": [].`;

type CleanupResponse = {
  candidates?: { path?: string; reason?: string; confidence?: number }[];
  notes?: string;
};

const SKIP_DIRS = [
  "node_modules/",
  ".git/",
  ".next/",
  "dist/",
  "build/",
  "vendor/",
  ".vercel/",
  "coverage/",
];

const HINT_FILES = ["package.json", "README.md", "README", "pyproject.toml", "Cargo.toml"];

export async function scanRepository(options: {
  token: string;
  config: AiConfig;
  owner: string;
  repo: string;
  ref?: string;
  maxFiles?: number;
}): Promise<ScanResult> {
  const repoInfo = await getRepo(options.token, options.owner, options.repo);
  const ref = options.ref || repoInfo.default_branch;
  const tree = await getTree(options.token, options.owner, options.repo, ref);
  const maxFiles = options.maxFiles ?? 400;

  const files = tree.tree
    .filter((entry) => entry.type === "blob")
    .filter((entry) => !SKIP_DIRS.some((dir) => entry.path.startsWith(dir)))
    .slice(0, maxFiles);

  if (!files.length) {
    return { candidates: [], notes: "Repository vuoto.", scanned: 0, truncated: false, ref };
  }

  const listing = files.map((entry) => `${entry.path} (${entry.size ?? 0} B)`).join("\n");

  const extra: string[] = [];
  for (const hint of HINT_FILES) {
    if (!files.some((entry) => entry.path === hint)) continue;
    try {
      const content = await getContent(options.token, options.owner, options.repo, hint, ref);
      if (Array.isArray(content) || content.type !== "file") continue;
      const buffer = rawBuffer(content);
      if (isProbablyBinary(hint, buffer)) continue;
      extra.push(`--- ${hint} ---\n${decodeContent(content).slice(0, 4000)}`);
    } catch {
      /* hint non leggibile */
    }
    if (extra.length >= 2) break;
  }

  const result = await generate(options.config, {
    system: CLEANUP_SYSTEM,
    json: true,
    temperature: 0.1,
    maxTokens: 2048,
    turns: [
      {
        role: "user",
        text: [
          `Repository: ${options.owner}/${options.repo} (branch ${ref})`,
          `File totali analizzati: ${files.length}`,
          "Elenco file:",
          listing.slice(0, 40000),
          extra.length ? `\nContesto aggiuntivo:\n${extra.join("\n\n")}` : "",
        ].join("\n"),
      },
    ],
  });

  const parsed = parseJsonLoose<CleanupResponse>(result.text);
  const known = new Set(files.map((entry) => entry.path));

  const candidates = (parsed.candidates ?? [])
    .filter((item) => item.path && known.has(item.path))
    .map((item) => {
      const entry = files.find((file) => file.path === item.path);
      return {
        path: item.path as string,
        reason: item.reason ?? "File probabilmente inutilizzato.",
        confidence: typeof item.confidence === "number" ? item.confidence : 0.5,
        sha: entry?.sha ?? "",
        size: entry?.size ?? 0,
      };
    })
    .slice(0, 40);

  return {
    candidates,
    notes: parsed.notes ?? "",
    scanned: files.length,
    truncated: tree.truncated,
    ref,
  };
}

export type ScanForUserResult = {
  accounts: string[];
  skipped?: "no-ai" | "no-account" | "deadline";
  results: {
    account: string;
    repo: string;
    candidates?: number;
    scanned?: number;
    skipped?: string;
    error?: string;
  }[];
};

/**
 * Esegue la scansione sui repository aggiornati di recente per OGNI account
 * GitHub collegato (scuola, personale, lavoro) e salva le proposte in attesa
 * di conferma. `maxRepos` è il limite per singolo account.
 */
export async function scanForUser(
  userId: string,
  options: { maxRepos?: number; maxFiles?: number; deadline?: number } = {},
): Promise<ScanForUserResult> {
  const config = await resolveAiConfig(userId);
  if (!config) return { accounts: [], skipped: "no-ai", results: [] };

  const accounts = await prisma.githubAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!accounts.length) return { accounts: [], skipped: "no-account", results: [] };

  const perAccount = options.maxRepos ?? 2;
  const results: ScanForUserResult["results"] = [];
  const scannedAccounts: string[] = [];

  for (const account of accounts) {
    if (options.deadline && Date.now() > options.deadline) {
      results.push({ account: account.login, repo: "-", skipped: "deadline" });
      break;
    }

    let token: string;
    try {
      token = decryptToken(account.tokenCipher);
    } catch {
      results.push({
        account: account.login,
        repo: "-",
        error: "Token non leggibile: ricollega l'account.",
      });
      continue;
    }

    let repos: Awaited<ReturnType<typeof listRepos>>;
    try {
      repos = (await listRepos(token, 1))
        .filter((repo) => !repo.archived)
        .slice(0, perAccount);
    } catch (error) {
      results.push({
        account: account.login,
        repo: "-",
        error: error instanceof Error ? error.message : "Errore nel leggere i repository",
      });
      continue;
    }

    scannedAccounts.push(account.login);

    for (const repo of repos) {
      if (options.deadline && Date.now() > options.deadline) {
        results.push({ account: account.login, repo: repo.full_name, skipped: "deadline" });
        break;
      }

      try {
        const scan = await scanRepository({
          token,
          config,
          owner: repo.owner.login,
          repo: repo.name,
          ref: repo.default_branch,
          maxFiles: options.maxFiles ?? 150,
        });

        await prisma.cleanupSuggestion.deleteMany({
          where: {
            userId,
            owner: repo.owner.login,
            repo: repo.name,
            status: "pending",
          },
        });

        if (scan.candidates.length) {
          await prisma.cleanupSuggestion.createMany({
            data: scan.candidates.map((candidate) => ({
              userId,
              accountId: account.id,
              accountLogin: account.login,
              owner: repo.owner.login,
              repo: repo.name,
              ref: scan.ref,
              path: candidate.path,
              reason: candidate.reason,
              confidence: candidate.confidence,
              size: candidate.size,
              sha: candidate.sha,
            })),
          });
        }

        results.push({
          account: account.login,
          repo: repo.full_name,
          candidates: scan.candidates.length,
          scanned: scan.scanned,
        });
      } catch (error) {
        results.push({
          account: account.login,
          repo: repo.full_name,
          error: error instanceof Error ? error.message : "Errore sconosciuto",
        });
      }
    }
  }

  return { accounts: scannedAccounts, results };
}
