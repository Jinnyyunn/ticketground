import Image from "next/image";
import Link from "next/link";
import { CalendarClock, Crown, MapPin, RefreshCcw, Theater, Zap } from "lucide-react";
import { CarouselRow } from "@/components/carousel-row";
import { posterGradientClasses } from "@/components/poster-card";
import { currency, getShow } from "@/data/ticketing";
import { cn } from "@/lib/utils";
import { Movement, SectionHead } from "./home-cards";
import { events, featuredShow, genreRecommendations, miniShows, rankings, shortcuts, ticketOpens } from "./home-content";
import { GenreRecommendationsTabs } from "./genre-recommendations-tabs";
import { MiniShowCarousel } from "./mini-show-carousel";
import { TicketOpenAlertAction } from "./ticket-open-alert-action";

const editorialCardTone = {
  dark: {
    card: "border-ink bg-ink text-on-ink shadow-ticket-2",
    accent: null,
    eyebrow: "border-white/15 bg-white/10 text-on-ink/75",
    cta: "border-white/15 bg-white/10 text-on-ink group-hover:bg-card group-hover:text-ink",
  },
  red: {
    card: "border-ticketground bg-ticketground text-white shadow-ticket-2 hover:border-ticketground hover:bg-ticketground/95",
    accent: null,
    eyebrow: "border-white/25 bg-white/15 text-white",
    cta: "border-white/20 bg-card text-ink group-hover:border-white group-hover:bg-ink group-hover:text-on-ink",
  },
  cream: {
    card: "border-accent-2 bg-accent-2 text-on-accent-2 shadow-ticket-2 hover:border-accent-2 hover:bg-accent-2/90",
    accent: null,
    eyebrow: "border-on-accent-2/10 bg-white/35 text-on-accent-2",
    cta: "border-on-accent-2/10 bg-white/55 text-on-accent-2 group-hover:border-on-accent-2 group-hover:bg-on-accent-2 group-hover:text-white",
  },
} as const;

function shortDate(date: string) {
  return date.split(".").slice(1).join(".");
}

