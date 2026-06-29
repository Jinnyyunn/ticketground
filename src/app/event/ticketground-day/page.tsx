import Link from "next/link";
import { ShowTile } from "@/components/discovery/show-tile";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ticketShows } from "@/data/ticketing";

export default function TicketgroundDayPage() {
  const lineup = ticketShows.slice(0, 4);

  return (
    <TicketingPageShell>
      <section className="bg-ink py-16 text-white">
        <div className="ticketground-container grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="text-sm font-black text-accent-2">Ticketground Day</p>
            <h1 className="mt-3 max-w-[760px] text-7xl font-black leading-tight">클린티켓으로 여는 여름 공연 큐레이션</h1>
            <p className="mt-5 max-w-[620px] text-base leading-relaxed text-white/75">
              공식 재판매, 동적 QR, 예매 알림이 적용된 공연을 한곳에 모은 에디토리얼 기획전입니다.
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-5">
            <p className="text-sm font-black text-accent-2">7월 한정</p>
            <p className="mt-2 text-3xl font-black">오픈 알림 등록 시 클린티켓 우선 안내</p>
            <Link href="/open" className="mt-5 inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-black text-ink">
              오픈 캘린더 보기
            </Link>
          </div>
        </div>
      </section>
      <section className="ticketground-container py-10">
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div>
            <h2 className="text-4xl font-black text-ink">큐레이션 소개</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-3">암표 통제 정책이 노출되는 공연만 선별해 예매 전 확인할 정보를 정리했습니다.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {lineup.map((show, index) => (
              <article key={show.slug} className="rounded-lg border border-line bg-white p-4">
                <p className="text-sm font-black text-ticketground">LINEUP {index + 1}</p>
                <div className="mt-3">
                  <ShowTile show={show} compact />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </TicketingPageShell>
  );
}
