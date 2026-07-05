"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function BookingExpiryNotice({
  date,
  expired,
  showSlug,
  time,
}: {
  readonly date: string;
  readonly expired: boolean;
  readonly showSlug: string;
  readonly time: string;
}) {
  return (
    <section
      {...(expired ? { "data-booking-expired": "" } : {})}
      data-booking-expiry-live
      className={cn(expired ? "rounded-lg border border-ticketground/25 bg-tint-red p-4 text-ink sm:p-5" : "sr-only")}
      aria-live="polite"
    >
      {expired ? (
        <>
          <p className="text-xl font-black text-ticketground">예매 시간이 만료되었습니다</p>
          <p className="mt-2 text-sm font-bold text-ink-3">좌석 선점과 결제를 다시 진행하려면 대기열부터 재입장해 주세요.</p>
          <Link
            href={`/queue/${showSlug}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-sm bg-ink px-4 text-sm font-black text-white"
          >
            다시 예매하기
          </Link>
        </>
      ) : null}
    </section>
  );
}

export function BookingTimerWarning({ visible }: { readonly visible: boolean }) {
  if (!visible) return null;

  return (
    <p role="status" className="rounded-md border border-warn/25 bg-tint-yellow px-4 py-3 text-sm font-black text-ink">
      예매 시간이 1분 이하로 남았습니다. 선택한 좌석을 확인하고 결제를 진행해 주세요.
    </p>
  );
}
