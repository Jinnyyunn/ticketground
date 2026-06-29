import { openingSoon } from "@/data/content";
import { SectionHeading } from "@/components/section-heading";
import { MoreButton } from "@/components/more-button";

export function OpeningSoon() {
  return (
    <section className="ticketground-container mt-[72px]">
      <SectionHeading>오픈 예정</SectionHeading>
      <div className="mt-9 grid grid-cols-3 gap-x-6 gap-y-5">
        {openingSoon.map((item) => (
          <a
            key={item.title}
            href="#"
            className="flex gap-4 rounded-2xl border border-[#eee] p-3.5 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.poster}
              alt={item.title}
              className="h-[120px] w-[90px] shrink-0 rounded-lg object-cover"
            />
            <div className="flex flex-1 flex-col py-1">
              <p className="text-[15px] font-bold text-ticketground">{item.time}</p>
              <h3 className="clamp-2 mt-1.5 text-[16px] font-bold leading-[1.35] text-[#29292d]">{item.title}</h3>
              <p className="mt-1.5 text-[14px] text-[#7e7e81]">{item.type}</p>
              <div className="mt-auto flex gap-1.5 pt-2">
                {item.hot && (
                  <span className="rounded bg-[#ffeaea] px-1.5 py-0.5 text-[12px] font-bold text-sale">HOT</span>
                )}
                {item.tag && (
                  <span className="rounded bg-[#eef0ff] px-1.5 py-0.5 text-[12px] font-medium text-ticketground">{item.tag}</span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
      <MoreButton className="mt-10">오픈 예정 공연 전체보기</MoreButton>
    </section>
  );
}
