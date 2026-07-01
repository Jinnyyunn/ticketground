import Link from "next/link";
import { notFound } from "next/navigation";
import { BackendAdmissionPanel } from "@/components/ticketing/backend-admission-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { appOnlyQrReservation, cleanTicketQrStages, getReservation, reservations } from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";
import type { Reservation } from "@/types";

export function generateStaticParams() {
  return [...reservations.map((reservation) => ({ id: reservation.id })), { id: appOnlyQrReservation.id }];
}

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    date?: string | string[];
    time?: string | string[];
    seat?: string | string[];
    seats?: string | string[];
    price?: string | string[];
    total?: string | string[];
    ticketId?: string | string[];
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const reservation = getReservation(id);
  if (!reservation && id === appOnlyQrReservation.id) return <AppOnlyQrGuard reservation={appOnlyQrReservation} />;
  if (!reservation) notFound();

  const date = queryParam(query.date) || reservation.date;
  const time = queryParam(query.time) || reservation.time;
  const seats = queryParam(query.seats) || queryParam(query.seat) || reservation.seat;
  const total = queryParam(query.total);
  const price = total ? `${Number.parseInt(total, 10).toLocaleString("ko-KR")}원` : queryParam(query.price) || reservation.price;
  const ticketId = queryParam(query.ticketId);

  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <div className="min-w-0 rounded-[12px] border border-[#eee] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex size-14 items-center justify-center rounded-full bg-[#eef0ff] text-[26px] font-bold text-ticketground">✓</div>
              <h1 className="balanced-title mt-4 text-[26px] font-bold text-[#29292d] sm:text-[30px]">예매가 완료되었습니다</h1>
              <p className="mt-2 text-[15px] font-bold text-[#666]">예매번호 {reservation.id}</p>
            </div>
            <Link href="/mypage" className="flex h-11 items-center rounded-[8px] bg-[#29292d] px-5 text-[14px] font-bold text-white">
              내 예약 보기
            </Link>
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {cleanTicketQrStages.map((stage, index) => (
              <article key={stage.code} className="rounded-[10px] border border-[#eee] bg-[#f8f8f8] p-4">
                <p className="text-[13px] font-bold text-ticketground">{index + 1}단계 · {stage.timing}</p>
                <h2 className="mt-2 text-[18px] font-bold text-[#29292d]">{stage.label}</h2>
                <p className="mt-2 text-[14px] text-[#666]">{stage.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <article className="min-w-0 overflow-hidden rounded-[12px] border border-[#29292d] bg-white shadow-sm">
            <div className="bg-[#29292d] p-6 text-white">
              <p className="text-[13px] font-bold text-[#ffe92e]">CLEAN TICKET</p>
              <h2 className="balanced-title mt-2 text-[24px] font-bold sm:text-[26px]">{reservation.showTitle}</h2>
              <p className="mt-2 text-[14px] text-[#d8d8d8]">{reservation.venue}</p>
            </div>
            <div className="border-y border-dashed border-[#bbb] px-6 py-3 text-center text-[13px] font-bold text-[#777]">펀치 절취선</div>
            <div className="grid gap-6 p-6 md:grid-cols-[1fr_220px]">
              <dl className="grid gap-4 text-[15px]">
                {[
                  ["DATE", `${date} ${time}`],
                  ["VENUE", reservation.venue],
                  ["SEAT", seats],
                  ["PRICE", price],
                ].map(([label, value]) => (
                  <div key={label} className="grid gap-1">
                    <dt className="text-[13px] font-bold text-[#999]">{label}</dt>
                    <dd className="break-words font-bold text-[#29292d]">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-[10px] border border-[#ddd] bg-[#f7f7f8] p-4 text-center">
                <div className="grid aspect-square place-items-center rounded-[8px] border border-dashed border-[#aaa] bg-white text-[44px] blur-[1px]">▦</div>
                <span className="mt-3 inline-flex rounded-full bg-[#29292d] px-3 py-1 text-[13px] font-bold text-white">잠금 · 가상 티켓</span>
                <p className="mt-3 text-[14px] font-bold text-[#29292d]">입장 불가</p>
                <p className="mt-1 text-[13px] text-[#666]">소유 확인용 가상 티켓이며 현장 입장 QR이 아닙니다.</p>
              </div>
            </div>
          </article>

          <aside className="h-fit rounded-[12px] border border-[#eee] p-5">
            <h2 className="text-[20px] font-bold text-[#29292d]">입장 QR 안내</h2>
            <p className="mt-3 text-[14px] text-[#666]">동적 QR은 공연 2~3시간 전 전용 앱에서만 열리며 20초마다 갱신됩니다.</p>
            <button type="button" disabled className="mt-5 h-11 w-full rounded-[8px] bg-[#d8d8d8] text-[14px] font-bold text-white">
              앱에서 열림(비활성)
            </button>
            <BackendAdmissionPanel ticketId={ticketId} />
            <Link href={`/transfer?reservation=${reservation.id}&seat=${encodeURIComponent(seats)}`} className="mt-3 flex h-11 items-center justify-center rounded-[8px] border border-[#ddd] text-[14px] font-bold whitespace-nowrap">
              동반자 티켓 양도
            </Link>
            <p className="mt-4 text-[13px] text-[#777]">QR 캡처나 직접 전달은 지원하지 않습니다.</p>
          </aside>
        </div>
      </section>
    </TicketingPageShell>
  );
}

function AppOnlyQrGuard({ reservation }: { readonly reservation: Reservation }) {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="min-w-0 rounded-xl border border-line bg-white p-5 shadow-ticket-1 sm:p-7">
            <p className="text-sm font-black text-ticketground">앱 전용 입장 QR</p>
            <h1 className="balanced-title mt-2 text-[28px] font-black text-ink sm:text-[34px]">{reservation.showTitle}</h1>
            <p className="mt-3 text-sm leading-loose text-ink-3">
              웹에서는 실제 입장 QR을 표시하지 않습니다. 공연장 입장용 동적 QR은 본인 인증된 Ticketground 앱에서만 열리며, 웹 화면은
              안전 안내와 앱 이동 경로만 제공합니다.
            </p>

            <dl className="mt-6 grid gap-3 rounded-lg border border-line bg-surface p-4 text-sm sm:grid-cols-2">
              {[
                ["예매번호", reservation.id],
                ["일시", `${reservation.date} ${reservation.time}`],
                ["좌석", reservation.seat],
                ["장소", reservation.venue],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="font-black text-ink-3">{label}</dt>
                  <dd className="mt-1 break-words font-bold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 rounded-lg border border-line bg-white p-4">
              <p className="text-sm font-black text-ink">딥링크 안내</p>
              <p className="mt-2 break-words rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink-3">
                ticketground://reservation/{reservation.id}/entry
              </p>
              <p className="mt-2 text-sm leading-loose text-ink-3">
                이 주소는 앱 이동 안내용입니다. 웹에서는 QR 이미지, 서명값, 입장 검증 정보를 생성하거나 저장하지 않습니다.
              </p>
            </div>
          </article>

          <aside className="h-fit rounded-xl border border-line bg-surface p-5">
            <h2 className="text-xl font-black text-ink">웹 입장 기능 제한</h2>
            <p className="mt-3 text-sm leading-loose text-ink-3">
              캡처 방지와 본인 기기 확인을 위해 입장 QR은 앱에서만 활성화됩니다. 앱 실행 후 생체 인증을 마치면 현장용 화면으로 이동합니다.
            </p>
            <button type="button" disabled className="mt-5 h-11 w-full rounded-lg bg-surface-3 text-sm font-black text-ink-4">
              앱에서 열기(웹 비활성)
            </button>
            <Link href="/mypage#reservations" className="mt-3 flex h-11 items-center justify-center rounded-lg border border-line bg-white text-sm font-black text-ink">
              예매내역으로 돌아가기
            </Link>
            <p className="mt-4 text-xs leading-loose text-ink-3">문제가 계속되면 Ticketground 앱 업데이트 후 다시 시도하세요.</p>
          </aside>
        </div>
      </section>
    </TicketingPageShell>
  );
}
