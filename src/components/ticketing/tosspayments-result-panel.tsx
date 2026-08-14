"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { confirmTosspaymentsPurchase, storedSessionUserId } from "@/lib/ticketground-api";
import type { TicketShow } from "@/types";

export function TosspaymentsResultPanel({
  show,
  paymentKey,
  orderId,
  paymentMethod,
  date,
  time,
  failMessage,
}: {
  readonly show: TicketShow;
  readonly paymentKey: string;
  readonly orderId: string;
  readonly paymentMethod: string;
  readonly date: string;
  readonly time: string;
  readonly failMessage: string;
}) {
  const router = useRouter();
  // Toss's successUrl and failUrl both point here - a paymentKey means the
  // widget completed and handed us a receipt to confirm server-side; its
  // absence means the user cancelled or the payment failed before that.
  // This is derivable straight from props, so it never needs its own state.
  const hasReceipt = Boolean(paymentKey && orderId);
  const [status, setStatus] = useState(hasReceipt ? "결제 승인 처리 중입니다." : failMessage || "토스페이먼츠 결제가 취소되었거나 실패했습니다.");
  const [failed, setFailed] = useState(!hasReceipt);

  useEffect(() => {
    if (!hasReceipt) return;
    let cancelled = false;
    (async () => {
      const userId = storedSessionUserId();
      if (!userId) {
        throw new Error("로그인 세션이 만료되었습니다. 다시 로그인한 뒤 예매 내역을 확인해주세요.");
      }
      const purchase = await confirmTosspaymentsPurchase({
        ticketId: orderId,
        userId,
        paymentMethod: paymentMethod || "CREDIT_CARD",
        tossPaymentKey: paymentKey,
        // Reusing the Toss-issued paymentKey as the idempotency key means a
        // reloaded result page (or a duplicate redirect) replays the same
        // purchase instead of being rejected or double-charging.
        idempotencyKey: paymentKey,
      });
      if (cancelled) return;
      const params = new URLSearchParams({
        date,
        time,
        seats: purchase.ticket.seatLabel,
        count: "1",
        ticketId: purchase.ticket.id,
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
  }, [hasReceipt, orderId, paymentMethod, paymentKey, date, time, router]);

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
