"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/lib/client-api";

export type Account = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  label: string | null;
  isDefault: boolean;
  scope: string | null;
  createdAt: string;
};

type AccountContextValue = {
  accounts: Account[];
  currentId: string | null;
  current: Account | null;
  setCurrentId: (id: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
};

const STORAGE_KEY = "portale.currentAccount";

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({
  initialAccounts,
  children,
}: {
  initialAccounts: Account[];
  children: React.ReactNode;
}) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [currentId, setCurrentIdState] = useState<string | null>(
    initialAccounts[0]?.id ?? null,
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && initialAccounts.some((account) => account.id === stored)) {
      setCurrentIdState(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrentId = useCallback((id: string) => {
    setCurrentIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ accounts: Account[] }>("/api/accounts");
      setAccounts(data.accounts);
      setCurrentIdState((current) => {
        if (current && data.accounts.some((account) => account.id === current)) {
          return current;
        }
        return data.accounts[0]?.id ?? null;
      });
    } catch {
      /* sessione scaduta: il layout server reindirizza al login */
    }
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      accounts,
      currentId,
      current: accounts.find((account) => account.id === currentId) ?? null,
      setCurrentId,
      refresh,
      loading: false,
    }),
    [accounts, currentId, refresh, setCurrentId],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount deve essere usato dentro AccountProvider");
  return context;
}
