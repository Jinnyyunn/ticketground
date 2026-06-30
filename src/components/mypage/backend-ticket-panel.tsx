"use client";

import { useEffect, useState } from "react";
import { currency } from "@/data/ticketing";
import { getUserTickets, getVirtualQr, type ApiTicket, type ApiVirtualQr } from "@/lib/ticketground-api";

export function BackendTicketPanel() {
  const [tickets, setTickets] = useState<readonly ApiTicket[]>([]);
  const [qr, setQr] = useState<ApiVirtualQr | null>(null);
  const [status, setStatus] = useState("백엔드 예매내역 동기화 중");

  async function refreshTickets() {
    setStatus("백엔드 예매내역 동기화 중");
    try {
      const nextTickets = await getUserTickets();
      setTickets(nextTickets);
      setStatus(nextTickets.length ? `${nextTickets.length}건의 백엔드 티켓을 불러왔습니다.` : "백엔드 구매 티켓이 아직 없습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "백엔드 예매내역을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    let mounted = true;
    getUserTickets()
      .then((nextTickets) => {
        if (!mounted) return;
        setTickets(nextTickets);
        setStatus(nextTickets.length ? `${nextTickets.length}건의 백엔드 티켓을 불러왔습니다.` : "백엔드 구매 티켓이 아직 없습니다.");
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

  return (
    <section className="mt-5 min-w-0 rounded-[10px] border border-line bg-surface p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-black text-ticketground">백엔드 예매 내역</p>
          <h3 className="balanced-title mt-1 text-[22px] font-black text-ink">소유 티켓·가상 QR</h3>
        </div>
        <button type="button" onClick={refreshTickets} className="h-10 whitespace-nowrap rounded-[8px] border border-line bg-white px-4 text-[13px] font-black text-ink">
          새로고침
        </button>
      </div>
      <p className="mt-2 break-words text-[13px] font-bold text-ink-3">{status}</p>
      <div className="mt-4 grid gap-3">
        {tickets.map((ticket) => (
          <article key={ticket.id} className="rounded-[8px] border border-line bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-black text-ink">{ticket.seatLabel}</p>
                <p className="mt-1 text-[13px] font-bold text-ink-3">{ticket.status} · {currency(ticket.faceValue)}</p>
              </div>
              <button type="button" onClick={() => loadQr(ticket.id)} className="h-10 whitespace-nowrap rounded-[8px] bg-ink px-4 text-[13px] font-black text-white">
                가상 QR 확인
              </button>
            </div>
          </article>
        ))}
        {tickets.length === 0 && <p className="rounded-[8px] bg-white p-4 text-[13px] font-bold text-ink-3">결제 완료 후 이 영역에 백엔드 티켓이 표시됩니다.</p>}
      </div>
      {qr && (
        <div className="mt-4 rounded-[8px] border border-ok bg-white p-4">
          <p className="text-[13px] font-black text-ok">가상 티켓 발급됨</p>
          <p className="mt-1 break-words text-[14px] font-bold text-ink">{qr.eventTitle} · {qr.seatLabel}</p>
          <p className="mt-1 break-words text-[13px] text-ink-3">현장 입장 QR은 {new Date(qr.realQrAvailableAt).toLocaleString("ko-KR")}부터 앱에서만 열립니다.</p>
        </div>
      )}
    </section>
  );
}
