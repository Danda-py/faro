"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "border border-transparent bg-paper text-ink-950 hover:bg-white active:bg-signal-100",
  ghost:
    "border border-white/15 bg-transparent text-signal-200 hover:border-white/30 hover:text-paper active:bg-white/[0.04]",
  danger:
    "border border-rose-400/30 bg-transparent text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/10",
  subtle:
    "border border-transparent text-signal-400 hover:bg-white/[0.05] hover:text-paper",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12.5px] rounded gap-1.5",
  md: "h-10 px-4 text-[13.5px] rounded gap-2",
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
        "inline-flex select-none items-center justify-center font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
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
        "flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.07] pb-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1
          className={cn(
            "flex items-center gap-2.5 text-[24px] font-medium leading-tight tracking-[-0.02em] text-paper",
            eyebrow ? "mt-1.5" : "",
          )}
        >
          {icon ? <span className="shrink-0 text-signal-400">{icon}</span> : null}
          <span className="min-w-0">{title}</span>
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-signal-400">
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
      {hint ? <span className="mt-1.5 block text-[11.5px] text-signal-500">{hint}</span> : null}
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
      box: "border-rose-400/25 bg-rose-500/[0.06] text-rose-100",
      icon: "text-rose-300",
      Icon: AlertCircle,
    },
    success: {
      box: "border-emerald-400/25 bg-emerald-500/[0.05] text-emerald-50",
      icon: "text-emerald-300",
      Icon: CheckCircle2,
    },
    info: {
      box: "border-white/[0.12] bg-white/[0.03] text-signal-200",
      icon: "text-signal-400",
      Icon: Info,
    },
  } as const;

  const { box, icon, Icon } = tones[tone];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded border px-3 py-2 text-[12.5px] leading-relaxed",
        box,
      )}
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", icon)} />
      <span>{children}</span>
    </div>
  );
}
