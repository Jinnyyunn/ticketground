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
                <div className="overflow-hidden rounded-[10px] bg-[#f3f3f3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.poster}
                    alt={d.title}
                    className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-bold text-white ${
                      isFinal ? "bg-[#652cb2]" : "bg-sale"
                    }`}
                  >
                    {isFinal && "✦ "}
                    {d.badge}
                  </span>
                  <span className={`text-[13px] font-bold ${isFinal ? "text-[#652cb2]" : "text-sale"}`}>
                    {d.countdown}
                  </span>
                </div>
                <h3 className="clamp-2 mt-2 text-[15px] font-bold leading-[1.35] text-[#29292d]">{d.title}</h3>
                <p className="clamp-1 mt-1 text-[13px] text-[#7e7e81]">{d.venue}</p>
                <p className="mt-0.5 text-[13px] text-[#b0b0b3]">{d.date}</p>
                <p className="mt-2 text-[14px] font-medium text-ticketground">{d.discountLabel}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[18px] font-bold text-sale">{d.percent}</span>
                  <span className="text-[18px] font-bold text-[#29292d]">{d.price}</span>
                </p>
              </a>
            );
          })}
        </CarouselRow>
      </div>
    </section>
  );
}
