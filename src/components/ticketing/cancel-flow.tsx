"use client";

import Link from "next/link";
import { useState } from "react";
import type { CleanTicketReservation } from "@/types";
import { currency } from "@/data/ticketing";

type CancelFlowProps = {
  readonly reservation: CleanTicketReservation;
};

const cancelReasons = ["일정 변경", "동반자 불참", "좌석 변경 후 재예매", "기타 사유"] as const;

const feePolicies = [
  { timing: "관람 10일 전까지", fee: "0원", note: "현재 적용" },
  { timing: "관람 9~7일 전", fee: "티켓 금액의 10%", note: "예정" },
  { timing: "관람 6~3일 전", fee: "티켓 금액의 20%", note: "예정" },
  { timing: "관람 2일 전~당일", fee: "취소 불가", note: "현장 문의" },
] as const;

export function CancelFlow({ reservation }: CancelFlowProps) {
  const [reason, setReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const refundAmount = reservation.totalAmount;
  const canComplete = reason.length > 0;

  if (completed) {
    return (
      <section className="ticketground-container py-10">
        <div className="mx-auto max-w-[720px] rounded-[20px] border border-line bg-white p-8 text-center shadow-ticket-2">
          <p className="text-sm font-black text-ticketground">mock 취소 요청 접수</p>
          <h1 className="mt-3 text-[34px] font-black text-ink">취소·환불 요청이 기록되었습니다</h1>
          <p className="mx-auto mt-4 max-w-[520px] text-sm leading-loose text-ink-3">
            실제 결제 취소나 환불은 발생하지 않았습니다. 이 완료 화면은 Ticketground 취소 플로우를 검증하기 위한 프론트엔드 mock 상태입니다.
          </p>
          <Link href="/mypage" className="mt-7 inline-flex h-12 items-center justify-center rounded-[8px] bg-ticketground px-6 text-[16px] font-black text-white">
            마이페이지로 이동
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="ticketground-container py-10">
      <p className="text-sm font-black text-ticketground">취소/환불</p>
      <h1 className="mt-2 text-[34px] font-black text-ink">예매 취소 요청</h1>
      <p className="mt-3 text-sm leading-loose text-ink-3">
        이 화면은 실제 결제 취소를 수행하지 않는 mock 취소·환불 플로우입니다. 취소 사유를 선택하면 완료 버튼이 활성화됩니다.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:pr-24 2xl:pr-0">
        <div className="grid gap-5">
          <article className="rounded-[12px] border border-line bg-white p-6">
            <StepHeader index="01" title="예매 확인" />
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-[22px] font-black text-ink">{reservation.showTitle}</h2>
                <p className="mt-2 text-sm text-ink-3">{reservation.venue}</p>
                <p className="mt-1 text-sm font-black text-ink">
                  {reservation.date} {reservation.time}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {reservation.seats.map((seat) => (
                  <span key={seat.id} className="rounded-full border border-line-strong bg-surface px-3 py-2 text-sm font-black text-ink">
                    {seat.label}
                  </span>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-[12px] border border-line bg-white p-6">
            <StepHeader index="02" title="취소 사유" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {cancelReasons.map((cancelReason) => (
                <label
                  key={cancelReason}
                  className={`flex min-h-12 items-center gap-3 rounded-[10px] border px-4 text-sm font-black ${
                    reason === cancelReason ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-line-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={cancelReason}
                    checked={reason === cancelReason}
                    onChange={(event) => setReason(event.target.value)}
                    className="accent-[#1a47ff]"
                  />
                  {cancelReason}
                </label>
              ))}
            </div>
          </article>

          <article className="rounded-[12px] border border-line bg-white p-6">
            <StepHeader index="03" title="수수료 정책" />
            <div className="mt-5 overflow-hidden rounded-[10px] border border-line">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-surface text-ink-3">
                  <tr>
                    <th className="px-4 py-3 font-black">시점</th>
                    <th className="px-4 py-3 font-black">취소 수수료</th>
                    <th className="px-4 py-3 font-black">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {feePolicies.map((policy) => (
                    <tr key={policy.timing} className={policy.note === "현재 적용" ? "bg-tint-yellow font-black text-ink" : "border-t border-line text-ink-3"}>
                      <td className="px-4 py-3">{policy.timing}</td>
                      <td className="px-4 py-3">{policy.fee}</td>
                      <td className="px-4 py-3">{policy.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-[12px] border border-line bg-white p-6">
            <StepHeader index="04" title="환불 계산 및 동의" />
            <div className="mt-5 rounded-[10px] bg-surface p-5 text-sm leading-loose text-ink-3">
              <p>선택 사유: {reason || "아직 선택하지 않음"}</p>
              <p>현재 수수료: 0원</p>
              <p>예상 환불액: {currency(refundAmount)}</p>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-[10px] border border-line p-4 text-sm leading-relaxed text-ink-2">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1 accent-[#1a47ff]" />
              <span>
                취소 수수료와 환불 예정 금액을 확인했습니다. 이 항목은 실제 결제 취소가 아닌 mock 플로우 확인용입니다.
              </span>
            </label>
          </article>
        </div>

        <aside className="h-fit rounded-[12px] border border-line bg-white p-6 shadow-ticket-1 lg:sticky lg:top-[132px]">
          <h2 className="text-[20px] font-black text-ink">환불 예정 금액</h2>
          <dl className="mt-5 grid gap-3 text-sm">
            <SummaryRow label="결제금액" value={currency(reservation.totalAmount)} />
            <SummaryRow label="취소수수료" value="0원" />
            <SummaryRow label="환불금액" value={currency(refundAmount)} strong />
          </dl>
          <button
            type="button"
            disabled={!canComplete}
            onClick={() => setCompleted(true)}
            className="mt-6 h-12 w-full rounded-[8px] bg-ticketground text-[16px] font-black text-white transition enabled:hover:bg-ticketground/90 disabled:bg-surface-3 disabled:text-ink-4"
          >
            mock 취소 요청 완료
          </button>
          {!canComplete && <p className="mt-3 text-sm font-bold text-warn">취소 사유를 선택해야 완료할 수 있습니다.</p>}
        </aside>
      </div>
    </section>
  );
}

function StepHeader({ index, title }: { readonly index: string; readonly title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-full bg-ink text-sm font-black text-white">{index}</span>
      <h2 className="text-[20px] font-black text-ink">{title}</h2>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-line pt-4 text-[18px] font-black text-ticketground" : "text-ink-2"}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
