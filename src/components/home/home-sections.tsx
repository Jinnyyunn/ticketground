import Image from "next/image";
import Link from "next/link";
import { Building2, CalendarClock, ChevronRight, Crown, MapPin, QrCode, RefreshCcw, ShieldCheck, Theater, TicketCheck, Workflow, Zap } from "lucide-react";
import { CarouselRow } from "@/components/carousel-row";
import { TicketgroundTag } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import { GradientPoster, Movement, SectionHead } from "./home-cards";
import { events, featuredShow, genreRecommendations, miniShows, shortcuts, ticketOpenPosters, ticketOpens, type RankingShow } from "./home-content";
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

export function HomeHeroSection() {
  return (
    <section data-section="spec-hero" className="ticketground-container min-w-0 pt-8">
      <MiniShowCarousel shows={[featuredShow, ...miniShows]} />
    </section>
  );
}

function RankingCard({ item }: { readonly item: RankingShow }) {
  return (
    <Link href={item.href} className="group block min-w-0 focus-visible:ring-3 focus-visible:ring-ring/50">
      <span className="rnum block text-4xl font-black leading-none text-ink group-hover:text-ticketground sm:text-5xl">{item.rank}</span>
      <GradientPoster
        title={item.title}
        gradient={item.gradient}
        poster={item.poster}
        fit={item.posterFit}
        className="mt-2 w-full"
        priority={item.poster === featuredShow.poster}
      />
      <div className="mt-2 min-w-0">
        <h3 className="balanced-title clamp-2 text-xs font-black leading-snug text-ink-2 group-hover:underline">{item.title}</h3>
        <p className="clamp-1 mt-1 text-sm text-ink-3">{item.venue}</p>
        <p className="mt-1 text-sm text-ink-4">{item.date}</p>
        <p className="mt-2 text-sm font-black"><Movement movement={item.movement} delta={item.delta} /></p>
      </div>
    </Link>
  );
}

export function RealtimeTop10Section({ items }: { readonly items: readonly RankingShow[] }) {
  return (
    <section data-section="realtime-top10" className="ticketground-container mt-16">
      <SectionHead title="실시간 예매 랭킹 TOP10" subtitle="지금 가장 빠르게 움직이는 공연입니다." moreHref="/contents/ranking" />
      <div className="lg:hidden">
        <CarouselRow className="mt-1 pb-1">
          {items.map((item) => (
            <div key={item.rank} className="w-[112px] shrink-0 sm:w-[136px]">
              <RankingCard item={item} />
            </div>
          ))}
        </CarouselRow>
      </div>
      <div className="hidden lg:mt-1 lg:grid lg:grid-cols-5 lg:gap-4">
        {items.map((item) => (
          <RankingCard key={item.rank} item={item} />
        ))}
      </div>
    </section>
  );
}

function TicketOpenCard({ item }: { readonly item: (typeof ticketOpens)[number] }) {
  return (
    <Link
      href="/open"
      data-card="ticket-open"
      className="group grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-3 rounded-lg border border-line bg-surface p-3 shadow-ticket-1 transition-all hover:-translate-y-0.5 hover:border-line-strong hover:bg-card hover:shadow-ticket-2 focus-visible:ring-3 focus-visible:ring-ring/50"
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
  );
}

export function TicketOpenSection() {
  return (
    <section data-section="ticket-open" className="ticketground-container mt-16">
      <SectionHead title="티켓오픈 예정" subtitle="오픈 시간과 회차를 확인하고 알림을 준비하세요." moreHref="/open" />
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
  const matchedKey = Object.keys(ticketOpenPosters).find((key) => title.includes(key) || key.includes(title));
  const poster = (matchedKey && ticketOpenPosters[matchedKey]) ?? featuredShow.poster;

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
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        unoptimized={poster.endsWith(".gif")}
      />
    </span>
  );
}

