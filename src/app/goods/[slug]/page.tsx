import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { DetailBookingPanel } from "@/components/ticketing/detail-booking-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { currency, getShow, ticketShows } from "@/data/ticketing";

const tabLinks = [
  { href: "#intro", label: "공연소개" },
  { href: "#cast", label: "출연진" },
  { href: "#schedule", label: "공연일정" },
  { href: "#place", label: "장소" },
  { href: "#notices", label: "유의사항" },
] as const;

export function generateStaticParams() {
  return ticketShows.map((show) => ({ slug: show.slug }));
}

export default async function GoodsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const show = getShow(slug);
  if (!show) notFound();

  const calendarDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const scheduledDays = new Set(show.schedules.map((schedule) => Number(schedule.date.split(".").at(-1))));
  const firstPrice = show.prices[0];
  const artistHref = show.artistSlug ? `/artist/${show.artistSlug}` : undefined;

  return (
    <TicketingPageShell>
      <main className="ticketground-container py-10">
        <section className="grid min-w-0 gap-8 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
          <article className="min-w-0 overflow-hidden rounded-lg bg-ink text-white shadow-ticket-3">
            <div className="relative min-h-[426px] overflow-hidden">
              <Image
                src={show.poster}
                alt={`${show.title} 포스터`}
                fill
                priority
                unoptimized
                data-detail-poster
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
              <div className="relative z-10 flex min-h-[426px] flex-col justify-end p-6">
                <p className="text-sm font-bold text-white/75">{show.category}</p>
                <h1 className="balanced-title mt-3 text-[32px] font-black leading-tight sm:text-4xl">{show.shortTitle}</h1>
                <p className="mt-3 text-sm font-bold text-white/80">{show.venue}</p>
              </div>
            </div>
          </article>

          <section className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {show.badge && <span className="rounded bg-tint-yellow px-2 py-1 text-xs font-black text-ink">{show.badge}</span>}
              {show.ranking && <span className="text-sm font-bold text-ticketground">{show.ranking}</span>}
            </div>
            <h2 className="balanced-title mt-4 text-[30px] font-black leading-tight text-ink sm:text-4xl">{show.title}</h2>
            <p className="mt-4 max-w-[680px] text-base leading-loose text-ink-3">{show.summary}</p>

            <dl className="mt-8 grid gap-0 overflow-hidden rounded-lg border border-line text-sm md:grid-cols-2">
              {[
                ["장소", show.venue],
                ["공연기간", show.period],
                ["공연시간", show.runtime],
                ["관람연령", show.ageLimit],
              ].map(([label, value]) => (
                  <div key={label} className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-4 border-b border-line px-4 py-4 even:md:border-l md:[&:nth-last-child(-n+2)]:border-b-0">
                    <dt className="font-bold text-ink-3">{label}</dt>
                    <dd className="min-w-0 font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <section className="mt-8 rounded-lg border border-line bg-surface p-5">
              <h3 className="text-lg font-black text-ink">좌석 가격</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {show.prices.map((price) => (
                  <div key={price.seat} className="flex min-w-0 justify-between gap-3 rounded-sm bg-card px-4 py-3 text-sm">
                    <span className="min-w-0 font-bold text-ink-2">{price.seat}</span>
                    <strong className="shrink-0 text-ink">{currency(price.price)}</strong>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <DetailBookingPanel slug={show.slug} title={show.title} schedules={show.schedules} />

          <nav className="no-scrollbar sticky top-[112px] z-20 flex gap-2 overflow-x-auto border-b border-line bg-white py-3 shadow-sm lg:col-span-3" aria-label="상세 정보 바로가기">
            {tabLinks.map((tab) => (
              <Link key={tab.href} href={tab.href} className="whitespace-nowrap rounded-md px-4 py-2 text-sm font-black text-ink-3 transition-colors hover:bg-surface hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50">
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="min-w-0 space-y-12 lg:col-span-2">
            <section id="intro" className="scroll-mt-[176px]">
              <p className="text-sm font-black text-ticketground">공연소개</p>
              <h2 className="balanced-title mt-2 text-[26px] font-black text-ink sm:text-3xl">클린티켓으로 만나는 대표 회차</h2>
              <p className="mt-4 text-base leading-loose text-ink-3">
                {show.summary} 공식 재판매와 공식 양도 정책이 함께 적용되어 좌석 소유, 입장 QR, 거래 기록이 분리 관리됩니다.
              </p>
            </section>

            <section id="cast" className="scroll-mt-[176px]">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-ticketground">출연진</p>
                  <h2 className="balanced-title mt-2 text-[26px] font-black text-ink sm:text-3xl">주요 캐스트</h2>
                </div>
                {artistHref ? (
                  <Link href={artistHref} className="text-sm font-bold text-ticketground">
                    아티스트 보기
                  </Link>
                ) : (
                  <span className="text-sm font-bold text-ink-3">아티스트 페이지 준비 중</span>
                )}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {show.casts.map((cast) =>
                  artistHref ? (
                    <Link key={cast} href={artistHref} data-allow-wrap="true" className="group rounded-lg border border-line bg-card p-4 text-center transition-colors hover:border-line-strong hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50">
                      <span className="mx-auto grid size-14 place-items-center rounded-lg bg-ink text-lg font-black text-white transition-colors group-hover:bg-ticketground">
                        {cast.slice(0, 1)}
                      </span>
                      <span className="mt-3 block text-sm font-black text-ink">{cast}</span>
                    </Link>
                  ) : (
                    <article key={cast} data-allow-wrap="true" className="rounded-lg border border-line bg-card p-4 text-center">
                      <span className="mx-auto grid size-14 place-items-center rounded-lg bg-ink text-lg font-black text-white">
                        {cast.slice(0, 1)}
                      </span>
                      <span className="mt-3 block text-sm font-black text-ink">{cast}</span>
                    </article>
                  ),
                )}
              </div>
              {!artistHref && <p className="mt-4 text-sm font-semibold text-ink-3">이 공연의 아티스트 상세 페이지는 준비 중입니다.</p>}
            </section>

            <section id="schedule" className="scroll-mt-[176px]">
              <p className="text-sm font-black text-ticketground">공연일정</p>
              <h2 className="balanced-title mt-2 text-[26px] font-black text-ink sm:text-3xl">5월 회차 캘린더</h2>
              <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
                <div className="rounded-lg border border-line bg-card p-4">
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-ink-3">
                    {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
                      <span key={day} className="py-2">
                        {day}
                      </span>
                    ))}
                    {calendarDays.map((day) => {
                      const scheduled = scheduledDays.has(day);
                      return (
                        <span key={day} className="relative rounded-sm py-2 text-sm font-bold text-ink">
                          {day}
                          {scheduled && <span className="absolute inset-x-0 bottom-1 mx-auto size-1.5 rounded-full bg-ticketground" aria-label={`${day}일 공연 있음`} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3">
                  {show.schedules.map((schedule) => (
                    <article key={schedule.date} className="rounded-lg border border-line bg-card p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-ink">{schedule.label}</h3>
                          <p className="text-sm text-ink-3">{schedule.date}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {schedule.times.map((time) => (
                            <span key={time} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-bold text-ink-2">
                              {time}
                            </span>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="place" className="scroll-mt-[176px]">
              <p className="text-sm font-black text-ticketground">장소</p>
              <h2 className="balanced-title mt-2 text-[26px] font-black text-ink sm:text-3xl">{show.venue}</h2>
              <div className="mt-5 rounded-lg border border-line bg-card p-5">
                <div className="grid gap-5 md:grid-cols-[1fr_220px]">
                  <div>
                    <p className="text-base leading-loose text-ink-3">
                      한강진역 인근 공연장입니다. 현장 수령, 모바일 티켓 확인, 동반자 입장 문의는 공연 당일 고객센터 우선 응대 대상입니다.
                    </p>
                    <dl className="mt-5 grid gap-3 text-sm">
                      <div className="flex justify-between gap-4 border-b border-line pb-3">
                        <dt className="text-ink-3">대표 좌석가</dt>
                        <dd className="font-black text-ink">{firstPrice ? currency(firstPrice.price) : "좌석별 상이"}</dd>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-line pb-3">
                        <dt className="text-ink-3">공연장 안내</dt>
                        <dd className="font-black text-ink">좌석 미리보기 제공</dd>
                      </div>
                    </dl>
                  </div>
                  <Link href="/place" className="grid min-h-[180px] place-items-center rounded-lg bg-ink p-5 text-center text-white transition-colors hover:bg-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
                    <span>
                      <span className="block text-2xl font-black">BLUE SQUARE</span>
                      <span className="mt-2 block text-sm font-bold text-white/75">공연장 상세 보기</span>
                    </span>
                  </Link>
                </div>
              </div>
            </section>

            <section id="notices" className="scroll-mt-[176px]">
              <p className="text-sm font-black text-ticketground">유의사항</p>
              <h2 className="balanced-title mt-2 text-[26px] font-black text-ink sm:text-3xl">클린티켓 운영 안내</h2>
              <ul className="mt-5 grid gap-3 text-sm leading-loose text-ink-3">
                {show.notices.map((notice) => (
                  <li key={notice} className="rounded-sm border border-line bg-card px-4 py-3">
                    {notice}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </main>
    </TicketingPageShell>
  );
}
