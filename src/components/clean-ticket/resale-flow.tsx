"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CleanTicketReservation } from "@/types";
import { currency } from "@/data/ticketing";
import { CleanTicketPolicyBanner, SegmentedControl, SummaryRow, TicketgroundChip, TicketgroundSurface, TicketgroundTag, TicketgroundToast } from "@/components/ticketground/primitives";
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
import { cn } from "@/lib/utils";

type ResaleTab = "sell" | "find";

const resaleTabs = [
  { label: "팔기", value: "sell" },
  { label: "구하기", value: "find" },
] as const;

const gradeOptions: readonly string[] = ["VIP", "R", "S", "A"];
const zoneOptions: readonly string[] = ["1층 중앙", "1층 사이드", "2층", "오케스트라"];
const matchCandidates = [
  { seat: "VIP H-14", grade: "VIP", zone: "1층 중앙", amount: 180500, pair: true, seed: "0x7ce91340", ledger: "#10515" },
  { seat: "VIP H-15", grade: "VIP", zone: "1층 중앙", amount: 182000, pair: true, seed: "0x4a5f2k9b", ledger: "#10516" },
  { seat: "R G-09", grade: "R", zone: "1층 사이드", amount: 152000, pair: false, seed: "0x91ab304c", ledger: "#10517" },
  { seat: "S K-21", grade: "S", zone: "2층", amount: 114000, pair: false, seed: "0x2f80ac11", ledger: "#10518" },
] as const;

function feeFor(amount: number) {
  return Math.ceil(amount * 0.05);
}

