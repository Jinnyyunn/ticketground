import type { ChangeEvent, ReactNode } from "react";

export function NumberField({
  label,
  value,
  suffix = "",
  min = 0,
  max = 9999,
  testId,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly suffix?: string;
  readonly min?: number;
  readonly max?: number;
  readonly testId?: string;
  readonly onChange: (value: number) => void;
}) {
  const clamp = (next: number) =>
    onChange(Math.min(max, Math.max(min, Number.isFinite(next) ? next : min)));
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex h-8 items-center overflow-hidden rounded border border-[var(--editor-border)] bg-[var(--editor-surface)]">
        <button type="button" className="w-8 text-[var(--editor-muted)] hover:bg-[var(--editor-hover)]" onClick={() => clamp(value - 1)}>−</button>
        <input
          data-testid={testId}
          aria-label={label}
          type="number"
          className="w-16 text-center outline-none"
          value={value}
          min={min}
          max={max}
          onChange={(event) => clamp(event.currentTarget.valueAsNumber)}
        />
        <span className="pr-2 text-xs text-[var(--editor-muted)]">{suffix}</span>
        <button type="button" className="w-8 text-[var(--editor-muted)] hover:bg-[var(--editor-hover)]" onClick={() => clamp(value + 1)}>＋</button>
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.currentTarget.value);
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--editor-muted)]">{label}</span>
      <input
        aria-label={label}
        className="h-9 w-full rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 outline-none focus:border-[var(--editor-accent)]"
        value={value}
        onChange={change}
      />
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span>{label}</span>
      <span className="flex h-9 items-center gap-2 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-2">
        <input aria-label={label} type="color" className="size-6 cursor-pointer border-0 bg-transparent p-0" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
        <code className="text-xs">{value}</code>
      </span>
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <span>{label}</span>
      <input aria-label={label} type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className="size-4 accent-[var(--editor-accent)]" />
    </label>
  );
}

export function ActionButton({ children, onClick }: { readonly children: ReactNode; readonly onClick: () => void }) {
  return <button type="button" className="flex h-9 items-center justify-center gap-2 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 hover:bg-[var(--editor-hover)]" onClick={onClick}>{children}</button>;
}

export function Defaults({ rows }: { readonly rows: readonly string[] }) {
  return <div className="space-y-2">{rows.map((row) => <p key={row} className="rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] px-3 py-2 text-sm text-[var(--editor-muted)]">{row}</p>)}</div>;
}
