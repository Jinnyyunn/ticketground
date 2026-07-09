"use client";

import { useEffect, useMemo, useState } from "react";
import { currency } from "@/data/ticketing";
import { cancelResaleListing, getState, getUserTickets, getVirtualQr, type ApiResalePool, type ApiTicket, type ApiVirtualQr } from "@/lib/ticketground-api";
import type { Reservation } from "@/types";
import { ReservationHistorySearch } from "./reservation-history-search";

type BackendTicketPanelProps = {
  readonly reservations: readonly Reservation[];
};

type BackendTicketState = {
  readonly openPools: readonly ApiResalePool[];
  readonly tickets: readonly ApiTicket[];
};

async function loadBackendTicketState(): Promise<BackendTicketState> {
  const [tickets, state] = await Promise.all([getUserTickets(), getState()]);
  return {
    openPools: state.resalePools.filter((pool) => pool.status === "OPEN"),
    tickets,
  };
}

export function BackendTicketPanel({ reservations }: BackendTicketPanelProps) {
  const [tickets, setTickets] = useState<readonly ApiTicket[]>([]);
  const [openPools, setOpenPools] = useState<readonly ApiResalePool[]>([]);
  const [qr, setQr] = useState<ApiVirtualQr | null>(null);
  const [status, setStatus] = useState("백엔드 예매내역 동기화 중");
  const [cancelingPoolId, setCancelingPoolId] = useState("");

  const openPoolByTicketId = useMemo(() => {
    const pools = new Map<string, ApiResalePool>();
    for (const pool of openPools) pools.set(pool.ticketId, pool);
    return pools;
  }, [openPools]);

  async function refreshTickets() {
    setStatus("백엔드 예매내역 동기화 중");
    try {
      const nextState = await loadBackendTicketState();
      setTickets(nextState.tickets);
      setOpenPools(nextState.openPools);
      setStatus(nextState.tickets.length ? `${nextState.tickets.length}건의 백엔드 티켓을 불러왔습니다.` : "백엔드 구매 티켓이 아직 없습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "백엔드 예매내역을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    let mounted = true;
    loadBackendTicketState()
      .then((nextState) => {
        if (!mounted) return;
        setTickets(nextState.tickets);
        setOpenPools(nextState.openPools);
        setStatus(nextState.tickets.length ? `${nextState.tickets.length}건의 백엔드 티켓을 불러왔습니다.` : "백엔드 구매 티켓이 아직 없습니다.");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "백엔드 예매내역을 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function loadQr(ticketId: string) {
    setStatus("가상 QR 확인 중");
    try {
      const nextQr = await getVirtualQr(ticketId);
      setQr(nextQr);
      setStatus(`${nextQr.seatLabel} 가상 QR 확인 완료`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "가상 QR 확인에 실패했습니다.");
    }
  }

  async function cancelRegistration(poolId: string) {
    if (cancelingPoolId) return;
    setCancelingPoolId(poolId);
    setStatus("양도 등록 취소 중");
    try {
      const canceledPool = await cancelResaleListing({ poolId });
      const nextState = await loadBackendTicketState();
      setTickets(nextState.tickets);
      setOpenPools(nextState.openPools);
      setStatus(`풀 ${canceledPool.id} 양도 등록을 취소했습니다.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "양도 등록 취소에 실패했습니다.");
    } finally {
      setCancelingPoolId("");
    }
  }

  return (
    <section className="mt-5 min-w-0 rounded-md border border-line bg-surface p-5" aria-live="polite">
      <ReservationHistorySearch reservations={reservations} />
      <div className="mt-5 rounded-md border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-ticketground">백엔드 소유 티켓</p>
            <h3 className="balanced-title mt-1 text-xl font-black text-ink">가상 QR 확인</h3>
          </div>
          <button type="button" onClick={() => void refreshTickets()} className="h-10 whitespace-nowrap rounded-sm border border-line bg-card px-4 text-sm font-black text-ink">
            새로고침
          </button>
        </div>
        <p className="mt-2 break-words text-sm font-bold text-ink-3">{status}</p>
        <div className="mt-4 grid gap-3">
          {tickets.map((ticket) => {
            const openPool = openPoolByTicketId.get(ticket.id);
            return (
              <article key={ticket.id} className="rounded-sm border border-line bg-surface p-4" data-backend-ticket-row>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-ink">{ticket.seatLabel}</p>
                    <p className="mt-1 text-sm font-bold text-ink-3">{ticket.status} · {currency(ticket.faceValue)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {openPool && (
                      <button
                        type="button"
                        disabled={cancelingPoolId === openPool.id}
                        onClick={() => void cancelRegistration(openPool.id)}
                        className="h-10 whitespace-nowrap rounded-sm border border-line-strong bg-card px-4 text-sm font-black text-ink transition-colors hover:bg-surface disabled:bg-surface-3 disabled:text-ink-4"
                        data-testid="resale-cancel-registration"
                      >
                        {cancelingPoolId === openPool.id ? "취소 중" : "양도 등록 취소"}
                      </button>
                    )}
                    <button type="button" onClick={() => void loadQr(ticket.id)} className="h-10 whitespace-nowrap rounded-sm bg-ink px-4 text-sm font-black text-on-ink">
                      가상 QR 확인
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {tickets.length === 0 && <p className="rounded-sm bg-surface p-4 text-sm font-bold text-ink-3">백엔드 구매 티켓이 아직 없습니다.</p>}
        </div>
      </div>
      {qr && (
        <div className="mt-4 rounded-sm border border-ok bg-card p-4">
          <p className="text-sm font-black text-ok">가상 티켓 발급됨</p>
          <p className="mt-1 break-words text-sm font-bold text-ink">{qr.eventTitle} · {qr.seatLabel}</p>
          <p className="mt-1 break-words text-sm text-ink-3">현장 입장 QR은 {new Date(qr.realQrAvailableAt).toLocaleString("ko-KR")}부터 앱에서만 열립니다.</p>
        </div>
      )}
    </section>
  );
}
