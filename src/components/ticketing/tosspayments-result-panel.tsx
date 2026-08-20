"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { confirmTosspaymentsPurchase, storedSessionUserId } from "@/lib/ticketground-api";
import type { TicketShow } from "@/types";

const serviceFeePerSeat = 2000;

export function TosspaymentsResultPanel({
  show,
  paymentKey,
  orderId,
  paymentMethod,
  date,
  time,
  failMessage,
  ticketIds,
}: {
  readonly show: TicketShow;
  readonly paymentKey: string;
  readonly orderId: string;
  readonly paymentMethod: string;
  readonly date: string;
  readonly time: string;
  readonly failMessage: string;
  // Every ticket this order covers. Falls back to [orderId] below for a
  // single-seat purchase that predates this param (orderId used to always
  // equal the one ticketId being bought).
  readonly ticketIds: readonly string[];
}) {
  const router = useRouter();
  const effectiveTicketIds = ticketIds.length > 0 ? ticketIds : (orderId ? [orderId] : []);
  // Toss's successUrl and failUrl both point here - a paymentKey means the
  // widget completed and handed us a receipt to confirm server-side; its
  // absence means the user cancelled or the payment failed before that.
  // This is derivable straight from props, so it never needs its own state.
  const hasReceipt = Boolean(paymentKey && orderId && effectiveTicketIds.length > 0);
  const [status, setStatus] = useState(hasReceipt ? "결제 승인 처리 중입니다." : failMessage || "토스페이먼츠 결제가 취소되었거나 실패했습니다.");
  const [failed, setFailed] = useState(!hasReceipt);
  const ticketIdsKey = effectiveTicketIds.join(",");

  useEffect(() => {
    if (!hasReceipt) return;
    let cancelled = false;
    (async () => {
      const userId = storedSessionUserId();
      if (!userId) {
        throw new Error("로그인 세션이 만료되었습니다. 다시 로그인한 뒤 예매 내역을 확인해주세요.");
      }
      const purchase = await confirmTosspaymentsPurchase({
        ticketIds: effectiveTicketIds,
        orderId,
        userId,
        paymentMethod: paymentMethod || "CREDIT_CARD",
        tossPaymentKey: paymentKey,
        // Reusing the Toss-issued paymentKey as the idempotency key means a
        // reloaded result page (or a duplicate redirect) replays the same
        // purchase instead of being rejected or double-charging.
        idempotencyKey: paymentKey,
      });
      if (cancelled) return;
      const purchasedTotal = purchase.tickets.reduce((sum, ticket) => sum + ticket.faceValue, 0)
        + purchase.tickets.length * serviceFeePerSeat;
      const params = new URLSearchParams({
        date,
        time,
        seats: purchase.tickets.map((ticket) => ticket.seatLabel).join(" / "),
        count: String(purchase.tickets.length),
        ticketIds: purchase.tickets.map((ticket) => ticket.id).join(","),
        ticketId: purchase.ticket.id,
        total: String(purchasedTotal),
      });
      router.replace(`/reservation/${purchase.ticket.id}?${params.toString()}`);
    })().catch((error: unknown) => {
      if (cancelled) return;
      setFailed(true);
      setStatus(error instanceof Error ? error.message : "결제 승인 처리에 실패했습니다.");
    });

    return () => {
      cancelled = true;
    };
    // ticketIdsKey (not effectiveTicketIds) is the dependency on purpose - a
    // new array reference per render would otherwise re-run this every time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasReceipt, orderId, paymentMethod, paymentKey, date, time, router, ticketIdsKey]);

  return (
    <section className="ticketground-container py-16 text-center">
      <p className="text-sm font-bold text-ticketground">{show.title}</p>
      <h1 className="mt-2 text-2xl font-black text-ink-2">{failed ? "결제를 완료하지 못했습니다" : "결제 승인 처리 중입니다"}</h1>
      <p className="mt-3 text-base font-bold text-ink-3" aria-live="polite">{status}</p>
      {failed ? (
        <Link
          href={`/checkout/${show.slug}`}
          className="mt-6 inline-flex h-11 items-center rounded-sm bg-ticketground px-6 text-sm font-black text-white"
        >
          결제 화면으로 돌아가기
        </Link>
      ) : null}
    </section>
  );
}
