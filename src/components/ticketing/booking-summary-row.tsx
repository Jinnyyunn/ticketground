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
  return (
    <div className={cn("flex justify-between gap-4", total && "border-t border-line pt-4")}>
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn("min-w-0 text-right font-bold text-ink", strong && "text-[16px]", total && "text-[22px] font-black text-ticketground")}>{value}</dd>
    </div>
  );
}
