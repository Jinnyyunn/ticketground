"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getTicketShowBackendEventId } from "@/data/ticketing-backend-events";
import { currency } from "@/data/ticketing";
import { buyTicket, getState } from "@/lib/ticketground-api";
import type { Reservation, TicketShow } from "@/types";

const paymentMethods = [
  { id: "credit", label: "신용카드", note: "카드사 할인 적용" },
  { id: "simple", label: "간편결제", note: "카카오페이·네이버페이" },
  { id: "bank", label: "계좌이체", note: "실시간 출금" },
  { id: "mobile", label: "휴대폰 결제", note: "통신사 한도 확인" },
  { id: "deposit", label: "무통장입금", note: "입금대기 후 확정" },
] as const;

const serviceFeePerSeat = 2000;

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
  const [status, setStatus] = useState(selection.ticketId ? "좌석 금액 확인 중" : "좌석 자동 선택 대기");
  const [trustedTicketAmount, setTrustedTicketAmount] = useState<number | null>(null);
  const backendEventId = getTicketShowBackendEventId(show);
  const selectedMethod = paymentMethods.find((item) => item.id === method) ?? paymentMethods[0];
  const hasSelectedTicket = Boolean(selection.ticketId);
  const amountPending = hasSelectedTicket && trustedTicketAmount === null;
  const trustedBaseAmount = hasSelectedTicket ? trustedTicketAmount ?? 0 : selection.baseAmount;
  const trustedFeeAmount = amountPending ? 0 : selection.count * serviceFeePerSeat;
  const trustedTotalAmount = trustedBaseAmount + trustedFeeAmount;
  const amountLabel = (amount: number) => (amountPending ? "확인 중" : currency(amount));
  const summaryRows = [
    ["좌석 금액", amountLabel(trustedBaseAmount)],
    ["할인", amountPending ? "확인 중" : `-${currency(selection.discountAmount)}`],
    ["예매 수수료", amountLabel(trustedFeeAmount)],
  ] as const;

  useEffect(() => {
    let mounted = true;
    if (!selection.ticketId) {
      setTrustedTicketAmount(null);
      return () => {
        mounted = false;
      };
    }

    getState()
      .then((state) => {
        if (!mounted) return;
        const ticket = state.tickets.find((item) => item.id === selection.ticketId && item.eventId === backendEventId);
        setTrustedTicketAmount(ticket?.faceValue ?? null);
        setStatus(ticket ? "좌석 선택 완료" : "선택한 좌석을 확인할 수 없습니다.");
      })
      .catch(() => {
        if (!mounted) return;
        setTrustedTicketAmount(null);
        setStatus("좌석 금액을 확인하지 못했습니다.");
      });

    return () => {
      mounted = false;
    };
  }, [backendEventId, selection.ticketId]);

  async function completePayment() {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setStatus("결제 처리 중");
    try {
      let ticketId = selection.ticketId;
      if (!ticketId) {
        const state = await getState();
        ticketId = state.tickets.find((ticket) => ticket.eventId === backendEventId && ticket.status === "ON_SALE")?.id ?? "";
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
      <section className="rounded-md border border-line p-6">
        <p className="text-sm font-bold text-ticketground">STEP 3</p>
        <h1 className="mt-1 text-4xl font-black text-ink-2">결제 정보 확인</h1>
        <p className="mt-2 text-base text-ink-3">좌석과 금액을 확인한 뒤 결제수단과 약관을 선택해 예매를 확정합니다.</p>

        <div className="mt-7 rounded-md bg-surface p-5">
          <h2 className="text-[19px] font-black">예매 정보</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["공연", show.title],
              ["관람일", `${selection.date} ${selection.time}`],
              ["좌석", selection.seats],
              ["매수", `${selection.count}매`],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
                <dt className="whitespace-nowrap text-ink-3">{label}</dt>
                <dd className="min-w-0 break-words text-right font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-7 rounded-md border border-line p-5">
          <h2 className="text-[19px] font-black">결제수단</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {paymentMethods.map((item) => (
              <label key={item.id} className="flex min-h-14 items-start gap-3 rounded-sm border border-line px-4 py-3 text-sm font-bold">
                <input
                  suppressHydrationWarning
                  type="radio"
                  name="payment-method"
                  checked={method === item.id}
                  onChange={() => setMethod(item.id)}
                  className="accent-link"
                />
                <span>
                  {item.label}
                  <small className="block pt-1 text-sm font-medium text-ink-3">{item.note}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="mt-5 flex items-start gap-3 rounded-md border border-line p-4 text-sm font-bold">
          <input
            suppressHydrationWarning
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-1 accent-link"
          />
          결제 조건, 클린티켓 QR 정책, 취소/환불 규정에 동의합니다
        </label>
        <div className="mt-5 rounded-md border border-line bg-surface p-4" aria-live="polite">
          <p className="text-sm font-black text-ink">결제 상태</p>
          <p className="mt-1 text-sm font-bold text-ink-3">{status}</p>
        </div>
      </section>

      <aside className="h-fit rounded-md border border-line p-6 lg:sticky lg:top-6">
        <h2 className="clamp-2 text-2xl font-black text-ink-2">{show.title}</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">관람일</dt>
            <dd className="font-bold">{selection.date}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">회차</dt>
            <dd className="font-bold">{selection.time}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">좌석</dt>
            <dd className="text-right font-bold">{selection.seats}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-3">결제수단</dt>
            <dd className="font-bold">{selectedMethod.label}</dd>
          </div>
          {summaryRows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-ink-3">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-line pt-4">
            <dt className="text-ink-3">총 결제금액</dt>
            <dd className="text-2xl font-bold text-ticketground">{amountLabel(trustedTotalAmount)}</dd>
          </div>
        </dl>
        <button
          type="button"
          disabled={!agreed || submitting || amountPending}
          onClick={completePayment}
          className="mt-5 h-12 w-full rounded-sm bg-ticketground text-lg font-bold text-white disabled:bg-surface-3"
        >
          {submitting ? "결제 처리 중" : "결제 완료"}
        </button>
      </aside>
    </div>
  );
}
