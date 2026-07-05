import Link from "next/link";
import { AccountSummaryPanel } from "@/components/mypage/account-summary-panel";
import { BackendTicketPanel } from "@/components/mypage/backend-ticket-panel";
import { CancelHistoryPanel } from "@/components/mypage/cancel-history-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { appOnlyQrReservation, reservations } from "@/data/ticketing";

const sideNav = [
  ["예매내역", "/mypage#reservations"],
  ["취소내역", "/mypage#cancel-history"],
  ["관심공연", "/watchlist"],
  ["1:1 문의", "/inquiry"],
] as const;

const today = "2026.06.29";
const displayReservations = [appOnlyQrReservation, ...reservations] as const;

export default function MyPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <AccountSummaryPanel inquiryCount={3} resaleSeatCount={2} reservationCount={reservations.length} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-md border border-line p-4">
            <h2 className="px-2 text-base font-black text-ink-2">마이페이지</h2>
            <nav className="mt-3 grid gap-1">
              {sideNav.map(([label, href]) => (
                <Link key={label} href={href} className="rounded-sm px-3 py-2 text-sm font-bold text-ink-3 hover:bg-surface">
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          <div id="reservations" className="min-w-0 scroll-mt-[176px]">
            <p className="text-sm font-bold text-ticketground">내 예약</p>
            <h2 className="mt-2 text-[30px] font-black text-ink-2">예매 내역</h2>
            <BackendTicketPanel reservations={displayReservations} />
            <div className="mt-5 grid gap-4">
              {displayReservations.map((reservation) => {
                const active = reservation.date === today;
                return (
                  <article key={reservation.id} className="min-w-0 rounded-md border border-line p-5">
                    <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-tint-blue px-2 py-1 text-sm font-bold text-ticketground">{reservation.status}</span>
                          <span className={`rounded-full px-3 py-1 text-sm font-bold ${active ? "bg-ticketground text-white" : "bg-surface-2 text-ink-2"}`}>
                            {active ? "입장 QR 활성화" : "잠금 · 가상 티켓"}
                          </span>
                          {active && <span className="text-sm font-bold text-ticketground">D-DAY · 앱에서 20초마다 갱신</span>}
                        </div>
                        <h3 className="balanced-title mt-3 text-2xl font-black text-ink-2">{reservation.showTitle}</h3>
                        <p className="mt-2 break-words text-base text-ink-3">{reservation.venue}</p>
                        <p className="mt-1 text-base font-bold">
                          {reservation.date} {reservation.time} · {reservation.seat}
                        </p>
                        <p className="mt-1 text-sm text-ink-3">예매번호 {reservation.id}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <Link href={`/reservation/${reservation.id}`} className="flex h-10 items-center rounded-sm bg-ink-2 px-4 text-sm font-bold text-on-ink-2 whitespace-nowrap">
                          {active ? "입장 QR 열기(앱)" : "가상 티켓 보기"}
                        </Link>
                        <Link href={`/resale?reservation=${reservation.id}`} className="flex h-10 items-center rounded-sm border border-line-strong px-4 text-sm font-bold whitespace-nowrap">
                          공식 재판매
                        </Link>
                        <Link href={`/cancel?reservation=${reservation.id}`} className="flex h-10 items-center rounded-sm border border-line-strong px-4 text-sm font-bold whitespace-nowrap">
                          취소
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <CancelHistoryPanel />
          </div>
        </div>
      </section>
    </TicketingPageShell>
  );
}
