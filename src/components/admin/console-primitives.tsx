import type { ReactNode } from "react";
import type {
  AccountsWorkspace,
  AdminTicket,
  CatalogWorkspace,
  Feedback,
  InventoryWorkspace,
  SellerApplicationsWorkspace,
  SellerEventsWorkspace,
  SupportWorkspace,
  WorkspaceData,
} from "./console-types";

export function money(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function valueFromForm(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function valuesFromForm(form: HTMLFormElement, name: string): string[] {
  return new FormData(form).getAll(name).flatMap((value) => typeof value === "string" && value.trim() ? [value.trim()] : []);
}

export function hasEvents(data: WorkspaceData | null): data is CatalogWorkspace {
  return Boolean(data && "events" in data && "venues" in data);
}

export function hasTickets(data: WorkspaceData | null): data is InventoryWorkspace {
  return Boolean(data && "tickets" in data);
}

export function hasUsers(data: WorkspaceData | null): data is AccountsWorkspace {
  return Boolean(data && "users" in data);
}

export function hasSupportThreads(data: WorkspaceData | null): data is SupportWorkspace {
  return Boolean(data && "supportThreads" in data);
}

export function hasSellerApplications(data: WorkspaceData | null): data is SellerApplicationsWorkspace {
  return Boolean(data && "applications" in data);
}

export function hasSellerEvents(data: WorkspaceData | null): data is SellerEventsWorkspace {
  return Boolean(data && "events" in data && !("venues" in data));
}

export function Notice({ feedback }: { readonly feedback: Feedback }) {
  if (!feedback) return null;
  const tone = feedback.tone === "success" ? "bg-surface text-ok" : "bg-background text-ticketground";
  return <p aria-live="polite" className={`rounded-lg border border-line px-3 py-2 text-sm font-bold ${tone}`}>{feedback.message}</p>;
}

export function WorkspacePanel({ children }: { readonly children: ReactNode }) {
  return <section className="min-w-0 rounded-lg border border-line bg-background p-4">{children}</section>;
}

type FieldProps = {
  readonly label: string;
  readonly name: string;
  readonly defaultValue?: string | number;
  readonly placeholder?: string;
  readonly type?: string;
  readonly required?: boolean;
};

export function Field({ label, name, defaultValue, placeholder, type = "text", required = false }: FieldProps) {
  return (
    <label className="grid gap-1 text-sm font-bold text-ink-3">
      {label}
      <input aria-required={required} className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={defaultValue} name={name} placeholder={placeholder} type={type} />
    </label>
  );
}

type TextareaFieldProps = {
  readonly label: string;
  readonly name: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly rows?: number;
};

export function TextareaField({ label, name, defaultValue, placeholder, hint, rows = 4 }: TextareaFieldProps) {
  return (
    <label className="grid gap-1 text-sm font-bold text-ink-3">
      {label}
      <textarea className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink" defaultValue={defaultValue} name={name} placeholder={placeholder} rows={rows} />
      {hint && <span className="text-xs font-bold text-ink-4">{hint}</span>}
    </label>
  );
}

type SelectFieldProps = {
  readonly label: string;
  readonly name: string;
  readonly defaultValue?: string;
  readonly options: readonly { readonly label: string; readonly value: string }[];
};

export function SelectField({ label, name, defaultValue, options }: SelectFieldProps) {
  return (
    <label className="grid gap-1 text-sm font-bold text-ink-3">
      {label}
      <select className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={defaultValue} name={name}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function Stat({ label, value, tone = "default" }: { readonly label: string; readonly value: string; readonly tone?: "default" | "ok" | "warn" }) {
  const toneClass = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink";
  return <div className="border-l border-line px-3 py-3 first:border-l-0"><p className="text-xs font-bold text-ink-3">{label}</p><strong className={`mt-1 block text-2xl font-black ${toneClass}`}>{value}</strong></div>;
}

export function visibleUnownedTickets(data: WorkspaceData | null): readonly AdminTicket[] {
  return hasTickets(data) ? data.tickets.filter((ticket) => !ticket.ownerId).slice(0, 8) : [];
}
