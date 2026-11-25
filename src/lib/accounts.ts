import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

export type ResolvedAccount = {
  id: string;
  login: string;
  label: string | null;
  token: string;
};

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

/**
 * Restituisce l'account GitHub richiesto (o quello predefinito) appartenente
 * all'utente loggato, con il token già decifrato.
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

  let token: string;
  try {
    token = decryptToken(account.tokenCipher);
  } catch {
    throw new AccountTokenError(account.login);
  }

  return {
    id: account.id,
    login: account.login,
    label: account.label,
    token,
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
