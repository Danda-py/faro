import { prisma } from "@/lib/db";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { GithubError, refreshAccessToken } from "@/lib/github";

export type ResolvedAccount = {
  id: string;
  login: string;
  label: string | null;
  token: string;
};

/**
 * Credenziali GitHub salvate per un account.
 * `expiresAt`/`refresh` esistono solo per le OAuth App che emettono token a
 * scadenza (8 ore): in quel caso il token viene rinnovato in automatico.
 */
export type GithubTokenSet = {
  access: string;
  refresh?: string;
  /** Epoch in millisecondi in cui l'access token scade. */
  expiresAt?: number;
};

/** Rinnova il token poco prima che scada, così nessuna richiesta parte con un token morto. */
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

/** Il token salvato non è decifrabile (di solito AUTH_SECRET cambiato). */
export class AccountTokenError extends Error {
  readonly reauthorize = true;

  constructor(public login: string) {
    super(
      `Non riesco a leggere il token salvato per @${login}: il segreto del server (AUTH_SECRET) potrebbe essere cambiato. Ricollega l'account.`,
    );
    this.name = "AccountTokenError";
  }
}

export function packToken(set: GithubTokenSet): string {
  return encryptToken(JSON.stringify(set));
}

/**
 * Gli account collegati prima del supporto ai token a scadenza hanno un solo
 * access token cifrato: in quel caso il payload non è JSON.
 */
export function unpackToken(cipher: string): GithubTokenSet {
  const plain = decryptToken(cipher);
  if (!plain.startsWith("{")) return { access: plain };
  try {
    const parsed = JSON.parse(plain) as Partial<GithubTokenSet>;
    if (!parsed || typeof parsed.access !== "string" || !parsed.access) {
      return { access: plain };
    }
    return {
      access: parsed.access,
      refresh: typeof parsed.refresh === "string" && parsed.refresh ? parsed.refresh : undefined,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
    };
  } catch {
    return { access: plain };
  }
}

/** Costruisce il set da salvare partendo dalla risposta OAuth di GitHub. */
export function tokenSetFromResponse(
  response: { access_token: string; refresh_token?: string; expires_in?: number },
  previous?: GithubTokenSet,
): GithubTokenSet {
  return {
    access: response.access_token,
    refresh: response.refresh_token || previous?.refresh,
    expiresAt:
      typeof response.expires_in === "number" && response.expires_in > 0
        ? Date.now() + response.expires_in * 1000
        : undefined,
  };
}

// Una pagina carica più chiamate API in parallelo: senza questa mappa il refresh
// token verrebbe speso più volte e GitHub invaliderebbe i token ruotati.
const pendingRefreshes = new Map<string, Promise<GithubTokenSet>>();

async function refreshAccountToken(account: {
  id: string;
  login: string;
  tokenCipher: string;
}): Promise<GithubTokenSet> {
  const running = pendingRefreshes.get(account.id);
  if (running) return running;

  const task = (async () => {
    const current = unpackToken(account.tokenCipher);
    if (!current.refresh) {
      throw new GithubError(
        401,
        `Il collegamento a GitHub di @${account.login} è scaduto: ricollega l'account.`,
      );
    }

    let response;
    try {
      response = await refreshAccessToken(current.refresh);
    } catch {
      // Un'altra istanza del server può aver già ruotato il refresh token:
      // rileggo dal database e riuso i token nuovi, se ci sono.
      const stored = await prisma.githubAccount.findUnique({
        where: { id: account.id },
        select: { tokenCipher: true },
      });
      if (stored && stored.tokenCipher !== account.tokenCipher) {
        const candidate = unpackToken(stored.tokenCipher);
        if (candidate.expiresAt && candidate.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
          return candidate;
        }
      }
      throw new GithubError(
        401,
        `Il collegamento a GitHub di @${account.login} è scaduto: ricollega l'account.`,
      );
    }

    const next = tokenSetFromResponse(response, current);
    await prisma.githubAccount.update({
      where: { id: account.id },
      data: { tokenCipher: packToken(next) },
    });
    return next;
  })().finally(() => pendingRefreshes.delete(account.id));

  pendingRefreshes.set(account.id, task);
  return task;
}

/**
 * Restituisce l'account GitHub richiesto (o quello predefinito) appartenente
 * all'utente loggato, con il token già decifrato e, se serve, rinnovato.
 */
export async function resolveAccount(
  userId: string,
  accountId?: string | null,
): Promise<ResolvedAccount | null> {
  const accounts = await prisma.githubAccount.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const account = accountId
    ? accounts.find((item) => item.id === accountId)
    : accounts[0];

  if (!account) return null;

  let tokenSet: GithubTokenSet;
  try {
    tokenSet = unpackToken(account.tokenCipher);
  } catch {
    throw new AccountTokenError(account.login);
  }

  if (tokenSet.expiresAt !== undefined && tokenSet.expiresAt <= Date.now() + REFRESH_MARGIN_MS) {
    tokenSet = await refreshAccountToken({
      id: account.id,
      login: account.login,
      tokenCipher: account.tokenCipher,
    });
  }

  return {
    id: account.id,
    login: account.login,
    label: account.label,
    token: tokenSet.access,
  };
}

export function publicAccount(account: {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  label: string | null;
  isDefault: boolean;
  scope: string | null;
  createdAt: Date;
}) {
  return {
    id: account.id,
    login: account.login,
    name: account.name,
    avatarUrl: account.avatarUrl,
    email: account.email,
    label: account.label,
    isDefault: account.isDefault,
    scope: account.scope,
    createdAt: account.createdAt.toISOString(),
  };
}
