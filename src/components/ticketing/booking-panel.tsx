"use client";

import { Armchair, ArrowRight, CalendarDays, CheckCircle2, Clock3, CreditCard, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookingSelection, TicketShow } from "@/types";
import { getTicketShowBackendEventId, getTicketShowPerformanceDateId } from "@/data/ticketing-backend-events";
import { currency } from "@/data/ticketing";
import {
  bindChartLayoutToBackendSeats,
  chartCoversAllBackendSeats,
} from "@/lib/seat-charts/bind-backend-seats";
import { apiChartForShow } from "@/lib/seat-charts/client";
import type { InventoryResult, SellableSeat } from "@/lib/seat-charts/inventory";
import { canEnterSeatSelection, seatChartReadinessMessage } from "@/lib/seat-charts/readiness";
import { toggleChartSeatSelection } from "@/lib/seat-charts/seat-selection";
import { getSeatMap, type ApiSeatMap } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";
import { BookingSummaryRow } from "./booking-summary-row";
import { BookingExpiryNotice, BookingTimerWarning } from "./booking-timer-notice";
import { ChartSeatMap } from "./chart-seat-map";

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
type PublishedChartState = {
  readonly requestKey: string;
  readonly inventory: InventoryResult | null;
  readonly name: string | null;
  readonly message: string | null;
};

