import Image from "next/image";
import { timeDeals } from "@/data/content";
import { CarouselRow } from "@/components/carousel-row";
import { SectionHeading } from "@/components/section-heading";

export function TimeDeal() {
  return (
    <section className="ticketground-container mt-[80px]">
      <SectionHeading>지금 할인중!</SectionHeading>
      <div className="mt-9">
        <CarouselRow>
          {timeDeals.map((d) => {
            const isFinal = d.badge === "파이널콜";
            return (
              <a key={d.title} href="#" className="group block w-[206px] shrink-0">
                <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-surface-2">
                  <Image
                    src={d.poster}
                    alt={d.title}
                    fill
                    sizes="206px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    unoptimized={d.poster.endsWith(".gif")}
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold text-white ${
                      isFinal ? "bg-[#652cb2]" : "bg-sale"
                    }`}
                  >
                    {isFinal && "✦ "}
                    {d.badge}
                  </span>
                  <span className={`text-sm font-bold ${isFinal ? "text-[#652cb2]" : "text-sale"}`}>
                    {d.countdown}
                  </span>
                </div>
                <h3 className="clamp-2 mt-2 text-base font-bold leading-[1.35] text-ink-2">{d.title}</h3>
                <p className="clamp-1 mt-1 text-sm text-ink-3">{d.venue}</p>
                <p className="mt-0.5 text-sm text-ink-4">{d.date}</p>
                <p className="mt-2 text-sm font-medium text-ticketground">{d.discountLabel}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-sale">{d.percent}</span>
                  <span className="text-xl font-bold text-ink-2">{d.price}</span>
                </p>
              </a>
            );
          })}
        </CarouselRow>
      </div>
    </section>
  );
}
