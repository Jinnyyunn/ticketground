import Image from "next/image";
import Link from "next/link";
import { TicketgroundTag } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import { FeaturedCard, GradientPoster, Movement, SectionHead } from "./home-cards";
import { events, featuredShow, genreRecommendations, miniShows, rankings, shortcuts, ticketOpens } from "./home-content";
import { TicketOpenAlertAction } from "./ticket-open-alert-action";

const editorialCardTone = {
  dark: {
    card: "border-ink bg-ink text-on-ink shadow-ticket-2",
    accent: null,
    eyebrow: "border-white/15 bg-white/10 text-on-ink/75",
    index: "border-white/15 text-on-ink/55",
    cta: "border-white/15 bg-white/10 text-on-ink group-hover:bg-card group-hover:text-ink",
  },
  red: {
    card: "border-ticketground bg-ticketground text-white shadow-ticket-2 hover:border-ticketground hover:bg-ticketground/95",
    accent: null,
    eyebrow: "border-white/25 bg-white/15 text-white",
    index: "border-white/20 text-white/75",
    cta: "border-white/20 bg-card text-ink group-hover:border-white group-hover:bg-ink group-hover:text-on-ink",
  },
  cream: {
    card: "border-accent-2 bg-accent-2 text-on-accent-2 shadow-ticket-2 hover:border-accent-2 hover:bg-accent-2/90",
    accent: null,
    eyebrow: "border-on-accent-2/10 bg-white/35 text-on-accent-2",
    index: "border-on-accent-2/10 bg-white/25 text-on-accent-2/65",
    cta: "border-on-accent-2/10 bg-white/55 text-on-accent-2 group-hover:border-on-accent-2 group-hover:bg-on-accent-2 group-hover:text-white",
  },
} as const;

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
            href={item.href}
            key={item.rank}
            className="group grid min-w-0 grid-cols-[48px_72px_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-card p-3 transition-shadow hover:shadow-ticket-2 focus-visible:ring-3 focus-visible:ring-ring/50 lg:grid-cols-1"
          >
            <span className="rnum text-5xl font-black leading-none text-ink group-hover:text-ticketground">{item.rank}</span>
            <GradientPoster title={item.title} gradient={item.gradient} poster={item.poster} fit={item.posterFit} className="w-[72px] lg:w-full" />
            <div className="min-w-0 lg:mt-2">
              <h3 className="balanced-title clamp-2 text-xs font-black leading-snug text-ink-2 group-hover:underline">{item.title}</h3>
              <p className="clamp-1 mt-1 text-sm text-ink-3">{item.venue}</p>
              <p className="mt-1 text-sm text-ink-4">{item.date}</p>
              <p className="mt-2 text-sm font-black"><Movement movement={item.movement} delta={item.delta} /></p>
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
            className="group grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-surface p-3 shadow-ticket-1 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:bg-card hover:shadow-ticket-2 focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[64px_minmax(0,1fr)]"
          >
            <TicketOpenThumbnail title={item.title} />
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-black text-ticketground">{item.month}월 {item.day}일</p>
                  <p className="mt-1 text-2xl font-black leading-none text-ink">{item.time}</p>
                </div>
                <TicketgroundTag tone="open">{item.dday}</TicketgroundTag>
              </div>
              <h3 className="clamp-2 mt-2 text-sm font-black leading-snug text-ink-2">{item.title}</h3>
              <p className="mt-1 text-xs font-bold text-ink-3">{item.round}</p>
              <TicketOpenAlertAction />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TicketOpenThumbnail({ title }: { readonly title: string }) {
  const show = rankings.find((item) => title.includes(item.title) || item.title.includes(title));
  const poster = show?.poster ?? featuredShow.poster;

  return (
    <span
      className="relative block h-[75px] w-14 overflow-hidden rounded-md border border-line bg-card shadow-ticket-1 sm:h-[85px] sm:w-16"
      data-ticket-open-thumbnail
      aria-hidden="true"
    >
      <Image
        src={poster}
        alt=""
        fill
        sizes="64px"
        className={cn("object-cover transition-transform duration-300 group-hover:scale-[1.03]", show?.posterFit === "contain" && "object-contain")}
        unoptimized={poster.endsWith(".gif")}
      />
    </span>
  );
}

