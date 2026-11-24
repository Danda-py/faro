"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
  ghost: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
  subtle: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
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
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  } as const;

  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
