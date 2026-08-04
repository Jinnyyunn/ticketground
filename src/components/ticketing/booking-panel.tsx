"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BookingSelection, TicketShow } from "@/types";
import { getTicketShowBackendEventId, getTicketShowPerformanceDateId } from "@/data/ticketing-backend-events";
import { currency } from "@/data/ticketing";
import { getSeatMap, type ApiSeatMap } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";
import { BackendSeatPicker } from "./backend-seat-picker";
import { BookingSummaryRow } from "./booking-summary-row";
import { BookingExpiryNotice, BookingTimerWarning } from "./booking-timer-notice";
import { VenueSeatMap } from "./venue-seat-map";

const serviceFeePerSeat = 2000;
const maxSelectableSeats = 2;

type BookingStep = "schedule" | "seats";

const steps: readonly { readonly id: BookingStep; readonly label: string }[] = [
  { id: "schedule", label: "날짜·회차" },
  { id: "seats", label: "좌석 선택" },
];

function minutes(seconds: number) {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

type BookingPanelProps = { readonly show: TicketShow; readonly initialSelection: Pick<BookingSelection, "date" | "time">; readonly initialTimerSeconds?: number };

export function BookingPanel({ show, initialSelection, initialTimerSeconds = 7 * 60 }: BookingPanelProps) {
  const [date, setDate] = useState(initialSelection.date || show.schedules[0]?.date || "");
  const [time, setTime] = useState(initialSelection.time || show.schedules[0]?.times[0] || "");
  const [quantity, setQuantity] = useState(maxSelectableSeats);
  const [step, setStep] = useState<BookingStep>("schedule");
  const [seatMap, setSeatMap] = useState<ApiSeatMap | null>(null);
  const [seatMapStatus, setSeatMapStatus] = useState("좌석도 로딩 중");
  const [selectedBackendTicketIds, setSelectedBackendTicketIds] = useState<readonly string[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(initialTimerSeconds);
  const timerExpired = timerSeconds === 0;
  const timerWarning = !timerExpired && timerSeconds <= 60;
  const backendEventId = useMemo(() => getTicketShowBackendEventId(show), [show]);
  const performanceDateId = useMemo(
    () => getTicketShowPerformanceDateId(show, date, time),
    [date, show, time],
  );

  useEffect(() => {
    if (timerExpired) return;

    const timer = window.setInterval(() => setTimerSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [timerExpired]);

  useEffect(() => {
    let mounted = true;
    setSeatMap(null);
    setSelectedBackendTicketIds([]);
    if (!performanceDateId) {
      setSeatMapStatus("선택한 회차의 좌석 정보를 확인할 수 없습니다.");
      return () => {
        mounted = false;
      };
    }
    getSeatMap(backendEventId, performanceDateId)
      .then((nextSeatMap) => {
        if (!mounted) return;
        setSeatMap(nextSeatMap);
        setSeatMapStatus(`${nextSeatMap.event.title} · ${nextSeatMap.seats.length}석 로드`);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setSeatMap(null);
        setSeatMapStatus(error instanceof Error ? error.message : "좌석도를 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, [backendEventId, performanceDateId]);

  const backendSeats = seatMap?.seats.filter((seat) => seat.available).slice(0, 48) ?? [];
  const selectedBackendSeats = seatMap?.seats.filter((seat) => selectedBackendTicketIds.includes(seat.id)) ?? [];
  const useBackendSeatMap = Boolean(seatMap && backendSeats.length > 0);
  const hasVenueSeatPositions = backendSeats.every((seat) => seat.mapPosition);
  const selectedLabels = selectedBackendSeats.map((seat) => seat.displayCode).join(", ");
  const selectedCount = selectedBackendSeats.length;
  const baseAmount = selectedBackendSeats.reduce((sum, seat) => sum + seat.price, 0);
  const feeAmount = selectedCount * serviceFeePerSeat;
  const totalAmount = baseAmount + feeAmount;
  const canChooseSeats = show.sale.bookable && !timerExpired && Boolean(date && time && quantity);
  const canPay = show.sale.bookable && !timerExpired && selectedBackendSeats.length > 0 && selectedBackendSeats.length <= quantity;
  const checkoutHref = `/checkout/${show.slug}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&seats=${encodeURIComponent(selectedLabels)}&count=${selectedCount}&ticketId=${encodeURIComponent(selectedBackendTicketIds[0] ?? "")}`;

  function selectBackendSeat(ticketId: string) {
    setSelectedBackendTicketIds((current) => {
      if (current.includes(ticketId)) return current.filter((id) => id !== ticketId);
      const allowedCount = Math.min(quantity, maxSelectableSeats);
      return [...current, ticketId].slice(-allowedCount);
    });
  }

  function changeDate(nextDate: string) {
    const nextTimes = show.schedules.find((schedule) => schedule.date === nextDate)?.times;
    setDate(nextDate);
    setTime(nextTimes?.[0] ?? "");
  }

  return (
    <div className="bg-surface">
      <div className="border-b border-line bg-card">
        <div className="ticketground-container flex h-auto min-h-16 items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-ticketground">Ticketground Booking</p>
            <h1 className="balanced-title text-xl font-black text-ink sm:text-2xl">{show.shortTitle}</h1>
          </div>
          <div
            data-booking-timer
            className={cn(
              "shrink-0 rounded-sm px-4 py-2 text-xl font-black tabular-nums",
              timerExpired
                ? "bg-ticketground text-white"
                : timerWarning
                  ? "bg-warn text-white"
                  : "bg-ink text-on-ink",
            )}
            aria-label="남은 예매 시간"
          >
            {minutes(timerSeconds)}
          </div>
        </div>
      </div>

      <div className="ticketground-container grid min-w-0 gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-5">
          <nav className="grid grid-cols-2 gap-2" aria-label="예매 단계">
            {steps.map((item, index) => {
              const active = item.id === step;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  disabled={item.id === "seats" && !canChooseSeats}
                  className={cn(
                    "h-12 rounded-sm border text-sm font-black whitespace-nowrap",
                    active ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink-3",
                    item.id === "seats" && !canChooseSeats && "cursor-not-allowed opacity-50",
                  )}
                >
                  {index + 1}. {item.label}
                </button>
              );
            })}
          </nav>

          <BookingExpiryNotice date={date} expired={timerExpired} showSlug={show.slug} time={time} />
          <BookingTimerWarning visible={timerWarning} />
          {!show.sale.bookable ? (
            <div className="rounded-lg border border-line bg-card p-4 text-sm font-bold text-ink-3" role="status">
              <span className="font-black text-ticketground">{show.sale.label}</span> · {show.sale.note}
            </div>
          ) : null}
          <div data-testid="booking-identity-notice" className="rounded-lg border border-line bg-card p-4 text-sm font-bold text-ink-3">
            {show.checkoutNotice} 이미 다른 계정에서 인증된 휴대폰 번호는 다시 사용할 수 없습니다.
          </div>

          {step === "schedule" && (
            <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-card p-4 sm:p-6">
              <p className="text-sm font-black text-ticketground">STEP 1</p>
              <h2 className="balanced-title mt-1 text-2xl font-black text-ink sm:text-[24px]">관람일·회차·매수를 선택하세요</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_180px]">
                <div>
                  <h3 className="text-lg font-black text-ink">관람일</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {show.schedules.map((schedule) => (
                      <button disabled={!show.sale.bookable} key={schedule.date} type="button" onClick={() => changeDate(schedule.date)} className={cn("whitespace-nowrap rounded-sm border px-3 py-3 text-sm font-bold", date === schedule.date ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink", !show.sale.bookable && "cursor-not-allowed opacity-50")}>{schedule.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-ink">회차</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(show.schedules.find((schedule) => schedule.date === date)?.times ?? []).map((item) => (
                      <button disabled={!show.sale.bookable} key={item} type="button" onClick={() => setTime(item)} className={cn("rounded-sm border px-3 py-3 text-sm font-bold", time === item ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink", !show.sale.bookable && "cursor-not-allowed opacity-50")}>{item}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-ink">매수</h3>
                  <div className="mt-3 flex rounded-sm border border-line bg-card p-1">
                    {[1, 2].map((count) => (
                      <button disabled={!show.sale.bookable} key={count} type="button" onClick={() => setQuantity(count)} className={cn("h-11 flex-1 rounded-[6px] text-base font-black", quantity === count ? "bg-ticketground text-white" : "text-ink-3", !show.sale.bookable && "cursor-not-allowed opacity-50")}>{count}매</button>
                    ))}
                  </div>
                  <p className="mt-3 break-keep text-sm font-bold text-ink-3">최대 2매까지 선택할 수 있습니다.</p>
                </div>
              </div>
              <button type="button" disabled={!canChooseSeats} onClick={() => setStep("seats")} className="mt-6 h-12 rounded-sm bg-ticketground px-6 text-base font-black text-white disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-4">
                좌석 선택으로 이동
              </button>
            </section>
          )}

          {step === "seats" && (
            <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-card p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-ticketground">STEP 2</p>
                  <h2 className="balanced-title mt-1 text-2xl font-black text-ink sm:text-[24px]">좌석 선택</h2>
                </div>
                <p className="text-sm font-bold text-ink-3">20행 A-T × 22열, 12열 앞 중앙 통로</p>
              </div>
              <div className="mt-5 min-w-0">
                {useBackendSeatMap && hasVenueSeatPositions && seatMap ? (
                  <VenueSeatMap
                    mapImage={seatMap.map.image}
                    mapTitle={seatMap.map.title}
                    seats={backendSeats}
                    selectedTicketIds={selectedBackendTicketIds}
                    status={seatMapStatus}
                    onSelect={selectBackendSeat}
                  />
                ) : useBackendSeatMap ? (
                  <BackendSeatPicker seats={backendSeats} selectedTicketIds={selectedBackendTicketIds} status={seatMapStatus} onSelect={selectBackendSeat} />
                ) : (
                  <div className="rounded-lg border border-line bg-surface p-4 text-sm font-bold text-ink-3" role="status">
                    {seatMapStatus}
                  </div>
                )}
              </div>
              {canPay ? (
                <Link href={checkoutHref} className="mt-6 flex h-12 w-full items-center justify-center rounded-sm bg-ticketground text-lg font-black text-white">
                  결제하기
                </Link>
              ) : (
                <button type="button" disabled className="mt-6 h-12 w-full rounded-sm bg-surface-3 text-lg font-black text-ink-4">
                  결제하기
                </button>
              )}
            </section>
          )}
        </main>

        <aside className="h-fit min-w-0 rounded-lg border border-line bg-card p-6 shadow-ticket-1 lg:sticky lg:top-6">
          <h2 className="clamp-2 text-2xl font-black text-ink">{show.title}</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <BookingSummaryRow label="관람일" value={date || "선택 전"} />
            <BookingSummaryRow label="회차" value={time || "선택 전"} />
            <BookingSummaryRow label="선택 좌석" value={selectedLabels || "선택 전"} />
            <BookingSummaryRow label="매수" value={`${selectedCount}/${quantity}매`} />
            <BookingSummaryRow label="좌석 금액" value={currency(baseAmount)} strong />
            <BookingSummaryRow label="예매 수수료" value={`${currency(serviceFeePerSeat)} × ${selectedCount}`} />
            <BookingSummaryRow label="총 결제금액" value={currency(totalAmount)} total />
          </dl>
          <p className="mt-4 break-keep rounded-sm border border-warn bg-card px-3 py-2 text-sm font-bold text-ink">정책: 최대 2매까지 선택할 수 있습니다.</p>
        </aside>
      </div>
    </div>
  );
}
