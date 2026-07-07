"use client";

import { useSyncExternalStore } from "react";
import { currency } from "@/data/ticketing";
import { readDemoCancelHistory, subscribeDemoCancelHistory } from "@/lib/demo-cancel-history";

const emptyCancelHistory = [] as const;

export function CancelHistoryPanel() {
  const history = useSyncExternalStore(subscribeDemoCancelHistory, readDemoCancelHistory, () => emptyCancelHistory);

  return (
    <section id="cancel-history" className="mt-8 scroll-mt-[176px]" aria-live="polite">
      <p className="text-sm font-bold text-ticketground">취소/환불</p>
      <h2 className="mt-2 text-[30px] font-black text-ink-2">취소 내역</h2>
      {history.length === 0 ? (
        <div className="mt-5 rounded-md border border-line bg-surface p-5 text-sm font-bold text-ink-3" data-cancel-history-empty>
          완료된 mock 취소 요청이 없습니다.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {history.map((entry) => (
            <article key={entry.reservationId} className="rounded-md border border-line p-5" data-cancel-history-row>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-ticketground px-2 py-1 text-sm font-bold text-white">취소요청</span>
                <span className="text-sm font-bold text-ink-3">사유 · {entry.reason}</span>
              </div>
              <h3 className="balanced-title mt-3 text-2xl font-black text-ink-2">{entry.showTitle}</h3>
              <p className="mt-2 break-words text-base text-ink-3">{entry.venue}</p>
              <p className="mt-1 text-base font-bold">
                {entry.date} {entry.time} · {entry.seat}
              </p>
              <p className="mt-1 text-sm text-ink-3">예매번호 {entry.reservationId}</p>
              <p className="mt-3 text-sm font-bold text-ticketground">환불 예정 금액 {currency(entry.refundAmount)}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
