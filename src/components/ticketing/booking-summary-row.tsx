import { cn } from "@/lib/utils";

export function BookingSummaryRow({
  label,
  strong,
  total,
  value,
}: {
  readonly label: string;
  readonly strong?: boolean;
  readonly total?: boolean;
  readonly value: string;
}) {
  if (total) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg bg-tint-red px-4 py-3.5">
        <dt className="text-sm font-bold text-ink-3">{label}</dt>
        <dd className="min-w-0 text-right text-2xl font-black text-ticketground">{value}</dd>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("min-w-0 text-right font-bold text-ink", strong && "text-lg")}>{value}</dd>
    </div>
  );
}
