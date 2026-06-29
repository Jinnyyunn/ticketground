"use client";

import { useEffect, useMemo, useState } from "react";
import type { CleanTicketReservation } from "@/types";
import { currency } from "@/data/ticketing";
import { CleanTicketPolicyBanner, SegmentedControl, SummaryRow, TicketgroundSurface, TicketgroundTag, TicketgroundToast } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import { ResaleFindPanel } from "./resale-find-panel";
import { useResaleBackend, type ResaleTicketOption } from "./use-resale-backend";

type ResaleTab = "sell" | "find";

const resaleTabs = [
  { label: "팔기", value: "sell" },
  { label: "구하기", value: "find" },
] as const;

const resaleFeePercent = 5;

function feeFor(amount: number) {
  return Math.ceil(amount * (resaleFeePercent / 100));
}

export function ResaleFlow({ reservation, sessionUserId, showTitle }: {
  readonly reservation: CleanTicketReservation;
  readonly sessionUserId: string;
  readonly showTitle: string;
}) {
  const policy = reservation.resale.policy;
  const fallbackTickets = useMemo<readonly ResaleTicketOption[]>(
    () => reservation.seats.map((seat) => ({
      id: seat.id,
      label: seat.label,
      faceValue: seat.faceValue,
      minPrice: Math.round(seat.faceValue * (policy.minPercent / 100)),
      maxPrice: Math.round(seat.faceValue * (policy.maxPercent / 100)),
    })),
    [policy.maxPercent, policy.minPercent, reservation.seats],
  );
  const backendResale = useResaleBackend({ sessionUserId });
  const sellOptions = backendResale.loaded ? backendResale.ownedTickets : fallbackTickets;
  const firstSeat = sellOptions[0] ?? fallbackTickets[0];
  const [tab, setTab] = useState<ResaleTab>("sell");
  const [seatId, setSeatId] = useState(firstSeat?.id ?? "");
  const selectedSeat = sellOptions.find((seat) => seat.id === seatId) ?? firstSeat;
  const faceValue = selectedSeat?.faceValue ?? 0;
  const [price, setPrice] = useState(Math.round(faceValue * 0.95));
  const [grade, setGrade] = useState("VIP");
  const [zone, setZone] = useState("1층 중앙");
  const [maxPrice, setMaxPrice] = useState(190000);
  const [pairOnly, setPairOnly] = useState(false);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const result = backendResale.result;

  const minPrice = selectedSeat?.minPrice ?? Math.round(faceValue * (policy.minPercent / 100));
  const maxAllowedPrice = selectedSeat?.maxPrice ?? Math.round(faceValue * (policy.maxPercent / 100));
  const isPriceValid = price >= minPrice && price <= maxAllowedPrice;
  const sellFee = feeFor(price);
  const settlement = price;
  const filteredCandidates = backendResale.openPools.filter((candidate) => candidate.grade === grade && candidate.zone === zone && candidate.amount <= maxPrice && (!pairOnly || candidate.pair));
  const canRegister = backendResale.loaded && sellOptions.length > 0 && Boolean(selectedSeat) && isPriceValid && !backendResale.busy;

  useEffect(() => {
    const nextSeat = sellOptions[0];
    if (!nextSeat || sellOptions.some((seat) => seat.id === seatId)) return;
    setSeatId(nextSeat.id);
    setPrice(Math.round(nextSeat.faceValue * 0.95));
  }, [seatId, sellOptions]);

  const updateSeat = (nextSeatId: string) => {
    const nextSeat = sellOptions.find((seat) => seat.id === nextSeatId);
    setSeatId(nextSeatId);
    if (nextSeat) setPrice(Math.round(nextSeat.faceValue * 0.95));
  };

  const registerSelectedTicket = () => {
    if (!selectedSeat || !canRegister) return;
    void backendResale.registerTicket({ ticketId: selectedSeat.id, price });
  };

  const runDraw = async () => {
    if (drawing || filteredCandidates.length === 0) return;
    setDrawing(true);
    const selectedCandidate = filteredCandidates[0];
    let step = 0;
    const timer = window.setInterval(() => {
      const candidate = filteredCandidates[step % filteredCandidates.length];
      setActiveCell((step * 7 + candidate.seat.length) % 60);
      step += 1;
    }, 90);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 720));
      await backendResale.purchasePool(selectedCandidate.poolId);
    } finally {
      window.clearInterval(timer);
      setDrawing(false);
    }
  };

  return (
    <section className="ticketground-container py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <header>
            <TicketgroundTag tone="sale">CLEAN TICKET</TicketgroundTag>
            <h1 className="mt-3 text-4xl font-black text-ink">공식 재판매</h1>
            <p className="mt-3 max-w-[720px] text-base leading-loose text-ink-3">
              좌석 지정 거래를 막고 공식 풀에서 조건부 랜덤 매칭으로 배정합니다. 재판매 등록은 정가의 90~100%만 허용됩니다.
            </p>
          </header>

          <CleanTicketPolicyBanner>
            <ul className="grid gap-2 sm:grid-cols-3">
              <li>등록가: 정가의 90~100%</li>
              <li>구매 수수료: 거래액 {resaleFeePercent}%</li>
              <li>구매자는 좌석번호 직접 선택 불가</li>
            </ul>
          </CleanTicketPolicyBanner>

          <SegmentedControl label="공식 재판매 탭" options={resaleTabs} value={tab} onValueChange={(value) => setTab(value === "find" ? "find" : "sell")} />

          {tab === "sell" ? (
            <TicketgroundSurface className="grid gap-5">
              <div>
                <h2 className="text-2xl font-black text-ink">보유 티켓 등록</h2>
                <p className="mt-1 text-sm text-ink-3">{showTitle} · {reservation.date} {reservation.time}</p>
              </div>
              <label className="grid gap-2 text-sm font-bold text-ink-2">
                보유 좌석
                <select
                  className="h-11 rounded-sm border border-line bg-background px-3 text-base"
                  value={seatId}
                  onChange={(event) => updateSeat(event.currentTarget.value)}
                  data-testid="owned-ticket-select"
                >
                  {sellOptions.length ? sellOptions.map((seat) => (
                    <option key={seat.id} value={seat.id}>
                      {seat.label} · 정가 {currency(seat.faceValue)}
                    </option>
                  )) : <option value="">백엔드 보유 티켓 없음</option>}
                </select>
              </label>
              <div className="grid gap-3">
                <label className="grid gap-2 text-sm font-bold text-ink-2">
                  등록 가격
                  <input
                    className={cn("h-11 rounded-sm border px-3 text-base", isPriceValid ? "border-line" : "border-destructive bg-tint-red")}
                    type="number"
                    min={0}
                    value={price}
                    onChange={(event) => setPrice(Number(event.currentTarget.value))}
                    data-testid="resale-price-input"
                  />
                </label>
                <input
                  aria-label="등록 가격 슬라이더"
                  type="range"
                  min={minPrice}
                  max={maxAllowedPrice}
                  step={500}
                  value={Math.min(Math.max(price, minPrice), maxAllowedPrice)}
                  onChange={(event) => setPrice(Number(event.currentTarget.value))}
                />
                <p className={cn("text-sm font-bold", isPriceValid ? "text-ok" : "text-destructive")} data-testid="policy-message">
                  {backendResale.error
                    ? backendResale.error
                    : isPriceValid
                    ? `정책 OK: ${policy.minPercent}~${policy.maxPercent}% 범위 안입니다.`
                    : `오류: 정가 ${currency(faceValue)} 기준 ${currency(minPrice)}~${currency(maxAllowedPrice)}만 등록할 수 있습니다.`}
                </p>
              </div>
              <dl className="rounded-lg bg-surface px-4">
                <SummaryRow label="등록가" value={currency(price)} />
                <SummaryRow label={`구매 수수료 ${resaleFeePercent}%`} value={currency(sellFee)} />
                <SummaryRow label="정산 예정액" value={currency(settlement)} strong />
              </dl>
              <button
                type="button"
                disabled={!canRegister}
                onClick={registerSelectedTicket}
                className="h-12 rounded-sm bg-ink px-5 text-base font-black text-white disabled:bg-ink-4"
                data-testid="resale-register"
              >
                {backendResale.busy ? "등록 중" : "공식 풀에 등록"}
              </button>
            </TicketgroundSurface>
          ) : (
            <ResaleFindPanel
              activeCell={activeCell}
              busy={backendResale.busy}
              drawing={drawing}
              filteredCandidates={filteredCandidates}
              grade={grade}
              maxPrice={maxPrice}
              onPurchase={() => {
                void runDraw();
              }}
              pairOnly={pairOnly}
              resaleFeePercent={resaleFeePercent}
              reservationId={reservation.id}
              result={result}
              setGrade={setGrade}
              setMaxPrice={setMaxPrice}
              setPairOnly={setPairOnly}
              setZone={setZone}
              zone={zone}
            />
          )}
        </div>

        <aside className="h-fit rounded-xl border border-line bg-card p-5 shadow-ticket-1">
          <p className="text-sm font-bold text-ticketground">감사 원장 연동</p>
          <h2 className="mt-2 text-2xl font-black text-ink">{reservation.id}</h2>
          <p className="mt-2 text-sm font-bold text-ink-3">
            현재 데모 계정: {backendResale.sessionUser?.name ?? sessionUserId}
          </p>
          <dl className="mt-4 rounded-lg bg-surface px-4">
            <SummaryRow label="공연" value={reservation.showTitle} />
            <SummaryRow label="보유 좌석" value={reservation.seat} />
            <SummaryRow label="정책 범위" value={`${policy.minPercent}~${policy.maxPercent}%`} />
            <SummaryRow label="구매 수수료" value={`${resaleFeePercent}%`} strong />
          </dl>
          {backendResale.toast && <div className="mt-4" data-testid="resale-toast"><TicketgroundToast title={backendResale.toast} tone={backendResale.error ? "error" : "success"} /></div>}
        </aside>
      </div>
    </section>
  );
}
