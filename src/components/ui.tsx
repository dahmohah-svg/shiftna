import type { ComponentProps, ReactNode } from "react";

// Shared styles. Spacing uses logical properties (ms/me/ps/pe, start/end)
// so every screen flips correctly between Arabic and English.

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-ink-muted/60 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60";

export const buttonClass = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-200 bg-surface px-4 py-2.5 font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-surface px-4 py-2.5 font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2 font-medium text-ink-muted hover:bg-line/50",
};

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-surface p-4 ${className}`}
    >
      {children}
    </section>
  );
}

export function PageTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pb-4">
      <h1 className="text-2xl font-extrabold text-ink">{children}</h1>
      {action}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="pb-2 text-lg font-bold text-ink">{children}</h2>;
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${inputClass} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  ...props
}: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2">
      <input type="checkbox" className="h-5 w-5 accent-brand-600" {...props} />
      <span className="text-sm font-medium text-ink">{label}</span>
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warn" | "danger" | "success" | "gold" | "silver";
}) {
  const tones = {
    neutral: "bg-line/60 text-ink-muted",
    brand: "bg-brand-50 text-brand-700",
    warn: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
    gold: "bg-amber-100 text-amber-900",
    silver: "bg-slate-200 text-slate-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "warn" | "danger" | "success";
}) {
  const tones = {
    brand: "border-brand-100 bg-brand-50 text-brand-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-xl border px-3 py-2.5 text-sm leading-relaxed ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
      <p>{children}</p>
      {action}
    </div>
  );
}

export function DetailRow({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-end text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}
