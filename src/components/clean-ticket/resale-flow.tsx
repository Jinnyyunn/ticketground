"use client";

import { useEffect, useMemo, useState } from "react";
import type { CleanTicketReservation } from "@/types";
import { currency } from "@/data/ticketing";
import { SegmentedControl } from "@/components/ticketground/primitives";
import {
  buyTicket,
  DEMO_EVENT_ID,
  drawResale,
  getState,
  getUserTickets,
  joinResale,
  listResale,
  purchaseResale,
  type ApiResalePool,
  type ApiResaleResult,
  type ApiTicket,
} from "@/lib/ticketground-api";
import { ResaleAuditAside } from "./resale-audit-aside";
import { ResaleFindPanel } from "./resale-find-panel";
import { createPoolCells, feeFor, matchCandidates, resaleTabs, type OwnedSeatOption, type ResaleTab } from "./resale-flow-data";
import { ResaleIntro } from "./resale-intro";
import { ResaleSellPanel } from "./resale-sell-panel";

export function ResaleFlow({ reservation, showTitle }: { readonly reservation: CleanTicketReservation; readonly showTitle: string }) {
  const firstSeat = reservation.seats[0];
  const [tab, setTab] = useState<ResaleTab>("sell");
  const [seatId, setSeatId] = useState(firstSeat?.id ?? "");
  const selectedSeat = reservation.seats.find((seat) => seat.id === seatId) ?? firstSeat;
  const faceValue = selectedSeat?.faceValue ?? 0;
  const [price, setPrice] = useState(Math.round(faceValue * 0.95));
  const [toast, setToast] = useState("");
  const [grade, setGrade] = useState("VIP");
  const [zone, setZone] = useState("1층 중앙");
  const [maxPrice, setMaxPrice] = useState(190000);
  const [pairOnly, setPairOnly] = useState(false);
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [result, setResult] = useState<(typeof matchCandidates)[number] | null>(null);
  const [backendTickets, setBackendTickets] = useState<readonly ApiTicket[]>([]);
  const [backendPool, setBackendPool] = useState<ApiResalePool | null>(null);
  const [backendResult, setBackendResult] = useState<ApiResaleResult | null>(null);
  const [apiStatus, setApiStatus] = useState("보유 티켓 확인 중");
  const [apiBusy, setApiBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const selectedBackendTicket = backendTickets.find((ticket) => ticket.id === seatId);
  const policy = reservation.resale.policy;
  const effectiveFaceValue = selectedBackendTicket?.faceValue ?? faceValue;
  const minPrice = selectedBackendTicket?.minPrice ?? Math.round(effectiveFaceValue * (policy.minPercent / 100));
  const maxAllowedPrice = selectedBackendTicket?.maxPrice ?? Math.round(effectiveFaceValue * (policy.maxPercent / 100));
  const isPriceValid = price >= minPrice && price <= maxAllowedPrice;
  const sellFee = feeFor(price);
  const settlement = price;
  const resultFee = result ? feeFor(result.amount) : 0;
  const filteredCandidates = matchCandidates.filter((candidate) => candidate.grade === grade && candidate.zone === zone && candidate.amount <= maxPrice && (!pairOnly || candidate.pair));

  async function refreshBackendTickets() {
    try {
      const tickets = await getUserTickets();
      setBackendTickets(tickets);
      if (tickets[0]) {
        setSeatId(tickets[0].id);
        setPrice(tickets[0].faceValue);
        setApiStatus(`${tickets.length}건의 보유 티켓 확인`);
      } else {
        setApiStatus("보유 티켓이 없습니다. 버튼으로 테스트 티켓을 먼저 확보하세요.");
      }
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "보유 티켓을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    void refreshBackendTickets();
  }, []);

  async function ensureBackendTicket() {
    if (selectedBackendTicket) return selectedBackendTicket;
    setApiBusy(true);
    setApiStatus("판매 가능 티켓 확보 중");
    try {
      const state = await getState();
      const ticket = state.tickets.find((item) => item.eventId === DEMO_EVENT_ID && item.status === "ON_SALE");
      if (!ticket) throw new Error("판매 가능한 티켓이 없습니다.");
      const purchase = await buyTicket(ticket.id);
      const nextTickets = await getUserTickets();
      setBackendTickets(nextTickets);
      setSeatId(purchase.ticket.id);
      setPrice(purchase.ticket.faceValue);
      setApiStatus(`${purchase.ticket.seatLabel} 보유 티켓 확보`);
      return purchase.ticket;
    } finally {
      setApiBusy(false);
    }
  }

  async function registerBackendPool() {
    if (!isPriceValid || apiBusy) return null;
    setApiBusy(true);
    setApiStatus("공식 재판매 풀 등록 중");
    try {
      const ticket = await ensureBackendTicket();
      const pool = await listResale(ticket.id, price);
      const joined = await joinResale(pool.id);
      setBackendPool(joined);
      setBackendResult(null);
      setToast(`${ticket.seatLabel} 공식 재판매 풀 등록 완료`);
      setApiStatus(`풀 ${joined.id} 등록 · 대기자 ${joined.buyerCount}명`);
      return joined;
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "공식 재판매 등록에 실패했습니다.");
      return null;
    } finally {
      setApiBusy(false);
    }
  }

  async function runBackendPurchase() {
    if (apiBusy) return;
    setApiStatus("즉시 매칭 중");
    try {
      const pool = backendPool?.status === "OPEN" ? backendPool : await registerBackendPool();
      if (!pool) return;
      setApiBusy(true);
      const nextResult = await purchaseResale(pool.id);
      setBackendResult(nextResult);
      setBackendPool(nextResult.pool);
      setApiStatus(`매칭 완료 · 구매자 총액 ${currency(nextResult.buyerTotal)}`);
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "재판매 구매에 실패했습니다.");
    } finally {
      setApiBusy(false);
    }
  }

  const poolCells = useMemo(createPoolCells, []);

  const updateSeat = (nextSeatId: string) => {
    const nextSeat = reservation.seats.find((seat) => seat.id === nextSeatId);
    const nextBackendTicket = backendTickets.find((ticket) => ticket.id === nextSeatId);
    setSeatId(nextSeatId);
    if (nextSeat) setPrice(Math.round(nextSeat.faceValue * 0.95));
    if (nextBackendTicket) setPrice(nextBackendTicket.faceValue);
  };

  const ownedSeatOptions: readonly OwnedSeatOption[] = backendTickets.length
    ? backendTickets.map((ticket) => ({
      id: ticket.id,
      label: ticket.seatLabel,
      faceValue: ticket.faceValue,
    }))
    : reservation.seats.map((seat) => ({
      id: seat.id,
      label: seat.label,
      faceValue: seat.faceValue,
    }));

  const runDraw = () => {
    if (drawing || filteredCandidates.length === 0 || apiBusy) return;
    setResult(null);
    setDrawing(true);
    let step = 0;
    const timer = window.setInterval(() => {
      const candidate = filteredCandidates[step % filteredCandidates.length];
      setActiveCell((step * 7 + candidate.seat.length) % 60);
      step += 1;
      if (step >= 14) {
        window.clearInterval(timer);
        setResult(filteredCandidates[13 % filteredCandidates.length]);
        setDrawing(false);
        void runBackendDraw();
      }
    }, 90);
  };

  async function runBackendDraw() {
    if (apiBusy) return;
    setApiStatus("랜덤 추첨 중");
    try {
      const pool = backendPool?.status === "OPEN" ? backendPool : await registerBackendPool();
      if (!pool) return;
      setApiBusy(true);
      const nextResult = await drawResale(pool.id);
      setBackendResult(nextResult);
      setBackendPool(nextResult.pool);
      setApiStatus(`랜덤 추첨 완료 · 수수료 ${currency(nextResult.fee)}`);
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "랜덤 추첨에 실패했습니다.");
    } finally {
      setApiBusy(false);
    }
  }

  return (
    <section className="ticketground-container py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <ResaleIntro apiStatus={apiStatus} />
          <SegmentedControl label="공식 재판매 탭" options={resaleTabs} value={tab} onValueChange={(value) => setTab(value === "find" ? "find" : "sell")} />

          {tab === "sell" ? (
            <ResaleSellPanel
              apiBusy={apiBusy}
              faceValue={faceValue}
              isPriceValid={isPriceValid}
              maxAllowedPrice={maxAllowedPrice}
              minPrice={minPrice}
              onEnsureTicket={() => void ensureBackendTicket()}
              onPriceChange={setPrice}
              onRegister={() => void registerBackendPool()}
              onSeatChange={updateSeat}
              ownedSeatOptions={ownedSeatOptions}
              policyMaxPercent={policy.maxPercent}
              policyMinPercent={policy.minPercent}
              price={price}
              seatId={seatId}
              sellFee={sellFee}
              settlement={settlement}
              showDate={reservation.date}
              showTime={reservation.time}
              showTitle={showTitle}
            />
          ) : (
            <ResaleFindPanel
              activeCell={activeCell}
              apiBusy={apiBusy}
              backendResult={backendResult}
              drawing={drawing}
              filteredCandidates={filteredCandidates}
              grade={grade}
              maxPrice={maxPrice}
              onBackendPurchase={() => void runBackendPurchase()}
              onDraw={runDraw}
              onGradeChange={setGrade}
              onMaxPriceChange={setMaxPrice}
              onPairOnlyChange={setPairOnly}
              onZoneChange={setZone}
              pairOnly={pairOnly}
              poolCells={poolCells}
              reservationId={reservation.id}
              result={result}
              resultFee={resultFee}
              zone={zone}
            />
          )}
        </div>

        <ResaleAuditAside
          policyMaxPercent={policy.maxPercent}
          policyMinPercent={policy.minPercent}
          reservationId={reservation.id}
          seatLabel={selectedBackendTicket?.seatLabel ?? reservation.seat}
          showTitle={reservation.showTitle}
          toast={toast}
        />
      </div>
    </section>
  );
}
