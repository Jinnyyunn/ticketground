"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { currency } from "@/data/ticketing";
import { buyTicket, DEMO_EVENT_ID, getState } from "@/lib/ticketground-api";
import type { Reservation, TicketShow } from "@/types";

const paymentMethods = [
  { id: "credit", label: "신용카드", note: "카드사 할인 적용" },
  { id: "simple", label: "간편결제", note: "카카오페이·네이버페이" },
  { id: "bank", label: "계좌이체", note: "실시간 출금" },
  { id: "mobile", label: "휴대폰 결제", note: "통신사 한도 확인" },
  { id: "deposit", label: "무통장입금", note: "입금대기 후 확정" },
] as const;

type PaymentMethodId = (typeof paymentMethods)[number]["id"];

type CheckoutSelection = {
  readonly date: string;
  readonly time: string;
  readonly seats: string;
  readonly count: number;
  readonly baseAmount: number;
  readonly discountAmount: number;
  readonly feeAmount: number;
  readonly totalAmount: number;
  readonly ticketId: string;
};

export function CheckoutPanel({
  show,
  reservation,
  selection,
}: {
  show: TicketShow;
  reservation: Reservation;
  selection: CheckoutSelection;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethodId>("credit");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(selection.ticketId ? "좌석 선택 완료" : "좌석 자동 선택 대기");
  const selectedMethod = paymentMethods.find((item) => item.id === method) ?? paymentMethods[0];
  const summaryRows = [
    ["좌석 금액", currency(selection.baseAmount)],
    ["할인", `-${currency(selection.discountAmount)}`],
    ["예매 수수료", currency(selection.feeAmount)],
  ] as const;

  async function completePayment() {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setStatus("결제 처리 중");
    try {
      let ticketId = selection.ticketId;
      if (!ticketId) {
        const state = await getState();
        ticketId = state.tickets.find((ticket) => ticket.eventId === DEMO_EVENT_ID && ticket.status === "ON_SALE")?.id ?? "";
      }
      if (!ticketId) {
        setStatus("구매 가능한 티켓이 없습니다.");
        return;
      }
      const purchase = await buyTicket(ticketId);
      const params = new URLSearchParams({
        date: selection.date,
        time: selection.time,
        seats: purchase.ticket.seatLabel,
        base: String(purchase.ticket.faceValue),
        fee: String(selection.feeAmount),
        total: String(purchase.ticket.faceValue + selection.feeAmount),
        count: "1",
        ticketId: purchase.ticket.id,
      });
      setStatus(`${purchase.payment.label} ${purchase.payment.status} · ${purchase.ticket.id}`);
      router.push(`/reservation/${reservation.id}?${params.toString()}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "결제 처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ticketground-container grid gap-8 py-10 lg:grid-cols-[1fr_360px]">
      <section className="rounded-[10px] border border-[#eee] p-6">
        <p className="text-[14px] font-bold text-ticketground">STEP 3</p>
        <h1 className="mt-1 text-[28px] font-bold text-[#29292d]">결제 정보 확인</h1>
        <p className="mt-2 text-[15px] text-[#666]">좌석과 금액을 확인한 뒤 결제수단과 약관을 선택해 예매를 확정합니다.</p>

        <div className="mt-7 rounded-[10px] bg-[#f8f8f8] p-5">
          <h2 className="text-[19px] font-bold">예매 정보</h2>
          <dl className="mt-4 grid gap-3 text-[14px]">
            {[
              ["공연", show.title],
              ["관람일", `${selection.date} ${selection.time}`],
              ["좌석", selection.seats],
              ["매수", `${selection.count}매`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-[#7e7e81]">{label}</dt>
                <dd className="text-right font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-7 rounded-[10px] border border-[#eee] p-5">
          <h2 className="text-[19px] font-bold">결제수단</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {paymentMethods.map((item) => (
              <label key={item.id} className="flex min-h-14 items-start gap-3 rounded-[8px] border border-[#ddd] px-4 py-3 text-[14px] font-bold">
                <input
                  suppressHydrationWarning
                  type="radio"
                  name="payment-method"
                  checked={method === item.id}
                  onChange={() => setMethod(item.id)}
                  className="accent-[#4154ff]"
                />
                <span>
                  {item.label}
                  <small className="block pt-1 text-[13px] font-medium text-[#777]">{item.note}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-[10px] border border-[#eee] p-4 text-[14px] font-bold">
          <input
            suppressHydrationWarning
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 accent-[#4154ff]"
          />
          결제 조건, 클린티켓 QR 정책, 취소/환불 규정에 동의합니다
        </label>
        <div className="mt-5 rounded-[10px] border border-line bg-surface p-4" aria-live="polite">
          <p className="text-[14px] font-black text-ink">결제 상태</p>
          <p className="mt-1 text-[14px] font-bold text-ink-3">{status}</p>
        </div>
      </section>

      <aside className="h-fit rounded-[10px] border border-[#eee] p-6 lg:sticky lg:top-6">
        <h2 className="clamp-2 text-[20px] font-bold text-[#29292d]">{show.title}</h2>
        <dl className="mt-5 space-y-3 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-[#7e7e81]">관람일</dt>
            <dd className="font-bold">{selection.date}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#7e7e81]">회차</dt>
            <dd className="font-bold">{selection.time}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#7e7e81]">좌석</dt>
            <dd className="text-right font-bold">{selection.seats}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#7e7e81]">결제수단</dt>
            <dd className="font-bold">{selectedMethod.label}</dd>
          </div>
          {summaryRows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-[#7e7e81]">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-[#eee] pt-4">
            <dt className="text-[#7e7e81]">총 결제금액</dt>
            <dd className="text-[20px] font-bold text-ticketground">{currency(selection.totalAmount)}</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={!agreed || submitting}
          onClick={completePayment}
          className="mt-5 h-12 w-full rounded-[8px] bg-ticketground text-[16px] font-bold text-white disabled:bg-[#d8d8d8]"
        >
          {submitting ? "결제 처리 중" : "결제 완료"}
        </button>
      </aside>
    </div>
  );
}
