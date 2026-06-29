import Link from "next/link";
import type { TicketShow } from "@/types";
import { currency } from "@/data/ticketing";

export function ShowCard({ show, compact = false }: { show: TicketShow; compact?: boolean }) {
  const lowestPrice = Math.min(...show.prices.map((price) => price.price));

  return (
    <Link
      href={`/goods/${show.slug}`}
      className="group grid gap-4 rounded-[10px] border border-[#eee] bg-white p-4 transition hover:border-[#d9dcff] hover:shadow-[0_12px_28px_rgba(30,30,40,0.08)] sm:grid-cols-[120px_1fr]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={show.poster}
        alt={show.title}
        className="aspect-[3/4] w-full rounded-[8px] bg-[#f3f3f3] object-cover sm:w-[120px]"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {show.badge && (
            <span className="rounded bg-[#eef0ff] px-2 py-1 text-[12px] font-bold text-ticketground">{show.badge}</span>
          )}
          <span className="text-[13px] font-bold text-[#7e7e81]">{show.category}</span>
        </div>
        <h2 className="mt-2 clamp-2 text-[18px] font-bold leading-[1.35] text-[#29292d]">{show.title}</h2>
        <p className="mt-2 text-[14px] text-[#666]">{show.venue}</p>
        <p className="mt-1 text-[14px] text-[#9b9b9b]">{show.period}</p>
        {!compact && <p className="mt-3 clamp-2 text-[14px] leading-[1.6] text-[#555]">{show.summary}</p>}
        <p className="mt-3 text-[15px] font-bold text-[#29292d]">최저 {currency(lowestPrice)}</p>
      </div>
    </Link>
  );
}
