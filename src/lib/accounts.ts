import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";

export type ResolvedAccount = {
  id: string;
  login: string;
  label: string | null;
  token: string;
};

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

  return {
    id: account.id,
    login: account.login,
    label: account.label,
    token: decryptToken(account.tokenCipher),
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
