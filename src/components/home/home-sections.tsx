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
      <SectionHead title="실시간 예매 랭킹 TOP10" subtitle="지금 가장 빠르게 움직이는 공연입니다." moreHref="/contents/ranking" />
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
      <SectionHead title="티켓오픈 예정" subtitle="오픈 시간과 회차를 확인하고 알림을 준비하세요." moreHref="/open" />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {ticketOpens.map((item) => (
          <Link
            href="/open"
            key={`${item.month}.${item.day}-${item.title}`}
            data-card="ticket-open"
            className="rounded-lg border border-line bg-surface p-[10px] transition-colors hover:border-line-strong hover:bg-white focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-black text-ticketground sm:text-[13px]">{item.month}월</p>
                <p className="text-[32px] font-black leading-none text-ink sm:text-[50px]">{item.day}</p>
              </div>
              <TicketgroundTag tone="open">{item.dday}</TicketgroundTag>
            </div>
            <p className="mt-2 text-[15px] font-black text-ink sm:mt-4 sm:text-[20px]">{item.time}</p>
            <h3 className="clamp-2 mt-1 text-[14px] font-black leading-snug text-ink-2 sm:mt-2 sm:text-[16px]">{item.title}</h3>
            <p className="mt-1 text-[12px] text-ink-3 sm:mt-2 sm:text-[13px]">{item.round}</p>
            <span className="mt-2 inline-flex h-7 items-center rounded-lg border border-line bg-white px-3 text-[12px] font-black text-ink sm:mt-5 sm:h-9 sm:text-[13px]">알림 설정</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function OfficialResaleSection() {
  return (
    <section data-section="official-resale" className="ticketground-container mt-16">
      <SectionHead title="공식 재판매·양도" subtitle="보유 티켓은 플랫폼 안에서만 안전하게 이동합니다." moreHref="/resale" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Link
          href="/resale"
          className="group min-w-0 rounded-lg border border-line bg-ink p-5 text-white transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6"
        >
          <p className="text-[13px] font-black text-white/60">CLEAN TICKET POOL</p>
          <h3 className="balanced-title mt-3 text-[24px] font-black leading-tight sm:text-[30px]">공식 재판매</h3>
          <p className="mt-3 max-w-[560px] text-[14px] leading-relaxed text-white/75 sm:text-[15px]">
            정가 범위와 구매 이력 검증을 통과한 티켓만 풀에 등록됩니다. 외부 직거래 없이 예매 내역과 결제 기록이 함께 보존됩니다.
          </p>
          <span className="mt-5 inline-flex h-10 items-center rounded-lg bg-white px-4 text-[14px] font-black text-ink transition-colors group-hover:bg-ticketground group-hover:text-white">
            공식 풀 보기
          </span>
        </Link>
        <div className="grid gap-3">
          {[
            ["보유 티켓 확인", "마이페이지 예매 내역에서 양도 가능한 좌석을 확인합니다."],
            ["정책 자동 판별", "공식 재판매 또는 동반자 양도 흐름으로 안전하게 연결합니다."],
            ["QR 보호", "현장 입장 QR은 앱 본인 기기에서만 활성화됩니다."],
          ].map(([title, description]) => (
            <div key={title} className="rounded-lg border border-line bg-surface p-4">
              <h3 className="text-[15px] font-black text-ink">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{description}</p>
            </div>
          ))}
        </div>
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
      <SectionHead title="장르별 추천" subtitle="콘서트·뮤지컬·연극·클래식을 비교하세요." />
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
