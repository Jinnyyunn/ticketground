import Link from "next/link";
import { AccountSummaryPanel } from "@/components/mypage/account-summary-panel";
import { BackendTicketPanel } from "@/components/mypage/backend-ticket-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { appOnlyQrReservation, reservations } from "@/data/ticketing";

const sideNav = [
  ["예매내역", "/mypage#reservations"],
  ["취소내역", "/cancel"],
  ["관심공연", "/watchlist"],
  ["1:1 문의", "/inquiry"],
] as const;

const today = "2026.06.29";
const displayReservations = [appOnlyQrReservation, ...reservations] as const;

export default function MyPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <AccountSummaryPanel inquiryCount={3} reservationCount={reservations.length} transferableSeatCount={2} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-[10px] border border-[#eee] p-4">
            <h2 className="px-2 text-[15px] font-bold text-[#29292d]">마이페이지</h2>
            <nav className="mt-3 grid gap-1">
              {sideNav.map(([label, href]) => (
                <Link key={label} href={href} className="rounded-[8px] px-3 py-2 text-[14px] font-bold text-[#666] hover:bg-[#f7f7f8]">
                  {label}
                </Link>
              ))}
            </nav>
          </aside>

          <div id="reservations" className="min-w-0 scroll-mt-[176px]">
            <p className="text-[14px] font-bold text-ticketground">내 예약</p>
            <h2 className="mt-2 text-[30px] font-bold text-[#29292d]">예매 내역</h2>
            <BackendTicketPanel />
            <div className="mt-5 grid gap-4">
              {displayReservations.map((reservation) => {
                const active = reservation.date === today;
                return (
                  <article key={reservation.id} className="min-w-0 rounded-[10px] border border-[#eee] p-5">
                    <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[#eef0ff] px-2 py-1 text-[13px] font-bold text-ticketground">{reservation.status}</span>
                          <span className={`rounded-full px-3 py-1 text-[13px] font-bold ${active ? "bg-[#ff2d3f] text-white" : "bg-[#f3f3f3] text-[#29292d]"}`}>
                            {active ? "입장 QR 활성화" : "잠금 · 가상 티켓"}
                          </span>
                          {active && <span className="text-[13px] font-bold text-[#ff2d3f]">D-DAY · 앱에서 20초마다 갱신</span>}
                        </div>
                        <h3 className="balanced-title mt-3 text-[22px] font-bold text-[#29292d]">{reservation.showTitle}</h3>
                        <p className="mt-2 break-words text-[15px] text-[#666]">{reservation.venue}</p>
                        <p className="mt-1 text-[15px] font-bold">
                          {reservation.date} {reservation.time} · {reservation.seat}
                        </p>
                        <p className="mt-1 text-[13px] text-[#777]">예매번호 {reservation.id}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <Link href={`/reservation/${reservation.id}`} className="flex h-10 items-center rounded-[8px] bg-[#29292d] px-4 text-[14px] font-bold text-white whitespace-nowrap">
                          {active ? "입장 QR 열기(앱)" : "가상 티켓 보기"}
                        </Link>
                        <Link href={`/transfer?reservation=${reservation.id}`} className="flex h-10 items-center rounded-[8px] border border-[#ddd] px-4 text-[14px] font-bold whitespace-nowrap">
                          양도
                        </Link>
                        <Link href="/cancel" className="flex h-10 items-center rounded-[8px] border border-[#ddd] px-4 text-[14px] font-bold whitespace-nowrap">
                          취소
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </TicketingPageShell>
  );
}
