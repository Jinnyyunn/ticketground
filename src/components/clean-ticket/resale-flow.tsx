"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Armchair, CalendarClock, Check, Copy, Hash, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CleanTicketReservation } from "@/types";
import { currency } from "@/data/ticketing";
import { cn } from "@/lib/utils";
import {
  buyTicket,
  cancelResaleListing,
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

const resaleRegistrationNotice = "양도 티켓 등록 후 MY 페이지에서 양도 티켓을 취소할 수 있습니다.";

function resaleStatusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "양도 등록중";
    case "CANCELED":
      return "취소됨";
    case "MATCHED":
      return "양도 완료";
    default:
      return status;
  }
}

export function ResaleFlow({
  reservation,
  sessionUserId,
  showPoster,
  showTitle,
}: {
  readonly reservation: CleanTicketReservation;
  readonly sessionUserId: string;
  readonly showPoster?: string;
  readonly showTitle: string;
}) {
  const router = useRouter();
  const firstSeat = reservation.seats[0];
  const [tab, setTab] = useState<ResaleTab>("sell");
  const [seatId, setSeatId] = useState(firstSeat?.id ?? "");
  const selectedSeat = reservation.seats.find((seat) => seat.id === seatId) ?? firstSeat;
  const faceValue = selectedSeat?.faceValue ?? 0;
  const [price, setPrice] = useState(faceValue);
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
  const [registeredPools, setRegisteredPools] = useState<readonly ApiResalePool[]>([]);

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

  const refreshBackendTickets = useCallback(async () => {
    try {
      const tickets = await getUserTickets(sessionUserId);
      setBackendTickets(tickets);
      if (tickets[0]) {
        setApiStatus(`${tickets.length}건의 보유 티켓 확인`);
      } else {
        setApiStatus("보유 티켓이 없습니다. 버튼으로 테스트 티켓을 먼저 확보하세요.");
      }
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "보유 티켓을 불러오지 못했습니다.");
    }
  }, [sessionUserId]);

  useEffect(() => {
    void refreshBackendTickets();
  }, [refreshBackendTickets]);

  const refreshRegisteredPools = useCallback(async () => {
    try {
      const state = await getState();
      setRegisteredPools(state.resalePools.filter((pool) => pool.sellerId === sessionUserId));
    } catch {
      // best-effort; keep the previously loaded list on failure
    }
  }, [sessionUserId]);

  useEffect(() => {
    void refreshRegisteredPools();
  }, [refreshRegisteredPools]);

  async function cancelRegistration(poolId: string) {
    if (apiBusy) return;
    setApiBusy(true);
    try {
      await cancelResaleListing({ poolId, sellerId: sessionUserId });
      setToast("양도가 취소되었습니다.");
      await refreshRegisteredPools();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "양도 취소에 실패했습니다.");
    } finally {
      setApiBusy(false);
    }
  }

  async function ensureBackendTicket() {
    if (selectedBackendTicket) return selectedBackendTicket;
    setApiBusy(true);
    setApiStatus("판매 가능 티켓 확보 중");
    try {
      const state = await getState();
      const ticket = state.tickets.find((item) => item.eventId === DEMO_EVENT_ID && item.status === "ON_SALE");
      if (!ticket) throw new Error("판매 가능한 티켓이 없습니다.");
      const purchase = await buyTicket(ticket.id, sessionUserId);
      const nextTickets = await getUserTickets(sessionUserId);
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
    if ((selectedBackendTicket && !isPriceValid) || apiBusy) return null;
    setApiBusy(true);
    setApiStatus("CLEAN 티켓 공식 풀 등록 중");
    try {
      const ticket = await ensureBackendTicket();
      const listingPrice = selectedBackendTicket ? price : ticket.faceValue;
      if (listingPrice !== price) setPrice(listingPrice);
      const pool = await listResale(ticket.id, listingPrice, sessionUserId, reservation.showSlug);
      const joined = await joinResale(pool.id);
      setBackendPool(joined);
      setBackendResult(null);
      setToast(`${ticket.seatLabel} CLEAN 티켓 공식 풀 등록 완료`);
      setApiStatus(`풀 ${joined.id} 등록 · 대기자 ${joined.buyerCount}명`);
      await refreshRegisteredPools();
      return joined;
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "CLEAN 티켓 공식 풀 등록에 실패했습니다.");
      return null;
    } finally {
      setApiBusy(false);
    }
  }

  async function registerAndRedirectToEligibleList() {
    const pool = await registerBackendPool();
    if (!pool) return;
    window.alert(resaleRegistrationNotice);
    router.push("/resale");
  }

  async function runBackendPurchase() {
    if (apiBusy) return;
    setApiBusy(true);
    setApiStatus("즉시 매칭 중");
    try {
      const state = backendPool?.status === "OPEN" ? null : await getState();
      const pool = backendPool?.status === "OPEN"
        ? backendPool
        : state?.resalePools.find((item) => item.status === "OPEN" && item.price <= maxPrice);
      if (!pool) {
        setApiStatus("구매 가능한 CLEAN 티켓 공식 풀이 없습니다.");
        return;
      }
      const nextResult = await purchaseResale(pool.id, sessionUserId);
      setBackendResult(nextResult);
      setBackendPool(nextResult.pool);
      setApiStatus(`매칭 완료 · 구매자 총액 ${currency(nextResult.buyerTotal)}`);
    } catch (error) {
      setApiStatus(error instanceof Error ? error.message : "CLEAN 티켓 구매에 실패했습니다.");
    } finally {
      setApiBusy(false);
    }
  }

  const poolCells = useMemo(createPoolCells, []);

  const updateSeat = (nextSeatId: string) => {
    const nextSeat = reservation.seats.find((seat) => seat.id === nextSeatId);
    const nextBackendTicket = backendTickets.find((ticket) => ticket.id === nextSeatId);
    setSeatId(nextSeatId);
    if (nextSeat) setPrice(nextSeat.faceValue);
    if (nextBackendTicket) setPrice(nextBackendTicket.faceValue);
  };

  const reservationSeatOptions: readonly OwnedSeatOption[] = reservation.seats.map((seat) => ({
    id: seat.id,
    label: seat.label,
    faceValue: seat.faceValue,
  }));
  const backendSeatOptions: readonly OwnedSeatOption[] = backendTickets
    .filter((ticket) => !reservation.seats.some((seat) => seat.id === ticket.id))
    .map((ticket) => ({
      id: ticket.id,
      label: ticket.seatLabel,
      faceValue: ticket.faceValue,
    }));
  const ownedSeatOptions: readonly OwnedSeatOption[] = [...reservationSeatOptions, ...backendSeatOptions];

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
    <>
    <section className="ticketground-container py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_1px_360px]">
        <div className="grid gap-6">
          <ResaleIntro apiStatus={apiStatus} />
          <ResaleReservationContext
            reservation={reservation}
            selectedSeatLabel={selectedSeat?.label ?? reservation.seat}
            showPoster={showPoster}
            showTitle={showTitle}
          />
          <ResaleTabBar value={tab} onValueChange={setTab} />

          {tab === "sell" ? (
            <ResaleSellPanel
              apiBusy={apiBusy}
              faceValue={effectiveFaceValue}
              isPriceValid={isPriceValid}
              maxAllowedPrice={maxAllowedPrice}
              minPrice={minPrice}
              onEnsureTicket={() => void ensureBackendTicket()}
              onPriceChange={setPrice}
              onRegister={() => void registerAndRedirectToEligibleList()}
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

        <div className="hidden bg-line-strong lg:block" aria-hidden="true" />

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
    <section id="resale-history" className="ticketground-container scroll-mt-[176px] py-10">
      <div className="rounded-xl border border-line bg-surface p-5" aria-live="polite">
        <p className="text-xs font-black text-ticketground">마이페이지</p>
        <h2 className="mt-1 text-2xl font-black text-ink">양도내역</h2>
        {registeredPools.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {registeredPools.map((pool) => {
              const cancelable = pool.status === "OPEN";
              return (
                <article
                  key={pool.id}
                  className="rounded-lg border border-line bg-card p-4"
                  data-resale-history-row
                  data-resale-pool-status={pool.status}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={cn("rounded-full px-3 py-1 text-xs font-black", cancelable ? "bg-ticketground text-white" : "bg-surface-2 text-ink-3")}>
                        {resaleStatusLabel(pool.status)}
                      </span>
                      <p className="mt-2 text-sm font-bold text-ink-3">
                        {currency(pool.price)} · 대기자 {pool.buyerCount}명
                      </p>
                    </div>
                    {cancelable && (
                      <button
                        type="button"
                        disabled={apiBusy}
                        onClick={() => void cancelRegistration(pool.id)}
                        className="h-10 rounded-sm border border-line-strong bg-card px-4 text-sm font-black text-ink transition-colors hover:bg-surface disabled:bg-surface-3 disabled:text-ink-4 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        취소
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-line bg-card p-4 text-sm font-bold text-ink-3">
            아직 등록한 양도 티켓이 없습니다.
          </p>
        )}
      </div>
    </section>
    </>
  );
}

function ResaleReservationContext({
  reservation,
  selectedSeatLabel,
  showPoster,
  showTitle,
}: {
  readonly reservation: CleanTicketReservation;
  readonly selectedSeatLabel: string;
  readonly showPoster?: string;
  readonly showTitle: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyReservationId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reservation.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (unsupported browser/context) — no-op
    }
  }, [reservation.id]);

  const stats: readonly {
    readonly icon: typeof Hash;
    readonly label: string;
    readonly value: string;
    readonly copyable?: boolean;
    readonly accent?: boolean;
  }[] = [
    { icon: Hash, label: "예약번호", value: reservation.id, copyable: true },
    { icon: CalendarClock, label: "회차", value: `${reservation.date} ${reservation.time}` },
    { icon: Armchair, label: "좌석", value: selectedSeatLabel },
    { icon: Wallet, label: "결제", value: currency(reservation.totalAmount), accent: true },
  ];

  return (
    <section
      className="grid gap-4 rounded-xl border border-line-strong bg-background p-4 shadow-ticket-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:p-5"
      aria-labelledby="resale-context-title"
      data-testid="resale-reservation-context"
    >
      {showPoster ? (
        <div className="relative h-24 w-18 overflow-hidden rounded-lg border border-line bg-surface shadow-ticket-1 sm:h-24 sm:w-18">
          <Image
            src={showPoster}
            alt=""
            fill
            sizes="72px"
            className="object-cover"
            unoptimized={showPoster.endsWith(".gif")}
          />
        </div>
      ) : (
        <div className="grid h-24 w-18 place-items-center rounded-lg border border-line bg-ink text-center text-lg font-black leading-none text-on-ink shadow-ticket-1">
          CT
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-black text-ticketground">예약 기준 거래</p>
        <h2 id="resale-context-title" className="mt-1 balanced-title text-3xl font-black leading-tight text-ink">
          이 예약을 CLEAN 티켓으로 양도합니다
        </h2>
        <p className="mt-2 text-sm font-bold leading-relaxed text-ink-3">{showTitle}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "relative rounded-md border border-line bg-surface px-3 py-2",
                stat.accent && "border-ink bg-ink",
              )}
            >
              <dt className={cn("flex items-center gap-1.5 text-xs font-black", stat.accent ? "text-on-ink/60" : "text-ink-4")}>
                <stat.icon className="size-3.5 shrink-0" aria-hidden />
                {stat.label}
              </dt>
              <dd className={cn("mt-0.5 truncate pr-6 font-black", stat.accent ? "text-accent-2" : "text-ink-2")}>
                {stat.value}
              </dd>
              {stat.copyable && (
                <button
                  type="button"
                  onClick={() => void copyReservationId()}
                  className="absolute right-2 top-2 rounded p-1 text-ink-4 transition-colors hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-label="예약번호 복사"
                >
                  {copied ? <Check className="size-3.5 shrink-0 text-ok" aria-hidden /> : <Copy className="size-3.5 shrink-0" aria-hidden />}
                </button>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ResaleTabBar({
  onValueChange,
  value,
}: {
  readonly onValueChange: (value: ResaleTab) => void;
  readonly value: ResaleTab;
}) {
  return (
    <div role="group" aria-label="CLEAN 티켓 양도 탭" className="grid gap-2 rounded-xl border border-line bg-surface p-1 shadow-ticket-1 sm:inline-grid sm:grid-cols-2">
      {resaleTabs.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            data-resale-tab-state={selected ? "selected" : "idle"}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative h-11 rounded-lg px-5 text-sm font-black transition-all duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
              selected
                ? "bg-ink text-on-ink shadow-ticket-2 after:absolute after:inset-x-4 after:bottom-1 after:h-0.5 after:rounded-full after:bg-accent-2"
                : "bg-background text-ink-3 hover:bg-card hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
