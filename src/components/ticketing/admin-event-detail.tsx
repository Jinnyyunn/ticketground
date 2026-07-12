"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getState, type ApiState } from "@/lib/ticketground-api";
import { TicketingPageShell } from "./page-shell";

function EventDetailContent({ state, slug }: { readonly state: ApiState; readonly slug: string }) {
  const event = state.events.find((item) => item.slug === slug);
  if (!event) return <main className="ticketground-container py-16"><h1 className="text-2xl font-black text-ink">공연 정보를 찾을 수 없습니다.</h1><Link className="mt-5 inline-flex text-sm font-black text-ticketground" href="/">홈으로 돌아가기</Link></main>;
  const available = state.tickets.filter((ticket) => ticket.eventId === event.id && ticket.available).length;
  return <main className="ticketground-container py-10"><div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]"><article className="relative aspect-[3/4] overflow-hidden rounded-lg border border-line bg-card"><Image alt={`${event.title} 포스터`} className="object-cover" fill sizes="(min-width: 1024px) 320px, 100vw" src={event.image} /></article><section className="min-w-0"><p className="text-sm font-black text-ticketground">{event.sale.label}</p><h1 className="mt-3 text-3xl font-black leading-tight text-ink sm:text-4xl">{event.title}</h1><dl className="mt-7 divide-y divide-line overflow-hidden rounded-lg border border-line bg-card"><div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-4 py-4 text-sm"><dt className="font-bold text-ink-3">공연장</dt><dd className="font-black text-ink">{event.venue}</dd></div><div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-4 py-4 text-sm"><dt className="font-bold text-ink-3">공연 일시</dt><dd className="font-black text-ink">{event.date}</dd></div><div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-4 py-4 text-sm"><dt className="font-bold text-ink-3">판매 가능</dt><dd className="font-black text-ink">{available.toLocaleString("ko-KR")}석</dd></div></dl><section className="mt-6 rounded-lg border border-line bg-surface p-5"><h2 className="text-lg font-black text-ink">좌석 가격</h2><div className="mt-4 grid gap-2 sm:grid-cols-3">{event.zones.map((zone) => <div className="rounded-md bg-card px-4 py-3" key={zone.id}><p className="text-sm font-bold text-ink-3">{zone.name}</p><p className="mt-1 text-base font-black text-ink">{zone.faceValue.toLocaleString("ko-KR")}원</p></div>)}</div></section></section></div></main>;
}

export function AdminEventDetail({ slug }: { readonly slug: string }) {
  const [state, setState] = useState<ApiState | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void getState().then(setState).catch(() => setFailed(true)); }, []);
  return <TicketingPageShell>{state ? <EventDetailContent slug={slug} state={state} /> : <main className="ticketground-container py-16"><p className="text-sm font-bold text-ink-3">{failed ? "공연 정보를 불러오지 못했습니다." : "공연 정보를 불러오는 중입니다."}</p></main>}</TicketingPageShell>;
}