export function ResaleFlow({ reservation, showTitle }: {
  readonly reservation: CleanTicketReservation;
  readonly showTitle: string;
}) {
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
  const [apiStatus, setApiStatus] = useState("백엔드 보유 티켓 확인 중");
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
        setApiStatus(`${tickets.length}건의 백엔드 보유 티켓 확인`);
      } else {
        setApiStatus("보유 티켓이 없습니다. 버튼으로 백엔드 테스트 티켓을 먼저 확보하세요.");
      }
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "백엔드 보유 티켓을 불러오지 못했습니다.");
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
      if (!ticket) throw new Error("판매 가능한 백엔드 티켓이 없습니다.");
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
    setApiStatus("백엔드 즉시 매칭 중");
    try {
      const pool = backendPool?.status === "OPEN" ? backendPool : await registerBackendPool();
      if (!pool) return;
      setApiBusy(true);
      const nextResult = await purchaseResale(pool.id);
      setBackendResult(nextResult);
      setBackendPool(nextResult.pool);
      setApiStatus(`매칭 완료 · 구매자 총액 ${currency(nextResult.buyerTotal)}`);
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "백엔드 재판매 구매에 실패했습니다.");
    } finally {
      setApiBusy(false);
    }
  }

  const poolCells = useMemo(
    () =>
      Array.from({ length: 60 }, (_, index) => ({
        id: `pool-${index + 1}`,
        highlighted: index % 7 === 0 || index % 11 === 0,
      })),
    [],
  );

  const updateSeat = (nextSeatId: string) => {
    const nextSeat = reservation.seats.find((seat) => seat.id === nextSeatId);
    const nextBackendTicket = backendTickets.find((ticket) => ticket.id === nextSeatId);
    setSeatId(nextSeatId);
    if (nextSeat) setPrice(Math.round(nextSeat.faceValue * 0.95));
    if (nextBackendTicket) setPrice(nextBackendTicket.faceValue);
  };

  const ownedSeatOptions = backendTickets.length
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
    setApiStatus("백엔드 랜덤 추첨 중");
    try {
      const pool = backendPool?.status === "OPEN" ? backendPool : await registerBackendPool();
      if (!pool) return;
      setApiBusy(true);
      const nextResult = await drawResale(pool.id);
      setBackendResult(nextResult);
      setBackendPool(nextResult.pool);
      setApiStatus(`랜덤 추첨 완료 · 수수료 ${currency(nextResult.fee)}`);
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "백엔드 랜덤 추첨에 실패했습니다.");
    } finally {
      setApiBusy(false);
    }
  }

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
              <li>플랫폼 수수료: 거래액 5%</li>
              <li>구매자는 좌석번호 직접 선택 불가</li>
            </ul>
          </CleanTicketPolicyBanner>
          <div className="rounded-lg border border-line bg-surface p-4" aria-live="polite">
            <p className="text-sm font-black text-ink">백엔드 재판매 상태</p>
            <p className="mt-1 text-sm font-bold text-ink-3">{apiStatus}</p>
          </div>

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
                  {ownedSeatOptions.map((seat) => (
                    <option key={seat.id} value={seat.id}>
                      {seat.label} · 정가 {currency(seat.faceValue)}
                    </option>
                  ))}
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
                  {isPriceValid
                    ? `정책 OK: ${policy.minPercent}~${policy.maxPercent}% 범위 안입니다.`
                    : `오류: 정가 ${currency(faceValue)} 기준 ${currency(minPrice)}~${currency(maxAllowedPrice)}만 등록할 수 있습니다.`}
                </p>
              </div>
              <dl className="rounded-lg bg-surface px-4">
                <SummaryRow label="등록가" value={currency(price)} />
                <SummaryRow label="예상 구매자 수수료 5%" value={currency(sellFee)} />
                <SummaryRow label="정산 예정액" value={currency(settlement)} strong />
              </dl>
              <button
                type="button"
                disabled={apiBusy}
                onClick={() => void ensureBackendTicket()}
                className="h-11 rounded-sm border border-line bg-white px-5 text-sm font-black text-ink disabled:bg-surface-3"
              >
                백엔드 테스트 티켓 확보
              </button>
              <button
                type="button"
                disabled={!isPriceValid || apiBusy}
                onClick={() => void registerBackendPool()}
                className="h-12 rounded-sm bg-ink px-5 text-base font-black text-white disabled:bg-ink-4"
                data-testid="resale-register"
              >
                {apiBusy ? "처리 중" : "공식 풀에 등록"}
              </button>
            </TicketgroundSurface>
          ) : (
            <TicketgroundSurface className="grid gap-5">
              <div>
                <h2 className="text-2xl font-black text-ink">조건으로 구하기</h2>
                <p className="mt-1 text-sm text-ink-3">등급, 구역, 가격, 연석 조건만 고르고 좌석은 추첨 후 공개됩니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {gradeOptions.map((item) => (
                  <TicketgroundChip key={item} active={grade === item} onClick={() => setGrade(item)}>
                    {item}석
                  </TicketgroundChip>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-bold text-ink-2">
                  구역
                  <select className="h-11 rounded-sm border border-line bg-background px-3" value={zone} onChange={(event) => setZone(event.currentTarget.value)}>
                    {zoneOptions.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink-2">
                  최대 가격
                  <input className="h-11 rounded-sm border border-line px-3" type="number" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.currentTarget.value))} />
                </label>
                <label className="flex items-center gap-3 rounded-sm border border-line px-3 text-sm font-bold text-ink-2">
                  <input type="checkbox" checked={pairOnly} onChange={(event) => setPairOnly(event.currentTarget.checked)} />
                  연석만
                </label>
              </div>
              <div className="grid grid-cols-10 gap-1 rounded-lg bg-surface p-3" aria-label="현재 열린 공식 재판매 풀 60칸" data-testid="pool-grid">
                {poolCells.map((cell, index) => (
                  <span
                    key={cell.id}
                    data-testid="pool-cell"
                    data-seat-pickable="false"
                    className={cn(
                      "aspect-square rounded-xs border border-line bg-background",
                      cell.highlighted && "bg-tint-yellow",
                      activeCell === index && "border-ticketground bg-ticketground",
                    )}
                  />
                ))}
              </div>
              <p className="text-sm font-bold text-ink-3" data-testid="draw-guard">좌석번호는 추첨 완료 전까지 공개되지 않으며 직접 선택할 수 없습니다.</p>
              <button type="button" onClick={runDraw} disabled={drawing || apiBusy || filteredCandidates.length === 0} className="h-12 rounded-sm bg-ticketground px-5 text-base font-black text-white disabled:bg-ink-4" data-testid="resale-draw">
                {drawing ? "후보 순환 중" : `조건부 랜덤 매칭 시작 · 후보 ${filteredCandidates.length}건`}
              </button>
              <button type="button" onClick={() => void runBackendPurchase()} disabled={apiBusy} className="h-12 rounded-sm bg-ink px-5 text-base font-black text-white disabled:bg-ink-4" data-testid="resale-purchase">
                백엔드 즉시 구매 매칭
              </button>
              <div className={cn("rounded-lg border border-line p-4", result && "border-ok bg-tint-yellow")} data-testid="match-result">
                {backendResult ? (
                  <div className="grid gap-3">
                    <p className="text-lg font-black text-ink">백엔드 매칭 완료: {backendResult.ticket.seatLabel}</p>
                    <dl className="grid gap-1 text-sm text-ink-2">
                      <SummaryRow label="거래 금액" value={currency(backendResult.pool.price)} />
                      <SummaryRow label="수수료 5%" value={currency(backendResult.fee)} />
                      <SummaryRow label="구매자 총액" value={currency(backendResult.buyerTotal)} />
                      <SummaryRow label="판매자 정산" value={currency(backendResult.sellerSettlement)} strong />
                    </dl>
                    <Link className="inline-flex h-11 items-center justify-center rounded-sm bg-ink px-5 text-sm font-black text-white" href={`/reservation/${reservation.id}?ticketId=${backendResult.ticket.id}`} data-testid="confirm-cta">
                      매칭 좌석으로 확인하기
                    </Link>
                  </div>
                ) : result ? (
                  <div className="grid gap-3">
                    <p className="text-lg font-black text-ink">매칭 완료: {result.seat}</p>
                    <dl className="grid gap-1 text-sm text-ink-2">
                      <SummaryRow label="거래 금액" value={currency(result.amount)} />
                      <SummaryRow label="예상 수수료 5%" value={currency(resultFee)} />
                      <SummaryRow label="랜덤 시드" value={result.seed} />
                      <SummaryRow label="원장 번호" value={result.ledger} strong />
                    </dl>
                    <Link className="inline-flex h-11 items-center justify-center rounded-sm bg-ink px-5 text-sm font-black text-white" href={`/reservation/${reservation.id}`} data-testid="confirm-cta">
                      매칭 좌석으로 확인하기
                    </Link>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-ink-3">{filteredCandidates.length ? "아직 좌석이 공개되지 않았습니다. 매칭을 시작하세요." : "조건에 맞는 공식 풀 좌석이 없습니다."}</p>
                )}
              </div>
            </TicketgroundSurface>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-line bg-card p-5 shadow-ticket-1">
          <p className="text-sm font-bold text-ticketground">감사 원장 연동</p>
          <h2 className="mt-2 text-2xl font-black text-ink">{reservation.id}</h2>
          <dl className="mt-4 rounded-lg bg-surface px-4">
            <SummaryRow label="공연" value={reservation.showTitle} />
            <SummaryRow label="보유 좌석" value={selectedBackendTicket?.seatLabel ?? reservation.seat} />
            <SummaryRow label="정책 범위" value={`${policy.minPercent}~${policy.maxPercent}%`} />
            <SummaryRow label="백엔드 수수료" value="5%" strong />
          </dl>
          {toast && <div className="mt-4" data-testid="resale-toast"><TicketgroundToast title={toast} tone="success" /></div>}
        </aside>
      </div>
    </section>
  );
}
