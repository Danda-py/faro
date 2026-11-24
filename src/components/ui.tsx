"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "border border-indigo-400/20 bg-indigo-500/90 text-white shadow-[0_8px_28px_-14px_rgba(99,102,241,0.8)] hover:bg-indigo-400",
  ghost: "border border-white/10 bg-white/[0.045] text-zinc-200 hover:border-white/15 hover:bg-white/[0.08]",
  danger:
    "border border-rose-400/20 bg-rose-500/10 text-rose-200 hover:border-rose-400/35 hover:bg-rose-500/20",
  subtle: "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-lg gap-1.5",
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
        "inline-flex select-none items-center justify-center font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
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
    error: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    success: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    info: "border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  } as const;

  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
