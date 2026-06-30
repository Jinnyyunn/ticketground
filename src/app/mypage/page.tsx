import Link from "next/link";
import { BackendTicketPanel } from "@/components/mypage/backend-ticket-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { reservations } from "@/data/ticketing";

const sideNav = [
  ["예매내역", "/mypage#reservations"],
  ["취소내역", "/cancel"],
  ["관심공연", "/watchlist"],
  ["1:1 문의", "/inquiry"],
] as const;

const today = "2026.06.29";
const dDayReservation = {
  id: "CTI-260629-DAYQR",
  showSlug: "dracula",
  showTitle: "뮤지컬 드라큘라 (Dracula：The Musical)",
  venue: "LG아트센터 서울 LG SIGNATURE 홀",
  date: today,
  time: "19:30",
  seat: "VIP A열 12번",
  price: "180,000원",
  status: "예매완료",
} as const;
const displayReservations = [dDayReservation, ...reservations] as const;

export default function MyPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <div className="rounded-[12px] border border-[#eee] bg-[#29292d] p-6 text-white">
          <p className="text-[14px] font-bold text-[#ffe92e]">Ticketground MEMBERS</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-[32px] font-bold">김하린 회원</h1>
              <p className="mt-2 text-[15px] text-[#d8d8d8]">클린티켓 인증 기기 1대 · 예매 4건 · 양도 가능 2석</p>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center text-[13px] sm:gap-4">
              {["예매", "취소", "양도", "문의"].map((label, index) => (
                <div key={label}>
                  <strong className="block text-[22px]">{index === 0 ? reservations.length : index}</strong>
                  <span className="text-[#bbb]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

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