export function HomeHeroSection() {
  const featuredSlug = featuredShow.href.replace("/goods/", "");
  const ticketShow = getShow(featuredSlug);
  const lowestPrice = ticketShow?.prices[0];

  return (
    <>
      <section data-section="spec-hero" className="relative isolate min-w-0 overflow-hidden pb-10 pt-8">
        <div
          className="absolute inset-x-0 top-0 -z-10 h-[78%] bg-link"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 82%, 0 100%)" }}
          aria-hidden="true"
        />
        <div className="ticketground-container grid min-w-0 gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-accent-2 px-3.5 py-1.5 text-xs font-black text-ink">
              ⚡ 지금 이 순간, 가장 뜨거운 무대
            </span>
            <h1 className="mt-4 text-[clamp(34px,6vw,64px)] font-black leading-[1.05] text-[#fff2e4]">
              오늘 뜨는 무대,
              <br />
              <span className="text-accent-2">놓치지 마세요</span>
            </h1>
            <p className="mt-4 max-w-[46ch] break-keep text-base font-bold text-[#fff2e4]/90">
              실시간 예매 랭킹으로 지금 가장 화제인 콘서트·뮤지컬·전시를 한눈에. 티켓그라운드가 고른 오늘의 라인업.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/contents/ranking"
                className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ticketground px-6 py-3.5 text-sm font-black text-ink shadow-ticket-pop transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                TOP 10 랭킹 보기 →
              </Link>
              <Link
                href="/contents/search"
                className="inline-flex items-center gap-2 rounded-full border-2 border-[#fff2e4] px-6 py-3.5 text-sm font-black text-[#fff2e4] transition-colors hover:bg-[#fff2e4]/10 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                전체 공연 둘러보기
              </Link>
            </div>
          </div>

          {ticketShow && lowestPrice && (
            <Link
              href={featuredShow.href}
              className="group relative mx-auto block w-full max-w-[360px] rotate-[2.2deg] rounded-[20px] border-[3px] border-ink bg-background p-6 shadow-ticket-pop transition-transform hover:rotate-0 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="inline-block rounded-full bg-ticketground px-3 py-1 text-xs font-black text-ink">
                {ticketShow.badge ?? "단독 선예매"}
              </span>
              <h3 className="mt-3 text-xl font-black leading-tight text-ink">{featuredShow.title}</h3>
              <div className="mt-2.5 flex flex-col gap-1 text-sm font-bold text-ink-2">
                <span>{featuredShow.venue}</span>
                <span>{featuredShow.date}</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-dashed border-line pt-4">
                <p className="font-black text-ink">
                  {lowestPrice.grade}
                  <span className="mt-0.5 block text-xs font-bold text-ink-2">{currency(lowestPrice.price)}</span>
                </p>
                <span className="inline-flex items-center rounded-full border-2 border-ink bg-ticketground px-4 py-2 text-sm font-black text-ink shadow-[3px_3px_0_0_var(--color-ink)] transition-transform group-hover:-translate-y-0.5">
                  예매하기
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>

      <div className="ticketground-container min-w-0">
        <MiniShowCarousel shows={[featuredShow, ...miniShows]} />
      </div>
    </>
  );
}

function RankingCard({ item }: { readonly item: (typeof rankings)[number] }) {
  const slug = item.href.replace("/goods/", "");
  const show = getShow(slug);
  const lowestPrice = show?.prices.length ? Math.min(...show.prices.map((price) => price.price)) : undefined;

  return (
    <Link href={item.href} className="group relative block min-w-0 pt-6 focus-visible:ring-3 focus-visible:ring-ring/50">
      <span
        className="pointer-events-none absolute -top-1 left-0 z-10 text-[42px] leading-none font-black text-background [-webkit-text-stroke:2px_var(--color-ink)] sm:text-[52px]"
        aria-hidden="true"
      >
        {item.rank}
      </span>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-[3px] border-ink bg-surface-2">
        {item.poster ? (
          <Image
            src={item.poster}
            alt=""
            fill
            sizes="(min-width: 1024px) 220px, 45vw"
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-[1.03]",
              item.posterFit === "contain" && "object-contain",
            )}
            loading={item.poster === featuredShow.poster ? "eager" : undefined}
            fetchPriority={item.poster === featuredShow.poster ? "high" : undefined}
            unoptimized={item.poster.endsWith(".gif")}
          />
        ) : (
          <div className={cn("absolute inset-0", posterGradientClasses[item.gradient])} aria-hidden="true" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
        {show && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-black text-ink">
            {show.category}
          </span>
        )}
        <h3 className="balanced-title clamp-2 absolute inset-x-2.5 bottom-2.5 text-sm font-bold leading-snug text-white group-hover:underline">
          {item.title}
        </h3>
      </div>
      <div className="mt-2.5 min-w-0">
        <p className="clamp-1 text-sm font-bold text-ink-3">
          {item.venue} · {shortDate(item.date)}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm font-black text-ink">{lowestPrice !== undefined ? `${currency(lowestPrice)}~` : "가격 안내"}</p>
          <Movement movement={item.movement} delta={item.delta} />
        </div>
      </div>
    </Link>
  );
}

export function RealtimeTop10Section() {
  return (
    <section data-section="realtime-top10" className="ticketground-container mt-16">
      <SectionHead kicker="Live Now" title="실시간 예매 랭킹 TOP10" subtitle="지금 가장 빠르게 움직이는 공연입니다." moreHref="/contents/ranking" />
      <div className="lg:hidden">
        <CarouselRow className="mt-1 pb-1">
          {rankings.map((item) => (
            <div key={item.rank} className="w-[132px] shrink-0 sm:w-[156px]">
              <RankingCard item={item} />
            </div>
          ))}
        </CarouselRow>
      </div>
      <div className="hidden lg:mt-1 lg:grid lg:grid-cols-5 lg:gap-5">
        {rankings.map((item) => (
          <RankingCard key={item.rank} item={item} />
        ))}
      </div>
    </section>
  );
}

export function SectionDivider() {
  return (
    <div className="ticketground-container my-2 min-w-0" aria-hidden="true">
      <div
        className="h-[3px] w-full"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, var(--color-ink) 0 10px, transparent 10px 20px)" }}
      />
    </div>
  );
}

