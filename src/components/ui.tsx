"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "border border-indigo-300/25 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_-14px_rgba(99,102,241,0.85)] hover:from-indigo-400 hover:to-indigo-500 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_14px_34px_-14px_rgba(99,102,241,0.95)] active:translate-y-px",
  ghost:
    "border border-white/10 bg-white/[0.045] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/20 hover:bg-white/[0.075] hover:text-white active:translate-y-px",
  danger:
    "border border-rose-400/20 bg-rose-500/10 text-rose-200 hover:border-rose-400/35 hover:bg-rose-500/18 hover:text-rose-100 active:translate-y-px",
  subtle: "border border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[12.5px] rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium tracking-[-0.01em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input-base", className)} />;
}

export function GlassCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("glass", className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "animate-fade-up flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1
          className={cn(
            "flex items-center gap-3 text-[26px] font-semibold leading-tight tracking-[-0.025em] text-zinc-50",
            eyebrow ? "mt-1.5" : "",
          )}
        >
          {icon ? (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-violet-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              {icon}
            </span>
          ) : null}
          <span className="min-w-0">{title}</span>
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-zinc-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-base">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const tones = {
    error: {
      box: "border-rose-400/20 bg-rose-500/[0.08] text-rose-100",
      icon: "text-rose-300",
      Icon: AlertCircle,
    },
    success: {
      box: "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-100",
      icon: "text-emerald-300",
      Icon: CheckCircle2,
    },
    info: {
      box: "border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-50",
      icon: "text-cyan-300",
      Icon: Info,
    },
  } as const;

  const { box, icon, Icon } = tones[tone];

  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed", box)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", icon)} />
      <span>{children}</span>
    </div>
  );
}
