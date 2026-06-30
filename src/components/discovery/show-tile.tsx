import Link from "next/link";
import type { TicketShow } from "@/types";
import { currency } from "@/data/ticketing";
import { cn } from "@/lib/utils";

type ShowTileProps = {
  readonly show: TicketShow;
  readonly compact?: boolean;
};

export function ShowTile({ show, compact = false }: ShowTileProps) {
  const lowestPrice = Math.min(...show.prices.map((price) => price.price));

  return (
    <Link
      href={`/goods/${show.slug}`}
      className={cn(
        "group grid min-w-0 rounded-lg border border-line bg-white transition hover:border-line-strong hover:shadow-ticket-2 focus-visible:ring-3 focus-visible:ring-ring/50",
        compact ? "grid-cols-[52px_1fr] gap-2 p-2" : "gap-4 p-4 xl:grid-cols-[120px_1fr]",
      )}
    >
      <div className="relative">
        <img
          src={show.poster}
          alt={show.title}
          className={cn("aspect-[3/4] w-full rounded-lg bg-surface-2 object-cover", compact ? "w-[52px]" : "xl:w-[120px]")}
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {show.badge && <span className="rounded bg-tint-red px-2 py-1 text-xs font-black text-ticketground">{show.badge}</span>}
          <span className="text-sm font-black text-ink-3">{show.category}</span>
        </div>
        <h2
          className={cn(
            "mt-2 clamp-2 font-black leading-snug text-ink-2 group-hover:underline",
            compact ? "break-words [overflow-wrap:anywhere] text-[11.5px]" : "balanced-title break-words text-[13px] sm:text-[14px]",
          )}
        >
          {show.title}
        </h2>
        <p className="mt-2 text-sm text-ink-3">{show.venue}</p>
        <p className="mt-1 text-sm text-ink-4">{show.period}</p>
        {!compact && <p className="mt-3 clamp-2 text-sm leading-relaxed text-ink-3">{show.summary}</p>}
        <p className="mt-3 text-base font-black text-ink">최저 {currency(lowestPrice)}</p>
      </div>
    </Link>
  );
}
