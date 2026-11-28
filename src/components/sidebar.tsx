"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Eraser,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ai", label: "Assistente AI", icon: Sparkles },
  { href: "/cleanup", label: "Pulizia", icon: Eraser },
  { href: "/accounts", label: "Account", icon: UserRound },
  { href: "/settings", label: "Impostazioni", icon: Settings },
];

export function Sidebar({
  user,
}: {
  user: { login: string; name: string | null; avatarUrl: string | null };
}) {
  const pathname = usePathname();
  const { accounts, currentId, setCurrentId } = useAccount();

  return (
    <aside className="glass flex w-full flex-col gap-4 p-3 md:sticky md:top-5 md:h-[calc(100vh-2.5rem)] md:w-[248px] md:shrink-0 md:gap-5 md:p-4">
      <Link href="/dashboard" className="group flex items-baseline gap-2.5 px-0.5 py-1">
        <span className="font-mono text-[13px] tracking-[0.18em] text-paper transition-colors group-hover:text-white">
          FARO
        </span>
        <span className="font-mono text-[10px] text-signal-500">workspace</span>
      </Link>

      <nav className="flex flex-row gap-0.5 overflow-x-auto md:flex-col">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-link whitespace-nowrap", active && "nav-link-active")}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-paper" : "text-signal-500",
                )}
                strokeWidth={1.8}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden flex-1 md:block" />

      <div className="panel p-2.5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] text-signal-500">account attivo</p>
          <span className="h-1.5 w-1.5 rounded-full bg-signal-500" />
        </div>
        <select
          value={currentId ?? ""}
          onChange={(event) => setCurrentId(event.target.value)}
          aria-label="Account GitHub attivo"
          className="input-base !py-1.5 !pl-2 !pr-7 !text-[12px]"
        >
          {accounts.length === 0 ? <option value="">Nessun account</option> : null}
          {accounts.map((account) => (
            <option key={account.id} value={account.id} className="bg-ink-900 text-signal-200">
              {account.label || account.login}
            </option>
          ))}
        </select>
        <Link
          href="/accounts"
          className="mt-1.5 flex items-center justify-center rounded py-1 font-mono text-[10.5px] text-signal-500 transition-colors hover:text-paper"
        >
          gestisci account
        </Link>
      </div>

      <div className="panel flex items-center gap-2.5 p-2">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.login}
            className="h-8 w-8 rounded-full ring-1 ring-white/15"
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-signal-600 text-[10.5px] font-medium text-paper">
            {user.login.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-paper">
            {user.name || user.login}
          </p>
          <p className="truncate font-mono text-[10px] text-signal-500">@{user.login}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title="Esci"
            aria-label="Esci"
            className="grid h-7 w-7 place-items-center rounded text-signal-500 transition-colors hover:bg-white/[0.06] hover:text-paper"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </aside>
  );
}
