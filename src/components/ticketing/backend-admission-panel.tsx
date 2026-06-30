"use client";

import { useEffect, useState } from "react";
import { getUserTickets, getVirtualQr, type ApiTicket, type ApiVirtualQr } from "@/lib/ticketground-api";

export function BackendAdmissionPanel({ ticketId }: { readonly ticketId: string }) {
  const [tickets, setTickets] = useState<readonly ApiTicket[]>([]);
  const [qr, setQr] = useState<ApiVirtualQr | null>(null);
  const [status, setStatus] = useState("백엔드 티켓 확인 중");
  const activeTicketId = ticketId || tickets[0]?.id || "";

  useEffect(() => {
    let mounted = true;
    getUserTickets()
      .then((nextTickets) => {
        if (!mounted) return;
        setTickets(nextTickets);
        setStatus(nextTickets.length ? `${nextTickets.length}건의 백엔드 보유 티켓 확인` : "백엔드 보유 티켓이 없습니다.");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "백엔드 티켓을 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function loadVirtualQr(nextTicketId = activeTicketId) {
    if (!nextTicketId) {
      setStatus("가상 티켓을 확인할 백엔드 티켓이 없습니다.");
      return;
    }
    setStatus("가상 티켓 QR 확인 중");
    try {
      const nextQr = await getVirtualQr(nextTicketId);
      setQr(nextQr);
      setStatus(`${nextQr.eventTitle} 가상 티켓 발급 완료`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "가상 티켓 QR을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    if (!ticketId) return;
    let mounted = true;
    getVirtualQr(ticketId)
      .then((nextQr) => {
        if (!mounted) return;
        setQr(nextQr);
        setStatus(`${nextQr.eventTitle} 가상 티켓 발급 완료`);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "가상 티켓 QR을 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, [ticketId]);

  return (
    <div className="mt-4 min-w-0 rounded-[10px] border border-line bg-surface p-4" aria-live="polite">
      <p className="text-[14px] font-black text-ink">백엔드 입장권 상태</p>
      <p className="mt-1 break-words text-[13px] font-bold text-ink-3">{status}</p>
      {qr && (
        <dl className="mt-3 grid gap-2 text-[13px] font-bold text-ink-2">
          <div className="flex min-w-0 justify-between gap-3">
            <dt>티켓</dt>
            <dd className="min-w-0 break-all text-right">{qr.ticketId}</dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt>좌석</dt>
            <dd className="min-w-0 break-words text-right">{qr.seatLabel}</dd>
          </div>
          <div className="flex min-w-0 justify-between gap-3">
            <dt>실제 QR</dt>
            <dd className="min-w-0 break-words text-right">{qr.admissionChannel} · {new Date(qr.realQrAvailableAt).toLocaleString("ko-KR")}</dd>
          </div>
        </dl>
      )}
      <button
        type="button"
        disabled={!activeTicketId}
        onClick={() => loadVirtualQr()}
        className="mt-4 h-10 w-full rounded-[8px] bg-ink text-[13px] font-black text-white whitespace-nowrap disabled:bg-surface-3 disabled:text-ink-4"
      >
        가상 티켓 QR 다시 확인
      </button>
    </div>
  );
}
