import { ticketgroundPlay, playTabs } from "@/data/content";
import { CarouselRow } from "@/components/carousel-row";
import { PillTabs } from "@/components/pill-tabs";
import { SectionHeading } from "@/components/section-heading";

export function TicketgroundPlay() {
  return (
    <section className="ticketground-container mt-[80px]">
      <SectionHeading>Ticketground PLAY</SectionHeading>
      <PillTabs tabs={playTabs} className="mt-7" />
      <div className="mt-9">
        <CarouselRow>
          {ticketgroundPlay.map((v) => (
            <a key={v.title} href="#" className="block w-[413px] shrink-0">
              <div className="relative overflow-hidden rounded-2xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumb} alt={v.title} className="aspect-video w-full object-cover opacity-90" />
                <span className="absolute left-3 top-3 rounded-md bg-black/55 px-2 py-1 text-[12px] font-bold text-white">
                  Ticketground
                </span>
                <span className="absolute left-1/2 top-1/2 flex size-[54px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-[#ff0000]">
                  <svg viewBox="0 0 24 24" fill="#fff" className="ml-0.5 size-7">
                    <path d="M8 5v14l11-7L8 5Z" />
                  </svg>
                </span>
                {v.duration && (
                  <span className="absolute bottom-3 right-3 rounded bg-black/70 px-1.5 py-0.5 text-[12px] font-medium text-white">
                    {v.duration}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.poster} alt="" className="h-12 w-[38px] rounded-md object-cover" />
                <h3 className="text-[16px] font-bold text-[#29292d]">{v.title}</h3>
              </div>
            </a>
          ))}
        </CarouselRow>
      </div>
    </section>
  );
}
