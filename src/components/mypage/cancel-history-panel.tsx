"use client";

import { useEffect, useState } from "react";
import { currency } from "@/data/ticketing";
import { readDemoCancelHistory, type DemoCancelHistoryEntry } from "@/lib/demo-cancel-history";

export function CancelHistoryPanel() {
  const [history, setHistory] = useState<readonly DemoCancelHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(readDemoCancelHistory());
  }, []);

  return (
    <section id="cancel-history" className="mt-8 scroll-mt-[176px]" aria-live="polite">
      <p className="text-[14px] font-bold text-ticketground">취소/환불</p>
      <h2 className="mt-2 text-[30px] font-bold text-[#29292d]">취소 내역</h2>
      {history.length === 0 ? (
        <div className="mt-5 rounded-[10px] border border-[#eee] bg-surface p-5 text-[14px] font-bold text-ink-3" data-cancel-history-empty>
          완료된 mock 취소 요청이 없습니다.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {history.map((entry) => (
            <article key={entry.reservationId} className="rounded-[10px] border border-[#eee] p-5" data-cancel-history-row>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#fff3d0] px-2 py-1 text-[13px] font-bold text-ticketground">취소요청</span>
                <span className="text-[13px] font-bold text-[#777]">사유 · {entry.reason}</span>
              </div>
              <h3 className="balanced-title mt-3 text-[22px] font-bold text-[#29292d]">{entry.showTitle}</h3>
              <p className="mt-2 break-words text-[15px] text-[#666]">{entry.venue}</p>
              <p className="mt-1 text-[15px] font-bold">
                {entry.date} {entry.time} · {entry.seat}
              </p>
              <p className="mt-1 text-[13px] text-[#777]">예매번호 {entry.reservationId}</p>
              <p className="mt-3 text-[14px] font-bold text-ticketground">환불 예정 금액 {currency(entry.refundAmount)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
