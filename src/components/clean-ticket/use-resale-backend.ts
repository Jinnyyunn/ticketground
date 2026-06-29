"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getDemoSession,
  getPublicResalePools,
  getUserTickets,
  listTicketForResale,
  purchaseResaleTicket,
  TicketgroundApiError,
  type PublicResalePool,
  type PublicSessionUser,
  type PublicTicket,
} from "@/lib/ticketground-api";

type ZoneMeta = {
  readonly grade: string;
  readonly zone: string;
};

export type ResaleTicketOption = {
  readonly id: string;
  readonly label: string;
  readonly faceValue: number;
  readonly minPrice: number;
  readonly maxPrice: number;
};

export type ResalePoolCandidate = {
  readonly poolId: string;
  readonly ticketId: string;
  readonly seat: string;
  readonly grade: string;
  readonly zone: string;
  readonly amount: number;
  readonly pair: boolean;
  readonly seed: string;
  readonly ledger: string;
  readonly buyerCount: number;
};

export type ResaleMatchResult = {
  readonly seat: string;
  readonly amount: number;
  readonly fee: number;
  readonly buyerTotal: number;
  readonly settlement: number;
  readonly seed: string;
  readonly ledger: string;
  readonly paymentLabel: string;
};

function zoneMeta(zoneId: string): ZoneMeta {
  switch (zoneId) {
    case "zone_vip":
      return { grade: "VIP", zone: "1층 중앙" };
    case "zone_r":
      return { grade: "R", zone: "1층 사이드" };
    case "zone_s":
      return { grade: "S", zone: "2층" };
    default:
      return { grade: zoneId.replace(/^zone_/, "").toUpperCase(), zone: "기타" };
  }
}

function apiErrorText(error: unknown) {
  if (error instanceof TicketgroundApiError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return "요청을 처리하지 못했습니다.";
}

function ticketOption(ticket: PublicTicket): ResaleTicketOption {
  return {
    id: ticket.id,
    label: ticket.seatLabel,
    faceValue: ticket.faceValue,
    minPrice: ticket.minPrice,
    maxPrice: ticket.maxPrice,
  };
}

function poolCandidate(pool: PublicResalePool): ResalePoolCandidate {
  const meta = zoneMeta(pool.zoneId);
  return {
    poolId: pool.id,
    ticketId: pool.ticketId,
    seat: `${meta.grade} 공식 재판매 풀`,
    grade: meta.grade,
    zone: meta.zone,
    amount: pool.price,
    pair: false,
    seed: pool.id,
    ledger: pool.id,
    buyerCount: pool.buyerCount,
  };
}

export function useResaleBackend({ sessionUserId }: { readonly sessionUserId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionUser, setSessionUser] = useState<PublicSessionUser | null>(null);
  const [ownedTickets, setOwnedTickets] = useState<readonly ResaleTicketOption[]>([]);
  const [openPools, setOpenPools] = useState<readonly ResalePoolCandidate[]>([]);
  const [result, setResult] = useState<ResaleMatchResult | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [currentUser, tickets, pools] = await Promise.all([getDemoSession(sessionUserId), getUserTickets(sessionUserId), getPublicResalePools()]);
    setSessionUser(currentUser);
    setOwnedTickets(tickets.filter((ticket) => ticket.status === "OWNED").map(ticketOption));
    setOpenPools(pools.filter((pool) => pool.status === "OPEN").map(poolCandidate));
    setLoaded(true);
  }, [sessionUserId]);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError("");
    setToast("");
    setResult(null);
    Promise.all([getDemoSession(sessionUserId), getUserTickets(sessionUserId), getPublicResalePools()])
      .then(([currentUser, tickets, pools]) => {
        if (!active) return;
        setSessionUser(currentUser);
        setOwnedTickets(tickets.filter((ticket) => ticket.status === "OWNED").map(ticketOption));
        setOpenPools(pools.filter((pool) => pool.status === "OPEN").map(poolCandidate));
        setLoaded(true);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(apiErrorText(caught));
        setSessionUser(null);
        setOwnedTickets([]);
        setOpenPools([]);
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [sessionUserId]);

  const registerTicket = useCallback(async ({ ticketId, price }: { readonly ticketId: string; readonly price: number }) => {
    setBusy(true);
    setError("");
    try {
      const pool = await listTicketForResale({ sellerId: sessionUserId, ticketId, price });
      setToast("공식 재판매 풀에 등록되었습니다.");
      await refresh();
      return poolCandidate(pool);
    } catch (caught) {
      const message = apiErrorText(caught);
      setError(message);
      setToast(message);
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh, sessionUserId]);

  const purchasePool = useCallback(async (poolId: string) => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const purchased = await purchaseResaleTicket({ buyerId: sessionUserId, poolId });
      const nextResult = {
        seat: purchased.ticket.seatLabel,
        amount: purchased.pool.price,
        fee: purchased.fee,
        buyerTotal: purchased.buyerTotal,
        settlement: purchased.sellerSettlement,
        seed: purchased.pool.id,
        ledger: purchased.pool.id,
        paymentLabel: purchased.payment.label,
      } satisfies ResaleMatchResult;
      setResult(nextResult);
      setToast("재판매 티켓 구매가 완료되었습니다.");
      await refresh();
      return nextResult;
    } catch (caught) {
      const message = apiErrorText(caught);
      setError(message);
      setToast(message);
      setResult(null);
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh, sessionUserId]);

  return useMemo(() => ({
    busy,
    error,
    loaded,
    openPools,
    ownedTickets,
    purchasePool,
    registerTicket,
    result,
    sessionUser,
    toast,
  }), [busy, error, loaded, openPools, ownedTickets, purchasePool, registerTicket, result, sessionUser, toast]);
}
