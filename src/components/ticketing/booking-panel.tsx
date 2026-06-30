"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BookingSelection, TicketShow } from "@/types";
import { currency } from "@/data/ticketing";
import { DEMO_EVENT_ID, getSeatMap, type ApiSeatMap } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";
import { BackendSeatPicker } from "./backend-seat-picker";
import { BookingSummaryRow } from "./booking-summary-row";
import { createSeatMap, SeatMap, type SeatOption, type SeatTier } from "./seat-map";

const serviceFeePerSeat = 2000;
const maxSelectableSeats = 2;

type BookingStep = "schedule" | "seats" | "payment";

const steps: readonly { readonly id: BookingStep; readonly label: string }[] = [
  { id: "schedule", label: "날짜·회차" },
  { id: "seats", label: "좌석 선택" },
  { id: "payment", label: "결제" },
];

function priceMap(show: TicketShow): Record<SeatTier, number> {
  return {
    VIP: show.prices.find((price) => price.grade === "VIP")?.price ?? 190000,
    R: show.prices.find((price) => price.grade === "R")?.price ?? 160000,
    S: show.prices.find((price) => price.grade === "S")?.price ?? 120000,
    A: show.prices.find((price) => price.grade === "A")?.price ?? 80000,
  };
}

function minutes(seconds: number) {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function BookingPanel({ show, initialSelection }: { show: TicketShow; initialSelection: Pick<BookingSelection, "date" | "time"> }) {
  const prices = useMemo(() => priceMap(show), [show]);
  const seats = useMemo(() => createSeatMap(prices), [prices]);
  const [date, setDate] = useState(initialSelection.date || show.schedules[0]?.date || "");
  const [time, setTime] = useState(initialSelection.time || show.schedules[0]?.times[0] || "");
  const [quantity, setQuantity] = useState(maxSelectableSeats);
  const [step, setStep] = useState<BookingStep>("schedule");
  const [selectedSeatIds, setSelectedSeatIds] = useState<readonly string[]>([]);
  const [seatMap, setSeatMap] = useState<ApiSeatMap | null>(null);
  const [seatMapStatus, setSeatMapStatus] = useState("백엔드 좌석도 로딩 중");
  const [selectedBackendTicketId, setSelectedBackendTicketId] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(7 * 60);

  useEffect(() => {
    const timer = window.setInterval(() => setTimerSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    getSeatMap(DEMO_EVENT_ID)
      .then((nextSeatMap) => {
        if (!mounted) return;
        const firstAvailableSeat = nextSeatMap.seats.find((seat) => seat.available);
        setSeatMap(nextSeatMap);
        setSelectedBackendTicketId(firstAvailableSeat?.id ?? "");
        setSeatMapStatus(`${nextSeatMap.event.title} · ${nextSeatMap.seats.length}석 로드`);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setSeatMapStatus(error instanceof Error ? error.message : "백엔드 좌석도를 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedSeats = selectedSeatIds
    .map((id) => seats.find((seat) => seat.id === id))
    .filter((seat): seat is SeatOption => Boolean(seat));
  const backendSeats = seatMap?.seats.filter((seat) => seat.available).slice(0, 48) ?? [];
  const selectedBackendSeat = seatMap?.seats.find((seat) => seat.id === selectedBackendTicketId);
  const selectedLabels = selectedBackendSeat ? selectedBackendSeat.displayCode : selectedSeatIds.join(", ");
  const selectedCount = selectedBackendSeat ? 1 : selectedSeats.length;
  const baseAmount = selectedBackendSeat?.price ?? selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
  const feeAmount = selectedCount * serviceFeePerSeat;
  const totalAmount = baseAmount + feeAmount;
  const canChooseSeats = Boolean(date && time && quantity);
  const canPay = selectedBackendSeat ? true : selectedSeats.length > 0 && selectedSeats.length <= quantity;
  const checkoutHref = `/checkout/${show.slug}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&seats=${encodeURIComponent(selectedLabels)}&base=${baseAmount}&fee=${feeAmount}&total=${totalAmount}&count=${selectedCount}&ticketId=${encodeURIComponent(selectedBackendTicketId)}`;

  function toggleSeat(seat: SeatOption) {
    setSelectedSeatIds((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      const allowedCount = Math.min(quantity, maxSelectableSeats);
      return [...current, seat.id].slice(-allowedCount);
    });
  }

  function changeDate(nextDate: string) {
    const nextTimes = show.schedules.find((schedule) => schedule.date === nextDate)?.times;
    setDate(nextDate);
    setTime(nextTimes?.[0] ?? "");
  }

  return (
    <div className="bg-surface">
      <div className="border-b border-line bg-white">
        <div className="ticketground-container flex h-auto min-h-16 items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-black text-ticketground">Ticketground Booking</p>
            <h1 className="balanced-title text-[18px] font-black text-ink sm:text-[20px]">{show.shortTitle}</h1>
          </div>
          <div className="shrink-0 rounded-[8px] bg-ink px-4 py-2 text-[18px] font-black tabular-nums text-white" aria-label="남은 예매 시간">
            {minutes(timerSeconds)}
          </div>
        </div>
      </div>

      <div className="ticketground-container grid min-w-0 gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-5">
          <nav className="grid grid-cols-3 gap-2" aria-label="예매 단계">
            {steps.map((item, index) => {
              const active = item.id === step;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  className={cn(
                    "h-12 rounded-[8px] border text-[14px] font-black whitespace-nowrap",
                    active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-3",
                  )}
                >
                  {index + 1}. {item.label}
                </button>
              );
            })}
          </nav>

          {step === "schedule" && (
            <section className="min-w-0 overflow-hidden rounded-[12px] border border-line bg-white p-4 sm:p-6">
              <p className="text-[13px] font-black text-ticketground">STEP 1</p>
              <h2 className="balanced-title mt-1 text-[22px] font-black text-ink sm:text-[24px]">관람일·회차·매수를 선택하세요</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_180px]">
                <div>
                  <h3 className="text-[16px] font-black text-ink">관람일</h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {show.schedules.map((schedule) => (
                      <button key={schedule.date} type="button" onClick={() => changeDate(schedule.date)} className={cn("whitespace-nowrap rounded-[8px] border px-3 py-3 text-[14px] font-bold", date === schedule.date ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}>
                        {schedule.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-ink">회차</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(show.schedules.find((schedule) => schedule.date === date)?.times ?? []).map((item) => (
                      <button key={item} type="button" onClick={() => setTime(item)} className={cn("rounded-[8px] border px-3 py-3 text-[14px] font-bold", time === item ? "border-ink bg-ink text-white" : "border-line bg-white text-ink")}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-[16px] font-black text-ink">매수</h3>
                  <div className="mt-3 flex rounded-[8px] border border-line bg-white p-1">
                    {[1, 2].map((count) => (
                      <button key={count} type="button" onClick={() => setQuantity(count)} className={cn("h-11 flex-1 rounded-[6px] text-[15px] font-black", quantity === count ? "bg-ticketground text-white" : "text-ink-3")}>
                        {count}매
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[13px] font-bold text-ink-3">최대 2매, 초과 선택 시 오래된 좌석이 자동 해제됩니다.</p>
                </div>
              </div>
              <button type="button" disabled={!canChooseSeats} onClick={() => setStep("seats")} className="mt-6 h-12 rounded-[8px] bg-ticketground px-6 text-[15px] font-black text-white disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-4">
                좌석 선택으로 이동
              </button>
            </section>
          )}

          {step === "seats" && (
            <section className="min-w-0 overflow-hidden rounded-[12px] border border-line bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[13px] font-black text-ticketground">STEP 2</p>
                  <h2 className="balanced-title mt-1 text-[22px] font-black text-ink sm:text-[24px]">좌석 선택</h2>
                </div>
                <p className="text-[13px] font-bold text-ink-3">20행 A-T × 22열, 12열 앞 중앙 통로</p>
              </div>
              <div className="mt-5 min-w-0">
                <BackendSeatPicker
                  seats={backendSeats}
                  selectedTicketId={selectedBackendTicketId}
                  status={seatMapStatus}
                  onSelect={setSelectedBackendTicketId}
                />
                <div className="mt-4 min-w-0">
                  <SeatMap seats={seats} selectedSeatIds={selectedSeatIds} onToggleSeat={toggleSeat} />
                </div>
              </div>
              <button type="button" disabled={!canPay} onClick={() => setStep("payment")} className="mt-6 h-12 rounded-[8px] bg-ticketground px-6 text-[15px] font-black text-white whitespace-nowrap disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-4">
                결제 단계로 이동
              </button>
            </section>
          )}

          {step === "payment" && (
            <section className="min-w-0 overflow-hidden rounded-[12px] border border-line bg-white p-4 sm:p-6">
              <p className="text-[13px] font-black text-ticketground">STEP 3</p>
              <h2 className="balanced-title mt-1 text-[22px] font-black text-ink sm:text-[24px]">결제 정보 확인</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {["신용카드", "간편결제", "계좌이체", "휴대폰", "무통장입금(입금대기)"].map((method) => (
                  <label key={method} className="flex min-h-12 min-w-0 items-center gap-3 rounded-[8px] border border-line bg-white px-4 text-[14px] font-bold text-ink">
                    <input name="payment-method" type="radio" defaultChecked={method === "신용카드"} />
                    <span className="min-w-0">{method}</span>
                  </label>
                ))}
              </div>
              <Link href={canPay ? checkoutHref : "#"} aria-disabled={!canPay} className={cn("mt-6 flex h-12 w-full items-center justify-center rounded-[8px] text-[16px] font-black", canPay ? "bg-ticketground text-white" : "pointer-events-none bg-surface-3 text-ink-4")}>
                결제하기
              </Link>
            </section>
          )}
        </main>

        <aside className="h-fit min-w-0 rounded-[12px] border border-line bg-white p-6 shadow-ticket-1 lg:sticky lg:top-6">
          <h2 className="clamp-2 text-[20px] font-black text-ink">{show.title}</h2>
          <dl className="mt-5 space-y-3 text-[14px]">
            <BookingSummaryRow label="관람일" value={date || "선택 전"} />
            <BookingSummaryRow label="회차" value={time || "선택 전"} />
            <BookingSummaryRow label="선택 좌석" value={selectedLabels || "선택 전"} />
            <BookingSummaryRow label="매수" value={`${selectedCount}/${quantity}매`} />
            <BookingSummaryRow label="좌석 금액" value={currency(baseAmount)} strong />
            <BookingSummaryRow label="예매 수수료" value={`${currency(serviceFeePerSeat)} × ${selectedCount}`} />
            <BookingSummaryRow label="총 결제금액" value={currency(totalAmount)} total />
          </dl>
          <p className="mt-4 rounded-[8px] bg-tint-yellow px-3 py-2 text-[13px] font-bold text-ink">정책: 3번째 좌석 선택 시 가장 오래된 좌석이 자동 해제됩니다.</p>
        </aside>
      </div>
    </div>
  );
}