export function OfficialResaleSection() {
  return (
    <section data-section="official-resale" className="ticketground-container mt-16">
      <SectionHead
        title="CLEAN 티켓 공식 양도"
        subtitle="직거래 사기 걱정 없이, 내 티켓을 안전하게 양도하세요."
        moreHref="/resale"
        badge="CLEAN TICKET"
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Link
          href="/resale"
          className="group relative isolate min-w-0 overflow-hidden rounded-lg border border-ink bg-ink p-5 text-on-ink shadow-ticket-2 ring-1 ring-accent-2/40 transition-transform before:absolute before:-right-24 before:-top-24 before:size-56 before:rounded-full before:bg-white/10 before:blur-2xl hover:-translate-y-0.5 hover:shadow-ticket-3 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6"
        >
          <div className="relative z-10">
          <p className="flex items-center gap-1.5 text-sm font-black text-on-ink/60">
            <ShieldCheck className="size-3.5 shrink-0 text-accent-2" aria-hidden />
            CLEAN TICKET POOL
          </p>
          <h3 className="balanced-title mt-3 text-[24px] font-black leading-tight sm:text-[30px]">CLEAN 티켓 공식 양도</h3>
          <p className="mt-3 max-w-[560px] break-keep text-sm leading-relaxed text-on-ink/75 sm:text-base">
            정가 범위와 구매 이력 검증을 통과한 티켓만 풀에 등록됩니다. 외부 직거래 없이 예매 내역과 결제 기록이 함께 보존됩니다.
          </p>
          <span className="mt-5 inline-flex h-10 items-center rounded-lg bg-background px-4 text-sm font-black text-ink transition-colors group-hover:bg-ticketground group-hover:text-white">
            공식 풀 보기
          </span>
          </div>
        </Link>
        <div className="grid content-start gap-5 rounded-lg border border-line bg-card p-5 shadow-ticket-1 sm:p-6">
          <p className="text-sm font-black text-ink-3">3단계 안전 장치</p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { icon: TicketCheck, title: "보유 티켓 확인", description: "예매 내역에서 바로 등록" },
              { icon: Workflow, title: "정책 자동 판별", description: "정가 90~110% 자동 검증" },
              { icon: QrCode, title: "QR 보호", description: "입장 직전 동적 QR 전달" },
            ].map(({ icon: Icon, title, description }, index) => (
              <div key={title} className="grid justify-items-center gap-2 text-center">
                <span className="relative grid size-11 place-items-center rounded-full bg-ink text-accent-2">
                  <Icon className="size-5" aria-hidden />
                  <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ticketground text-[10px] font-black text-white">
                    {index + 1}
                  </span>
                </span>
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
        "group relative isolate block min-h-[208px] w-full overflow-hidden rounded-lg border p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-ticket-3 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6",
        tone.card,
      )}
    >
      {tone.accent && <span data-card-accent className={cn("absolute inset-x-0 top-0 h-1", tone.accent)} aria-hidden="true" />}
      <span className="absolute right-5 top-16 text-7xl font-black leading-none opacity-10" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="relative z-10 flex h-full min-h-[166px] flex-col">
        <div className="flex items-center justify-between gap-3">
          <p className={cn("inline-flex h-7 items-center rounded-lg border px-3 text-xs font-black tracking-normal", tone.eyebrow)}>
            EDITORIAL
          </p>
        </div>
        <h3 className="balanced-title mt-7 text-3xl font-black leading-tight sm:text-4xl">{event.title}</h3>
        <span className={cn("mt-8 inline-flex h-9 w-fit items-center rounded-lg border px-3 text-sm font-black transition-colors", tone.cta)}>
          기획전 보기 <span className="ml-1" aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

export function EditorialEventsSection() {
  return (
    <section data-section="editorial-events" className="ticketground-container mt-16">
      <SectionHead title="기획전" subtitle="지금 봐야 할 공연을 에디터가 엄선해 소개합니다." moreHref="/event/ticketground-day" />
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
      <SectionHead title="장르별 추천" subtitle="콘서트·뮤지컬·연극·클래식을 비교하세요." moreHref="/contents/genre" />
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
      className="group grid w-full justify-items-center gap-2 rounded-lg border border-line bg-card p-3 text-center transition-colors hover:border-ink hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-10 place-items-center rounded-full bg-ink text-accent-2 transition-colors group-hover:bg-ticketground">
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
      <SectionHead title="바로가기" moreHref="/contents/shortcuts" />
      <div className="lg:hidden">
        <CarouselRow className="pb-1">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.label} className="w-[100px] shrink-0">
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

export function GroupBookingBanner() {
  return (
    <section data-section="group-booking" className="ticketground-container mt-16">
      <Link
        href="/group-booking"
        className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-card px-5 py-4 shadow-ticket-1 transition-colors hover:border-ink focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-6 sm:py-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-on-ink">
            <Building2 aria-hidden className="size-5" />
          </span>
          <span className="min-w-0">
            <strong className="block text-sm font-black text-ink sm:text-base">단체/기관 예매</strong>
            <span className="mt-0.5 block truncate text-xs font-bold text-ink-3 sm:text-sm">학교·학원·기업·지자체 등 단체 예매는 신청서로 접수해드립니다</span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-ink-3 group-hover:text-ticketground">
          신청하기
          <ChevronRight aria-hidden className="size-4" />
        </span>
      </Link>
    </section>
  );
}
