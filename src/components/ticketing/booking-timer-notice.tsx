"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
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
      className={cn(expired ? "rounded-lg border border-ticketground bg-card p-4 text-ink sm:p-5" : "sr-only")}
      aria-live="polite"
    >
      {expired ? (
        <>
          <p className="flex items-center gap-1.5 text-xl font-black text-ticketground">
            <TriangleAlert className="size-5 shrink-0" aria-hidden />
            예매 시간이 만료되었습니다
          </p>
          <p className="mt-2 text-sm font-bold text-ink-3">좌석 선점과 결제를 다시 진행하려면 대기열부터 재입장해 주세요.</p>
          <Link
            href={`/queue/${showSlug}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`}
            className="mt-4 inline-flex h-11 items-center justify-center rounded-sm bg-ink px-4 text-sm font-black text-on-ink"
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
    <p role="status" className="flex items-center gap-2 rounded-md border border-warn bg-card px-4 py-3 text-sm font-black text-ink">
      <TriangleAlert className="size-4 shrink-0 text-warn" aria-hidden />
      예매 시간이 1분 이하로 남았습니다. 선택한 좌석을 확인하고 결제를 진행해 주세요.
    </p>
  );
}
