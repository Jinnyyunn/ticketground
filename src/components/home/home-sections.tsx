import Link from "next/link";
import { TicketgroundTag } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import { FeaturedCard, GradientPoster, Movement, SectionHead } from "./home-cards";
import { events, featuredShow, genreRecommendations, miniShows, rankings, shortcuts, ticketOpens } from "./home-content";

export function HomeHeroSection() {
  return (
    <section data-section="spec-hero" className="ticketground-container grid gap-5 pt-8 lg:grid-cols-[1.55fr_1fr]">
      <FeaturedCard show={featuredShow} size="large" />
      <div className="grid gap-5">
        {miniShows.map((show) => (
          <FeaturedCard key={show.title} show={show} size="mini" />
        ))}
      </div>
    </section>
  );
}

export function RealtimeTop10Section() {
  return (
    <section data-section="realtime-top10" className="ticketground-container mt-16">
      <SectionHead title="실시간 예매 랭킹 TOP10" subtitle="지금 가장 빠르게 움직이는 공연입니다." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {rankings.map((item) => (
          <Link
            href="/contents/ranking"
            key={item.rank}
            className="group grid min-w-0 grid-cols-[48px_72px_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-white p-3 transition-shadow hover:shadow-ticket-2 focus-visible:ring-3 focus-visible:ring-ring/50 lg:grid-cols-1"
          >
            <span className="rnum text-[37px] font-black leading-none text-ink group-hover:text-ticketground">{item.rank}</span>
            <GradientPoster title={item.title} gradient={item.gradient} poster={item.poster} fit={item.posterFit} className="w-[72px] lg:w-full" />
            <div className="min-w-0 lg:mt-2">
              <h3 className="balanced-title clamp-2 text-[12px] font-black leading-snug text-ink-2 group-hover:underline">{item.title}</h3>
              <p className="clamp-1 mt-1 text-[13px] text-ink-3">{item.venue}</p>
              <p className="mt-1 text-[13px] text-ink-4">{item.date}</p>
              <p className="mt-2 text-[13px] font-black"><Movement movement={item.movement} delta={item.delta} /></p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function TicketOpenSection() {
  return (
    <section data-section="ticket-open" className="ticketground-container mt-16">
      <SectionHead title="티켓오픈 예정" subtitle="오픈 시간과 회차를 확인하고 알림을 준비하세요." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ticketOpens.map((item) => (
          <Link
            href="/open"
            key={`${item.month}.${item.day}-${item.title}`}
            data-card="ticket-open"
            className="rounded-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-black text-ticketground">{item.month}월</p>
                <p className="text-[50px] font-black leading-none text-ink">{item.day}</p>
              </div>
              <TicketgroundTag tone="open">{item.dday}</TicketgroundTag>
            </div>
            <p className="mt-4 text-[20px] font-black text-ink">{item.time}</p>
            <h3 className="clamp-2 mt-2 text-[16px] font-black leading-snug text-ink-2">{item.title}</h3>
            <p className="mt-2 text-[13px] text-ink-3">{item.round}</p>
            <span className="mt-5 inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-[13px] font-black text-ink">알림 설정</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function EditorialEventsSection() {
  return (
    <section data-section="editorial-events" className="ticketground-container mt-16">
      <SectionHead title="기획전" subtitle="공연을 고르는 기준이 분명한 큐레이션입니다." />
      <div className="grid gap-4 md:grid-cols-3">
        {events.map((event) => (
          <Link
            href={event.href}
            key={event.title}
            data-card="editorial-event"
            className={cn(
              "min-h-[210px] rounded-xl border p-6 transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
              event.tone === "dark" && "border-ink bg-ink text-white",
              event.tone === "red" && "border-ticketground bg-tint-red text-ink",
              event.tone === "cream" && "border-accent-2 bg-tint-yellow text-ink",
            )}
          >
            <p className="text-[13px] font-black opacity-75">EDITORIAL</p>
            <h3 className="balanced-title mt-8 text-[24px] font-black leading-tight sm:text-[28px]">{event.title}</h3>
            <p className="mt-4 text-[15px] leading-loose opacity-85">{event.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function GenreRecommendationsSection() {
  return (
    <section data-section="genre-recommendations" className="ticketground-container mt-16">
      <SectionHead title="장르별 추천" subtitle="콘서트, 뮤지컬, 연극·클래식을 같은 밀도로 비교하세요." />
      <div className="grid gap-10">
        {genreRecommendations.map((group) => (
          <div key={group.title}>
            <h3 className="mb-4 text-[20px] font-black text-ink">{group.title}</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {group.items.map((item) => (
                <Link
                  key={item.title}
                  href="/goods/dracula"
                  data-card="genre-recommendation"
                  className="group block min-w-0 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <GradientPoster title={item.title} gradient={item.gradient} poster={item.poster} fit={item.posterFit} />
                  <h4 className="clamp-2 mt-3 text-[13px] font-black leading-snug text-ink-2 group-hover:underline sm:text-[15px]">{item.title}</h4>
                  <p className="clamp-1 mt-1 text-[13px] text-ink-3">{item.venue}</p>
                  <p className="mt-1 text-[13px] text-ink-4">{item.date}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShortcutsSection() {
  return (
    <section data-section="shortcuts" className="ticketground-container my-16">
      <SectionHead title="바로가기" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {shortcuts.map((shortcut) => (
          <Link
            href={shortcut.href}
            key={shortcut.label}
            data-card="shortcut"
            className="min-w-0 rounded-lg border border-line bg-white p-4 text-center transition-colors hover:border-ink hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <strong className="block text-[16px] font-black text-ink">{shortcut.label}</strong>
            <span className="mt-1 block text-[13px] text-ink-3">{shortcut.helper}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
