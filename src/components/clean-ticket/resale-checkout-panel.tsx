"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";
import type { TicketShow } from "@/types";
import { currency } from "@/data/ticketing";
import {
  DEMO_BUYER_ID,
  getState,
  purchaseResale,
  type ApiResalePool,
  type ApiResaleResult,
  type ApiTicket,
} from "@/lib/ticketground-api";
import { SummaryRow, TicketgroundSurface } from "@/components/ticketground/primitives";

type ResaleCheckoutPanelProps = {
  readonly poolId: string;
  readonly shows: readonly TicketShow[];
  readonly sessionUserId?: string;
};

type Listing = {
  readonly pool: ApiResalePool;
  readonly ticket: ApiTicket;
  readonly show: TicketShow;
};

const OFFICIAL_RESALE_FEE_RATE = 0.05;

export function ResaleCheckoutPanel({ poolId, shows, sessionUserId }: ResaleCheckoutPanelProps) {
  const buyerId = sessionUserId || DEMO_BUYER_ID;
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [status, setStatus] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [result, setResult] = useState<ApiResaleResult | null>(null);

  useEffect(() => {
    let mounted = true;
    getState()
      .then((state) => {
        if (!mounted) return;
        const pool = state.resalePools.find((item) => item.id === poolId && item.status === "OPEN");
        const ticket = pool ? state.tickets.find((item) => item.id === pool.ticketId) : undefined;
        const show = pool?.showSlug ? shows.find((item) => item.slug === pool.showSlug) : undefined;
        setListing(pool && ticket && show ? { pool, ticket, show } : null);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setListing(null);
        setStatus(error instanceof Error ? error.message : "양도 티켓 정보를 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, [poolId, shows]);

  async function handlePurchase() {
    if (purchasing) return;
    setPurchasing(true);
    setStatus("결제 처리 중");
    try {
      const nextResult = await purchaseResale(poolId, buyerId);
      setResult(nextResult);
      setStatus("결제 완료");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "결제에 실패했습니다.");
    } finally {
      setPurchasing(false);
    }
  }

  if (listing === undefined) {
    return (
      <section className="ticketground-container py-10">
        <p className="text-sm font-bold text-ink-3">양도 티켓 정보를 불러오는 중입니다.</p>
      </section>
    );
  }

  if (listing === null) {
    return (
      <section className="ticketground-container py-10">
        <TicketgroundSurface className="text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-black text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {status || "이미 판매되었거나 존재하지 않는 양도 티켓입니다."}
          </p>
          <Link
            href="/resale"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-ink px-5 text-sm font-black text-on-ink hover:bg-ink-2"
          >
            양도 허용 티켓 목록으로
          </Link>
        </TicketgroundSurface>
      </section>
    );
  }

  const { pool, ticket, show } = listing;
  const fee = Math.ceil(pool.price * OFFICIAL_RESALE_FEE_RATE);
  const buyerTotal = pool.price + fee;

  if (result) {
    return (
      <section className="ticketground-container py-10">
        <TicketgroundSurface className="text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-black text-ok">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            결제가 완료되었습니다
          </p>
          <h1 className="balanced-title mt-3 text-2xl font-black text-ink">{show.title}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {show.venue} · {result.ticket.seatLabel}
          </p>
          <dl className="mx-auto mt-5 max-w-[360px] text-left">
            <SummaryRow label="결제 금액" value={currency(result.buyerTotal)} strong />
            <SummaryRow label="결제 수단" value={result.payment.label} />
            <SummaryRow label="결제 상태" value={result.payment.status} />
          </dl>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/mypage#reservations"
              className="inline-flex h-11 items-center rounded-lg bg-ink px-5 text-sm font-black text-on-ink hover:bg-ink-2"
            >
              내 예매내역 보기
            </Link>
            <Link
              href="/resale"
              className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-black text-ink hover:border-line-strong"
            >
              양도 허용 티켓 더 보기
            </Link>
          </div>
        </TicketgroundSurface>
      </section>
    );
  }

  return (
    <section className="ticketground-container py-10">
      <p className="flex items-center gap-1.5 text-sm font-black text-ticketground">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        CLEAN TICKET 결제
      </p>
      <h1 className="balanced-title mt-2 text-[28px] font-black leading-tight text-ink sm:text-4xl">양도 티켓 결제</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <TicketgroundSurface className="flex gap-4">
          <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            <Image src={show.poster} alt={show.title} fill sizes="96px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <span className="rounded bg-ticketground px-2 py-1 text-xs font-black text-white">{show.badge ?? "양도중"}</span>
            <h2 className="balanced-title mt-2 text-lg font-black leading-snug text-ink">{show.title}</h2>
            <p className="mt-1 text-sm text-ink-3">
              {show.venue} · {ticket.seatLabel}
            </p>
            <p className="mt-1 text-sm text-ink-4">{show.period}</p>
          </div>
        </TicketgroundSurface>

        <TicketgroundSurface>
          <dl>
            <SummaryRow label="정가" value={currency(ticket.faceValue)} />
            <SummaryRow label="양도가격" value={currency(pool.price)} />
            <SummaryRow label="구매자 수수료 5%" value={currency(fee)} />
            <SummaryRow label="총 결제 금액" value={currency(buyerTotal)} strong />
          </dl>
          {status && !purchasing && <p className="mt-3 text-sm font-bold text-destructive">{status}</p>}
          <button
            type="button"
            disabled={purchasing}
            onClick={() => void handlePurchase()}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-ink text-base font-black text-on-ink transition-colors hover:bg-ink-2 disabled:bg-ink-4"
          >
            {purchasing ? "결제 처리 중" : "결제하기"}
          </button>
        </TicketgroundSurface>
      </div>
    </section>
  );
}