function TicketOpenCard({ item }: { readonly item: (typeof ticketOpens)[number] }) {
  return (
    <Link
      href="/open"
      data-card="ticket-open"
      className="group flex min-w-0 gap-3 rounded-2xl border-[2.5px] border-ink bg-background p-3.5 transition-transform hover:-translate-y-0.5 hover:shadow-ticket-pop focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <TicketOpenThumbnail title={item.title} />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-ticketground px-2.5 py-1 text-[11px] font-black text-ink">{item.dday}</span>
          <p className="shrink-0 text-lg leading-none font-black text-ink">{item.time}</p>
        </div>
        <h3 className="clamp-2 mt-2 text-sm font-black leading-snug text-ink">{item.title}</h3>
        <p className="mt-1 text-xs font-bold text-ink-3">
          {item.round} · {item.month}.{item.day}
        </p>
        <TicketOpenAlertAction />
      </div>
    </Link>
  );
}

export function TicketOpenSection() {
  return (
    <section data-section="ticket-open" className="ticketground-container mt-16">
      <SectionHead kicker="Coming Soon" title="티켓오픈 예정" subtitle="오픈 시간과 회차를 확인하고 알림을 준비하세요." moreHref="/open" />
      <div className="lg:hidden">
        <CarouselRow className="mt-1 pb-1">
          {ticketOpens.map((item) => (
            <div key={`${item.month}.${item.day}-${item.title}`} className="w-[264px] shrink-0">
              <TicketOpenCard item={item} />
            </div>
          ))}
        </CarouselRow>
      </div>
      <div className="hidden lg:mt-1 lg:grid lg:grid-cols-4 lg:gap-4">
        {ticketOpens.map((item) => (
          <TicketOpenCard key={`${item.month}.${item.day}-${item.title}`} item={item} />
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
      className="relative block h-[75px] w-14 shrink-0 overflow-hidden rounded-lg border-2 border-ink bg-card sm:h-[85px] sm:w-16"
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
      <SectionHead kicker="Clean Ticket" title="CLEAN 티켓 공식 양도" subtitle="직거래 사기 걱정 없이, 내 티켓을 안전하게 양도하세요." moreHref="/resale" />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Link
          href="/resale"
          className="group relative isolate min-w-0 overflow-hidden rounded-2xl border-[3px] border-ink bg-ink p-6 text-on-ink shadow-ticket-pop transition-transform hover:-translate-y-0.5 sm:p-8"
        >
          <span className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-link/50 blur-2xl" aria-hidden="true" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-2 px-3 py-1 text-xs font-black text-on-accent-2">
              CLEAN TICKET POOL
            </span>
            <h3 className="mt-4 text-[26px] font-black leading-tight sm:text-[32px]">CLEAN 티켓 공식 양도</h3>
            <p className="mt-3 max-w-[46ch] break-keep text-sm leading-relaxed font-bold text-on-ink/85 sm:text-base">
              정가 범위와 구매 이력 검증을 통과한 티켓만 풀에 등록됩니다. 외부 직거래 없이 예매 내역과 결제 기록이 함께 보존됩니다.
            </p>
            <span className="mt-6 inline-flex h-11 items-center rounded-full border-2 border-ink bg-ticketground px-5 text-sm font-black text-ink shadow-[3px_3px_0_0_#fff2e4] transition-transform group-hover:-translate-y-0.5">
              공식 풀 보기 →
            </span>
          </div>
        </Link>
        <div className="grid content-start gap-5 rounded-2xl border-[2.5px] border-ink bg-card p-6 shadow-ticket-1 sm:p-7">
          <p className="text-sm font-black text-ink-3">3단계 안전 장치</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: "보유 티켓 확인", description: "예매 내역에서 바로 등록" },
              { title: "정책 자동 판별", description: "정가 90~110% 검증" },
              { title: "QR 보호", description: "입장 직전 동적 QR" },
            ].map(({ title, description }, index) => (
              <div key={title} className="grid justify-items-center gap-2 text-center">
                <span className="grid size-11 place-items-center rounded-full bg-ink text-base font-black text-accent-2">{index + 1}</span>
                <p className="clamp-2 text-xs font-black leading-snug text-ink">{title}</p>
                <p className="clamp-2 text-[11px] leading-snug text-ink-4">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorialCard({ event, index }: { readonly event: (typeof events)[number]; readonly index: number }) {
  const tone = editorialCardTone[event.tone];
  return (
    <Link
      href={event.href}
      data-card="editorial-event"
      className={cn(
        "group relative isolate block min-h-[208px] w-full overflow-hidden rounded-2xl border-[3px] p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-ticket-pop focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6",
        tone.card,
      )}
    >
      {tone.accent && <span data-card-accent className={cn("absolute inset-x-0 top-0 h-1", tone.accent)} aria-hidden="true" />}
      <span className="absolute right-5 top-16 text-7xl font-black leading-none opacity-10" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="relative z-10 flex h-full min-h-[166px] flex-col">
        <div className="flex items-center justify-between gap-3">
          <p className={cn("inline-flex h-7 items-center rounded-lg border-2 px-3 text-xs font-black tracking-normal", tone.eyebrow)}>
            EDITORIAL
          </p>
        </div>
        <h3 className="balanced-title mt-7 text-3xl font-black leading-tight sm:text-4xl">{event.title}</h3>
        <span className={cn("mt-8 inline-flex h-9 w-fit items-center rounded-lg border-2 px-3 text-sm font-black transition-colors", tone.cta)}>
          기획전 보기 <span className="ml-1" aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

export function EditorialEventsSection() {
  return (
    <section data-section="editorial-events" className="ticketground-container mt-16">
      <SectionHead kicker="Editorial" title="기획전" subtitle="지금 봐야 할 공연을 에디터가 엄선해 소개합니다." moreHref="/event/ticketground-day" />
      <div className="lg:hidden">
        <CarouselRow className="pb-1">
          {events.map((event, index) => (
            <div key={event.title} className="w-[240px] shrink-0 sm:w-[260px]">
              <EditorialCard event={event} index={index} />
            </div>
          ))}
        </CarouselRow>
      </div>
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-4">
        {events.map((event, index) => (
          <EditorialCard key={event.title} event={event} index={index} />
        ))}
      </div>
    </section>
  );
}

export function GenreRecommendationsSection() {
  return (
    <section data-section="genre-recommendations" className="ticketground-container mt-16">
      <SectionHead kicker="Compare" title="장르별 추천" subtitle="콘서트·뮤지컬·연극·클래식을 비교하세요." moreHref="/contents/genre" />
      <GenreRecommendationsTabs groups={genreRecommendations} />
    </section>
  );
}

const shortcutIcons: Record<string, typeof MapPin> = {
  "지방 공연": MapPin,
  대학로: Theater,
  양도: RefreshCcw,
  VIP석: Crown,
  오픈캘린더: CalendarClock,
  "당일 공연": Zap,
};

function ShortcutCard({ shortcut }: { readonly shortcut: (typeof shortcuts)[number] }) {
  const Icon = shortcutIcons[shortcut.label] ?? MapPin;
  return (
    <Link
      href={shortcut.href}
      data-card="shortcut"
      className="group grid w-full justify-items-center gap-2 rounded-2xl border-[2.5px] border-ink bg-card p-3.5 text-center transition-transform hover:-translate-y-0.5 hover:shadow-ticket-pop focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-11 place-items-center rounded-full bg-ink text-accent-2 transition-colors group-hover:bg-ticketground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <strong className="clamp-1 block text-sm font-black text-ink">{shortcut.label}</strong>
        <span className="clamp-1 mt-0.5 block text-xs text-ink-3">{shortcut.helper}</span>
      </span>
    </Link>
  );
}

export function ShortcutsSection() {
  return (
    <section data-section="shortcuts" className="ticketground-container my-16">
      <SectionHead kicker="Quick Access" title="바로가기" moreHref="/contents/shortcuts" />
      <div className="lg:hidden">
        <CarouselRow className="pb-1">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.label} className="w-[104px] shrink-0">
              <ShortcutCard shortcut={shortcut} />
            </div>
          ))}
        </CarouselRow>
      </div>
      <div className="hidden lg:grid lg:grid-cols-6 lg:gap-3">
        {shortcuts.map((shortcut) => (
          <ShortcutCard key={shortcut.label} shortcut={shortcut} />
        ))}
      </div>
    </section>
  );
}
