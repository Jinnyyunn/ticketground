import Image from "next/image";
import Link from "next/link";
import type { TicketShow } from "@/types";
import { currency } from "@/data/ticketing";

export function ShowCard({ show, compact = false }: { show: TicketShow; compact?: boolean }) {
  const lowestPrice = Math.min(...show.prices.map((price) => price.price));

  return (
    <Link
      href={`/goods/${show.slug}`}
      className="group grid gap-4 rounded-md border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-[0_12px_28px_rgba(30,30,40,0.08)] sm:grid-cols-[120px_1fr]"
    >
      <Image
        src={show.poster}
        alt={show.title}
        width={120}
        height={160}
        className="aspect-[3/4] w-full rounded-sm bg-surface-2 object-cover sm:w-[120px]"
        unoptimized={show.poster.endsWith(".gif")}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {show.badge && (
            <span className="rounded bg-ticketground px-2 py-1 text-xs font-bold text-white">{show.badge}</span>
          )}
          <span className="text-sm font-bold text-ink-3">{show.category}</span>
        </div>
        <h2 className="mt-2 clamp-2 text-xl font-bold leading-[1.35] text-ink-2">{show.title}</h2>
        <p className="mt-2 text-sm text-ink-3">{show.venue}</p>
        <p className="mt-1 text-sm text-ink-4">{show.period}</p>
        {!compact && <p className="mt-3 clamp-2 text-sm leading-[1.6] text-ink-3">{show.summary}</p>}
        <p className="mt-3 text-base font-bold text-ink-2">최저 {currency(lowestPrice)}</p>
      </div>
    </Link>
  );
}
