"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Eraser,
  Github,
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
    <aside className="glass flex w-full flex-col gap-6 p-4 md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:w-64 md:shrink-0">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-1.5 pt-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
          <Github className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">
          Faro<span className="text-violet-400">.</span>
        </span>
      </Link>

      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-link whitespace-nowrap", active && "nav-link-active")}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden flex-1 md:block" />

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="label-base mb-2 !text-[10px]">Account attivo</p>
        <select
          value={currentId ?? ""}
          onChange={(event) => setCurrentId(event.target.value)}
          className="input-base !py-2 !text-[13px]"
        >
          {accounts.length === 0 ? <option value="">Nessun account</option> : null}
          {accounts.map((account) => (
            <option key={account.id} value={account.id} className="bg-white text-slate-800">
              {account.label || account.login}
            </option>
          ))}
        </select>
        <Link
          href="/accounts"
          className="mt-2 block text-center text-[11px] text-zinc-500 transition hover:text-violet-300"
        >
          Gestisci account
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.login}
            className="h-8 w-8 rounded-full ring-1 ring-white/15"
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs">
            {user.login.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-zinc-200">
            {user.name || user.login}
          </p>
          <p className="truncate text-[11px] text-zinc-500">@{user.login}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title="Esci"
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