export function BookingPanel({ show, initialSelection, initialTimerSeconds = 7 * 60 }: BookingPanelProps) {
  const chartPrices = useMemo(() => ({
    VIP: show.prices.find((price) => price.grade === "VIP")?.price ?? 190000,
    R: show.prices.find((price) => price.grade === "R")?.price ?? 160000,
    S: show.prices.find((price) => price.grade === "S")?.price ?? 120000,
    A: show.prices.find((price) => price.grade === "A")?.price ?? 80000,
  }), [show.prices]);
  const chartRequestKey = `${show.slug}:${chartPrices.VIP}:${chartPrices.R}:${chartPrices.S}:${chartPrices.A}`;
  const [date, setDate] = useState(initialSelection.date || show.schedules[0]?.date || "");
  const [time, setTime] = useState(initialSelection.time || show.schedules[0]?.times[0] || "");
  const [quantity, setQuantity] = useState(maxSelectableSeats);
  const [step, setStep] = useState<BookingStep>("schedule");
  const [seatMap, setSeatMap] = useState<ApiSeatMap | null>(null);
  const [seatMapStatus, setSeatMapStatus] = useState("좌석도 로딩 중");
  const [publishedChart, setPublishedChart] = useState<PublishedChartState | null>(null);
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
        setSeatMapStatus(
          nextSeatMap.seats.some((seat) => seat.available)
            ? `${nextSeatMap.event.title} · ${nextSeatMap.seats.length}석 로드`
            : "선택 가능한 좌석이 없습니다.",
        );
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

  useEffect(() => {
    let mounted = true;
    void apiChartForShow(show.slug, {
      vip: chartPrices.VIP,
      r: chartPrices.R,
      s: chartPrices.S,
      a: chartPrices.A,
    })
      .then((response) => {
        if (!mounted) return;
        setPublishedChart({
          requestKey: chartRequestKey,
          inventory: response.source === "published" ? response.inventory : null,
          name: response.source === "published" ? response.record?.name ?? response.chart?.name ?? null : null,
          message: response.source === "not_ready" ? response.message ?? "공연장 좌석 배치도 준비 중" : null,
        });
      })
      .catch(() => {
        if (!mounted) return;
        setPublishedChart({ requestKey: chartRequestKey, inventory: null, name: null, message: "공연장 좌석 배치도를 불러오지 못했습니다." });
      });
    return () => {
      mounted = false;
    };
  }, [chartPrices.A, chartPrices.R, chartPrices.S, chartPrices.VIP, chartRequestKey, show.slug]);

  // Stable across the once-a-second timer re-render so VenueSeatMap (wrapped in
  // React.memo) doesn't reconcile its marker set every tick.
  const backendSeats = useMemo(() => seatMap?.seats ?? [], [seatMap]);
  const allBoundChartSeats = useMemo(
    () => publishedChart?.requestKey === chartRequestKey && publishedChart.inventory
      ? bindChartLayoutToBackendSeats(publishedChart.inventory.seats, backendSeats)
      : [],
    [backendSeats, chartRequestKey, publishedChart],
  );
  const boundChartSeats = useMemo(() => allBoundChartSeats.filter((seat) => !seat.sold), [allBoundChartSeats]);
  const maximumQuantity = useMemo(() => Math.max(
    maxSelectableSeats,
    ...boundChartSeats.map((seat) => {
      if (seat.bookingMode === "variable") return seat.maxOccupancy ?? maxSelectableSeats;
      if (seat.bookingMode === "whole") return seat.availableTicketIds?.length ?? seat.memberLabels?.length ?? maxSelectableSeats;
      return maxSelectableSeats;
    }),
  ), [boundChartSeats]);
  const quantityOptions = useMemo(() => Array.from({ length: maximumQuantity }, (_, index) => index + 1), [maximumQuantity]);
  const usePublishedChart = Boolean(
    publishedChart?.inventory && chartCoversAllBackendSeats(allBoundChartSeats, backendSeats),
  );
  const selectedBackendSeats = seatMap?.seats.filter((seat) => selectedBackendTicketIds.includes(seat.id)) ?? [];
  const selectedChartSeatIds = boundChartSeats
    .filter((seat) => (seat.backendTicketIds ?? [seat.id]).some((id) => selectedBackendTicketIds.includes(id)))
    .map((seat) => seat.id);
  const selectedLabels = selectedBackendSeats.map((seat) => seat.label).join(", ");
  const selectedCount = selectedBackendSeats.length;
  const baseAmount = selectedBackendSeats.reduce((sum, seat) => sum + seat.price, 0);
  const feeAmount = selectedCount * serviceFeePerSeat;
  const totalAmount = baseAmount + feeAmount;
  const canChooseSeats = canEnterSeatSelection({
    bookable: show.sale.bookable,
    timerExpired,
    date,
    time,
    quantity,
    chartReady: Boolean(publishedChart?.requestKey === chartRequestKey && publishedChart.inventory),
    inventoryReady: Boolean(seatMap && usePublishedChart),
  });
  const canPay = show.sale.bookable && !timerExpired && selectedBackendSeats.length > 0 && selectedBackendSeats.length <= quantity;
  // Every selected seat's ticket id must reach checkout, not just the first
  // one - dropping the rest here is what used to make a 2-seat purchase
  // charge for (and deliver) only 1 ticket. ticketIds carries the full list;
  // ticketId is kept too so any old single-seat bookmark/link still works.
  const checkoutHref = `/checkout/${show.slug}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&seats=${encodeURIComponent(selectedLabels)}&count=${selectedCount}&ticketId=${encodeURIComponent(selectedBackendTicketIds[0] ?? "")}&ticketIds=${encodeURIComponent(selectedBackendTicketIds.join(","))}`;

  const selectChartSeat = useCallback((seat: SellableSeat) => {
    setSelectedBackendTicketIds((current) => {
      const next = toggleChartSeatSelection(current, seat, quantity);
      if (seat.bookingMode && next.length > 0) setQuantity(next.length);
      return next;
    });
  }, [quantity]);

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
          <div className="flex shrink-0 flex-col items-end gap-1">
            <p className="hidden text-[11px] font-bold text-ink-4 sm:block">남은 예매 시간</p>
            <div
              data-booking-timer
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-sm px-4 py-2 text-xl font-black tabular-nums shadow-ticket-1 transition-colors",
                timerExpired
                  ? "bg-ticketground text-white"
                  : timerWarning
                    ? "bg-warn text-white"
                    : "bg-ink text-on-ink",
              )}
              aria-label="남은 예매 시간"
            >
              <Clock3 className={cn("size-4 text-accent-2", timerWarning && "motion-safe:animate-pulse")} aria-hidden />
              {minutes(timerSeconds)}
            </div>
          </div>
        </div>
      </div>

      <div className="ticketground-container grid min-w-0 gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-5">
          <nav className="grid grid-cols-2 gap-2" aria-label="예매 단계">
            {steps.map((item, index) => {
              const active = item.id === step;
              const disabled = item.id === "seats" && !canChooseSeats;
              const completed = item.id === "schedule" && step === "seats";
              const StepIcon = item.id === "schedule" ? CalendarDays : Armchair;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStep(item.id)}
                  disabled={disabled}
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-sm border text-sm font-black whitespace-nowrap transition-colors",
                    active
                      ? "border-ink bg-ink text-on-ink shadow-ticket-1"
                      : "border-line bg-card text-ink-3 hover:border-line-strong hover:bg-surface hover:text-ink-2",
                    disabled && "cursor-not-allowed opacity-50 hover:border-line hover:bg-card hover:text-ink-3",
                  )}
                >
                  {completed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
                  ) : (
                    <StepIcon className={cn("size-4 shrink-0", active ? "text-accent-2" : "text-ink-4")} aria-hidden />
                  )}
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
          <div data-testid="booking-identity-notice" className="break-keep rounded-lg border border-line bg-card p-4 text-sm font-bold text-ink-3">
            {show.checkoutNotice} 이미 다른 계정에서 인증된 휴대폰 번호는 다시 사용할 수 없습니다.
          </div>

          {step === "schedule" && (
            <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-card p-4 sm:p-6">
              <p className="text-sm font-black text-ticketground">STEP 1</p>
              <h2 className="balanced-title mt-1 text-2xl font-black text-ink sm:text-[24px]">관람일·회차·매수를 선택하세요</h2>
              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr_180px]">
                <div>
                  <h3 className="flex items-center gap-1.5 text-lg font-black text-ink">
                    <CalendarDays className="size-4 text-ink-4" aria-hidden />
                    관람일
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {show.schedules.map((schedule) => (
                      <button disabled={!show.sale.bookable} key={schedule.date} type="button" onClick={() => changeDate(schedule.date)} className={cn("whitespace-nowrap rounded-sm border px-3 py-3 text-sm font-bold transition-colors active:scale-[0.98]", date === schedule.date ? "border-ink bg-ink text-on-ink shadow-ticket-1" : "border-line bg-card text-ink hover:border-line-strong hover:bg-surface", !show.sale.bookable && "cursor-not-allowed opacity-50 hover:border-line hover:bg-card active:scale-100")}>{schedule.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="flex items-center gap-1.5 text-lg font-black text-ink">
                    <Clock3 className="size-4 text-ink-4" aria-hidden />
                    회차
                  </h3>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(show.schedules.find((schedule) => schedule.date === date)?.times ?? []).map((item) => (
                      <button disabled={!show.sale.bookable} key={item} type="button" onClick={() => setTime(item)} className={cn("rounded-sm border px-3 py-3 text-sm font-bold transition-colors active:scale-[0.98]", time === item ? "border-ink bg-ink text-on-ink shadow-ticket-1" : "border-line bg-card text-ink hover:border-line-strong hover:bg-surface", !show.sale.bookable && "cursor-not-allowed opacity-50 hover:border-line hover:bg-card active:scale-100")}>{item}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-ink">매수</h3>
                  <div className="mt-3 flex rounded-sm border border-line bg-card p-1">
                    {quantityOptions.map((count) => (
                      <button disabled={!show.sale.bookable} key={count} type="button" onClick={() => setQuantity(count)} className={cn("h-11 flex-1 rounded-[6px] text-base font-black transition-colors", quantity === count ? "bg-ticketground text-white shadow-ticket-1" : "text-ink-3 hover:bg-surface hover:text-ink", !show.sale.bookable && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-ink-3")}>{count}매</button>
                    ))}
                  </div>
                  <p className="mt-3 break-keep text-sm font-bold text-ink-3">최대 {maximumQuantity}매까지 선택할 수 있습니다.</p>
                </div>
              </div>
              <button type="button" disabled={!canChooseSeats} onClick={() => setStep("seats")} className="mt-6 flex h-12 items-center justify-center gap-2 rounded-sm bg-ticketground px-6 text-base font-black text-white shadow-ticket-1 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-ink-4 disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100">
                좌석 선택으로 이동
                <ArrowRight className="size-4" aria-hidden />
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
                <p className="text-sm font-bold text-ink-3">
                  {publishedChart?.requestKey !== chartRequestKey && "공연장 좌석 배치도 확인 중"}
                  {publishedChart?.requestKey === chartRequestKey && usePublishedChart && `게시 배치도 · ${publishedChart.name ?? "이름 없음"}`}
                  {publishedChart?.requestKey === chartRequestKey && !usePublishedChart && (publishedChart.message ?? seatChartReadinessMessage({ loaded: true, chartReady: Boolean(publishedChart.inventory), bindingReady: false }))}
                  {seatMap && ` · ${seatMapStatus}`}
                </p>
              </div>
              <div className="mt-5 min-w-0 space-y-4">
                {seatMap && usePublishedChart && publishedChart?.inventory ? (
                    <ChartSeatMap
                      seats={boundChartSeats}
                      bounds={publishedChart.inventory.bounds}
                      selectedSeatIds={selectedChartSeatIds}
                      onSelect={selectChartSeat}
                    />
                ) : (
                  <div className="rounded-lg border border-line bg-surface p-4 text-sm font-bold text-ink-3" role="status">
                    <p className={cn(publishedChart?.requestKey === chartRequestKey && "text-center")}>
                      {publishedChart?.requestKey === chartRequestKey
                        ? publishedChart.message ?? seatChartReadinessMessage({ loaded: true, chartReady: Boolean(publishedChart.inventory), bindingReady: usePublishedChart })
                        : "공연장 좌석 배치도 확인 중"}
                    </p>
                    {publishedChart?.requestKey !== chartRequestKey ? (
                      <div className="mt-3 space-y-3" aria-hidden>
                        <div className="mx-auto aspect-[4/3] w-full max-w-[560px] motion-safe:animate-pulse rounded-lg bg-black/10" />
                        <div className="flex flex-wrap justify-center gap-2">
                          {Array.from({ length: 6 }, (_, index) => (
                            <div key={index} className="h-6 w-16 motion-safe:animate-pulse rounded-full bg-black/10" />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {canPay ? (
                <Link href={checkoutHref} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-ticketground text-lg font-black text-white shadow-ticket-1 transition hover:brightness-110 active:scale-[0.99]">
                  결제하기
                  <CreditCard className="size-4" aria-hidden />
                </Link>
              ) : (
                <button type="button" disabled className="mt-6 h-12 w-full rounded-sm bg-surface-3 text-lg font-black text-ink-4">
                  결제하기
                </button>
              )}
            </section>
          )}
        </main>

        <aside className="h-fit min-w-0 overflow-hidden rounded-lg border border-line bg-card shadow-ticket-1 lg:sticky lg:top-6">
          <div className="relative h-40 w-full overflow-hidden bg-surface-2 sm:h-48">
            <Image
              src={show.poster}
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 1024px) 360px, 100vw"
              className="object-cover"
              unoptimized={show.poster.endsWith(".gif")}
            />
            <div className="absolute inset-0 bg-linear-to-t from-scrim/75 via-scrim/10 to-transparent" />
            <p className="absolute top-3 left-4 rounded-full bg-scrim/40 px-2.5 py-1 text-[11px] font-black text-on-scrim backdrop-blur-sm">예매 요약</p>
            <h2 className="clamp-2 absolute right-4 bottom-3 left-4 text-xl font-black text-on-scrim">{show.title}</h2>
          </div>
          <div className="p-6">
            <dl className="space-y-3 text-sm">
              <BookingSummaryRow label="관람일" value={date || "선택 전"} />
              <BookingSummaryRow label="회차" value={time || "선택 전"} />
              <BookingSummaryRow label="선택 좌석" value={selectedLabels || "선택 전"} />
              <BookingSummaryRow label="매수" value={`${selectedCount}/${quantity}매`} />
              <BookingSummaryRow label="좌석 금액" value={currency(baseAmount)} strong />
              <BookingSummaryRow label="예매 수수료" value={`${currency(serviceFeePerSeat)} × ${selectedCount}`} />
              <BookingSummaryRow label="총 결제금액" value={currency(totalAmount)} total />
            </dl>
            <p className="mt-4 flex items-start gap-2 break-keep rounded-lg border border-warn bg-tint-yellow px-3 py-2.5 text-sm font-bold text-ink">
              <Info className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
              정책: 최대 {maximumQuantity}매까지 선택할 수 있습니다.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
