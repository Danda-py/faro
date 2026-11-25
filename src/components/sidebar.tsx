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
    <aside className="glass flex w-full flex-col gap-4 p-3.5 md:sticky md:top-5 md:h-[calc(100vh-2.5rem)] md:w-[272px] md:shrink-0 md:gap-5 md:p-4">
      <Link
        href="/dashboard"
        className="group flex items-center gap-2.5 rounded-xl px-1 py-0.5 transition-colors"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-300 via-indigo-400 to-cyan-300 text-slate-950 shadow-[0_8px_24px_-10px_rgba(129,140,248,0.9),inset_0_1px_0_rgba(255,255,255,0.45)] transition-transform duration-300 group-hover:scale-[1.04]">
          <Github className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-tight tracking-tight text-zinc-50">
            Faro<span className="text-violet-400">.</span>
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-600">
            GitHub workspace
          </span>
        </span>
      </Link>

      <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
        <p className="eyebrow mb-1.5 hidden px-3 md:block">Navigazione</p>
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
                  active ? "text-indigo-200" : "text-zinc-500",
                )}
                strokeWidth={active ? 2.1 : 1.9}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden flex-1 md:block" />

      <div className="panel p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="eyebrow !text-[9.5px] !tracking-[0.18em]">Account attivo</p>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        </div>
        <select
          value={currentId ?? ""}
          onChange={(event) => setCurrentId(event.target.value)}
          aria-label="Account GitHub attivo"
          className="input-base !py-2 !pl-2.5 !pr-8 !text-[12.5px]"
        >
          {accounts.length === 0 ? <option value="">Nessun account</option> : null}
          {accounts.map((account) => (
            <option key={account.id} value={account.id} className="bg-ink-900 text-zinc-200">
              {account.label || account.login}
            </option>
          ))}
        </select>
        <Link
          href="/accounts"
          className="mt-2 flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-zinc-500 transition hover:text-violet-300"
        >
          Gestisci account
        </Link>
      </div>

      <div className="panel flex items-center gap-2.5 p-2.5">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.login}
            className="h-9 w-9 rounded-full p-[1.5px] ring-1 ring-white/15"
            style={{ background: "linear-gradient(135deg, rgba(165,180,252,0.7), rgba(34,211,238,0.5))" }}
          />
        ) : (
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-400/70 to-cyan-300/60 text-[11px] font-semibold text-slate-950">
            {user.login.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-zinc-100">
            {user.name || user.login}
          </p>
          <p className="truncate text-[10.5px] text-zinc-500">@{user.login}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            title="Esci"
            aria-label="Esci"
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