export function OfficialResaleSection() {
  return (
    <section data-section="official-resale" className="ticketground-container mt-16">
      <SectionHead title="공식 재판매·양도" subtitle="보유 티켓은 플랫폼 안에서만 안전하게 이동합니다." moreHref="/resale" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Link
          href="/resale"
          className="group relative isolate min-w-0 overflow-hidden rounded-lg border border-ink bg-ink p-5 text-on-ink shadow-ticket-2 transition-transform before:absolute before:-right-24 before:-top-24 before:size-56 before:rounded-full before:bg-white/10 before:blur-2xl hover:-translate-y-0.5 hover:shadow-ticket-3 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6"
        >
          <div className="relative z-10">
          <p className="text-sm font-black text-on-ink/60">CLEAN TICKET POOL</p>
          <h3 className="balanced-title mt-3 text-[24px] font-black leading-tight sm:text-[30px]">공식 재판매</h3>
          <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-on-ink/75 sm:text-base">
            정가 범위와 구매 이력 검증을 통과한 티켓만 풀에 등록됩니다. 외부 직거래 없이 예매 내역과 결제 기록이 함께 보존됩니다.
          </p>
          <span className="mt-5 inline-flex h-10 items-center rounded-lg bg-background px-4 text-sm font-black text-ink transition-colors group-hover:bg-ticketground group-hover:text-white">
            공식 풀 보기
          </span>
          </div>
        </Link>
        <div className="grid gap-3">
          {[
            ["보유 티켓 확인", "마이페이지 예매 내역에서 양도 가능한 좌석을 확인합니다."],
            ["정책 자동 판별", "공식 재판매 또는 동반자 양도 흐름으로 안전하게 연결합니다."],
            ["QR 보호", "현장 입장 QR은 앱 본인 기기에서만 활성화됩니다."],
          ].map(([title, description], index) => (
            <div key={title} className="group relative overflow-hidden rounded-lg border border-line bg-card p-4 pl-5 shadow-ticket-1 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-ticket-2">
              <span className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-ink" aria-hidden="true" />
              <span className="absolute right-4 top-4 text-xs font-black text-ink-4" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="pr-10 text-base font-black text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-3">{description}</p>
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
      <SectionHead title="기획전" subtitle="공연을 고르는 기준이 분명한 큐레이션입니다." moreHref="/event/ticketground-day" />
      <div className="grid gap-4 md:grid-cols-3">
        {events.map((event, index) => {
          const tone = editorialCardTone[event.tone];

          return (
            <Link
              href={event.href}
              key={event.title}
              data-card="editorial-event"
              className={cn(
                "group relative min-h-[220px] overflow-hidden rounded-lg border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-ticket-3 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6",
                tone.card,
              )}
            >
              {tone.accent && <span data-card-accent className={cn("absolute inset-x-0 top-0 h-1", tone.accent)} aria-hidden="true" />}
              <span className="absolute bottom-5 right-5 h-16 w-16 rounded-lg border border-current opacity-10" aria-hidden="true" />
              <span className="absolute right-5 top-16 text-7xl font-black leading-none opacity-10" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="relative z-10 flex h-full min-h-[178px] flex-col">
                <div className="flex items-center justify-between gap-3">
                  <p className={cn("inline-flex h-7 items-center rounded-lg border px-3 text-xs font-black tracking-normal", tone.eyebrow)}>
                    EDITORIAL
                  </p>
                  <span className={cn("inline-flex h-8 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-black", tone.index)}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="balanced-title mt-7 text-3xl font-black leading-tight sm:text-4xl">{event.title}</h3>
                <p className="mt-4 text-base leading-loose opacity-85">{event.description}</p>
                <span className={cn("mt-auto inline-flex h-9 w-fit items-center rounded-lg border px-3 text-sm font-black transition-colors", tone.cta)}>
                  기획전 보기 <span className="ml-1" aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function GenreRecommendationsSection() {
  return (
    <section data-section="genre-recommendations" className="ticketground-container mt-16">
      <SectionHead title="장르별 추천" subtitle="콘서트·뮤지컬·연극·클래식을 비교하세요." moreHref="/contents/genre" />
      <div className="grid gap-10">
        {genreRecommendations.map((group) => (
          <div key={group.title}>
            <h3 className="mb-4 text-2xl font-black text-ink">{group.title}</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {group.items.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  data-card="genre-recommendation"
                  className="group block min-w-0 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <GradientPoster title={item.title} gradient={item.gradient} poster={item.poster} fit={item.posterFit} />
                  <h4 className="clamp-2 mt-3 text-sm font-black leading-snug text-ink-2 group-hover:underline sm:text-base">{item.title}</h4>
                  <p className="clamp-1 mt-1 text-sm text-ink-3">{item.venue}</p>
                  <p className="mt-1 text-sm text-ink-4">{item.date}</p>
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
      <SectionHead title="바로가기" moreHref="/contents/shortcuts" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {shortcuts.map((shortcut) => (
          <Link
            href={shortcut.href}
            key={shortcut.label}
            data-card="shortcut"
            className="min-w-0 rounded-lg border border-line bg-card p-4 text-center transition-colors hover:border-ink hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <strong className="block text-lg font-black text-ink">{shortcut.label}</strong>
            <span className="mt-1 block text-sm text-ink-3">{shortcut.helper}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
