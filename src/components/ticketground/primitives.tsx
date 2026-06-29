"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type TagTone = "open" | "soon" | "sale" | "new" | "error";
type SegmentedControlOption = {
  readonly label: string;
  readonly value: string;
  readonly disabled?: boolean;
};

export function TicketgroundShell({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <div className={cn("shell", className)}>{children}</div>;
}

export function TicketgroundSurface({
  children,
  className,
  tone = "default",
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: "default" | "muted" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-5 transition-colors",
        tone === "default" && "border-line bg-card text-card-foreground",
        tone === "muted" && "border-line bg-surface text-ink-2",
        tone === "error" && "border-destructive/30 bg-tint-red text-destructive",
        className,
      )}
    >
      {children}
    </div>
  );
}

type TicketgroundChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly active?: boolean;
  readonly error?: boolean;
};

export function TicketgroundChip({ children, active = false, error = false, className, type = "button", ...props }: TicketgroundChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      aria-invalid={error}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-4 text-sm font-bold transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        active ? "border-ink bg-ink text-white" : "border-line bg-background text-ink-2 hover:border-line-strong hover:bg-surface",
        error && "border-destructive bg-tint-red text-destructive",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TicketgroundTag({
  children,
  tone = "open",
  className,
}: {
  readonly children: ReactNode;
  readonly tone?: TagTone;
  readonly className?: string;
}) {
  const toneClass = {
    open: "bg-tint-red text-ticketground",
    soon: "bg-ink text-white",
    sale: "bg-accent-2 text-ink",
    new: "bg-ok text-white",
    error: "bg-tint-red text-destructive",
  } satisfies Record<TagTone, string>;

  return <span className={cn("inline-flex rounded px-1.5 py-0.5 text-xs font-bold", toneClass[tone], className)}>{children}</span>;
}

export function MetricCard({
  label,
  value,
  helper,
  tone = "default",
  className,
}: {
  readonly label: string;
  readonly value: string;
  readonly helper?: string;
  readonly tone?: "default" | "accent" | "error";
  readonly className?: string;
}) {
  return (
    <TicketgroundSurface className={cn("grid gap-2", tone === "accent" && "bg-tint-yellow", className)} tone={tone === "error" ? "error" : "default"}>
      <p className="text-sm font-bold text-ink-3">{label}</p>
      <p className="text-3xl font-black text-ink">{value}</p>
      {helper && <p className="text-sm text-ink-3">{helper}</p>}
    </TicketgroundSurface>
  );
}

export function SegmentedControl({
  options,
  value,
  label,
  className,
  onValueChange,
}: {
  readonly options: readonly SegmentedControlOption[];
  readonly value: string;
  readonly label: string;
  readonly className?: string;
  readonly onValueChange?: (value: string) => void;
}) {
  const handleOptionClick = (option: SegmentedControlOption) => {
    if (option.disabled) return;
    onValueChange?.(option.value);
  };

  return (
    <div role="group" aria-label={label} className={cn("inline-flex rounded-full border border-line bg-surface p-1", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => handleOptionClick(option)}
          className={cn(
            "h-9 rounded-full px-4 text-sm font-bold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
            option.value === value ? "bg-ink text-white" : "text-ink-3 hover:bg-background hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SummaryRow({ label, value, strong = false }: { readonly label: string; readonly value: ReactNode; readonly strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3 text-sm last:border-b-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("text-right text-ink-2", strong && "text-lg font-black text-ticketground")}>{value}</dd>
    </div>
  );
}

export function TicketgroundToast({
  title,
  description,
  tone = "default",
}: {
  readonly title: string;
  readonly description?: string;
  readonly tone?: "default" | "success" | "error";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border bg-card p-4 text-sm shadow-ticket-2",
        tone === "success" && "border-ok/30 bg-tint-yellow",
        tone === "error" && "border-destructive/30 bg-tint-red text-destructive",
      )}
    >
      <p className="font-black">{title}</p>
      {description && <p className="mt-1 text-ink-3">{description}</p>}
    </div>
  );
}

export function TicketgroundModal({
  title,
  children,
  open,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly open: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[520px] rounded-xl bg-card p-6 shadow-ticket-3">
        <h2 className="text-2xl font-black text-ink">{title}</h2>
        <div className="mt-4 text-sm leading-loose text-ink-3">{children}</div>
      </section>
    </div>
  );
}

export function QrStateChip({
  children,
  active = false,
  error = false,
}: {
  readonly children: ReactNode;
  readonly active?: boolean;
  readonly error?: boolean;
}) {
  return (
    <TicketgroundChip active={active} error={error} className={cn("h-8 px-3", active && "bg-ok text-white")}>
      {children}
    </TicketgroundChip>
  );
}

export function CleanTicketPolicyBanner({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return (
    <aside className={cn("rounded-xl border border-accent-2 bg-tint-yellow p-5 text-sm leading-loose text-ink", className)}>
      <p className="font-black text-ticketground-strong">클린티켓 정책</p>
      <div className="mt-2">{children}</div>
    </aside>
  );
}
