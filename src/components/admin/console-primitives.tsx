import type { ReactNode } from "react";
import { useState } from "react";
import type {
  AccountsWorkspace,
  AdminTicket,
  CatalogWorkspace,
  Feedback,
  GroupBookingWorkspace,
  InventoryWorkspace,
  SellerApplicationsWorkspace,
  SellerEventsWorkspace,
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

export function hasGroupBookingRequests(data: WorkspaceData | null): data is GroupBookingWorkspace {
  return Boolean(data && "requests" in data);
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
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly hint?: string;
};

// `required` drives the real DOM attribute (not just aria-required) so browsers
// stop the submit on the offending field instead of letting it round-trip to
// the server and come back as one generic banner message.
export function Field({ label, name, defaultValue, placeholder, type = "text", required = false, maxLength, min, max, step, hint }: FieldProps) {
  return (
    <label className="grid gap-1 text-sm font-bold text-ink-3">
      {label}
      <input
        aria-required={required}
        className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink"
        defaultValue={defaultValue}
        max={max}
        maxLength={maxLength}
        min={min}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
      {hint && <span className="text-xs font-bold text-ink-4">{hint}</span>}
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
  readonly required?: boolean;
  readonly maxLength?: number;
};

export function TextareaField({ label, name, defaultValue, placeholder, hint, rows = 4, required = false, maxLength }: TextareaFieldProps) {
  const [length, setLength] = useState(defaultValue?.length ?? 0);
  return (
    <label className="grid gap-1 text-sm font-bold text-ink-3">
      {label}
      <textarea
        aria-required={required}
        className="min-h-24 rounded-lg border border-line bg-background p-3 text-sm font-bold text-ink"
        defaultValue={defaultValue}
        maxLength={maxLength}
        name={name}
        onChange={maxLength ? (event) => setLength(event.currentTarget.value.length) : undefined}
        placeholder={placeholder}
        required={required}
        rows={rows}
      />
      <span className="flex justify-between gap-2 text-xs font-bold text-ink-4">
        {hint ? <span>{hint}</span> : <span />}
        {/* Several of these fields are truncated server-side; show the budget so
            the cut never happens silently after save. */}
        {maxLength ? <span className={length >= maxLength ? "text-ticketground" : undefined}>{length}/{maxLength}자</span> : null}
      </span>
    </label>
  );
}

type SelectFieldProps = {
  readonly label: string;
  readonly name: string;
  readonly defaultValue?: string;
  readonly options: readonly { readonly label: string; readonly value: string }[];
  readonly required?: boolean;
};

export function SelectField({ label, name, defaultValue, options, required = false }: SelectFieldProps) {
  return (
    <label className="grid gap-1 text-sm font-bold text-ink-3">
      {label}
      <select aria-required={required} className="h-10 min-w-0 rounded-lg border border-line bg-background px-3 text-sm font-bold text-ink" defaultValue={defaultValue} name={name} required={required}>
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
