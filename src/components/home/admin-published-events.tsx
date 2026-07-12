"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getState, type ApiEvent } from "@/lib/ticketground-api";

function priceLabel(event: ApiEvent): string {
  const lowest = Math.min(...event.zones.map((zone) => zone.faceValue));
  return `${new Intl.NumberFormat("ko-KR").format(lowest)}원부터`;
}

export function AdminPublishedEventsSection() {
  const [events, setEvents] = useState<readonly ApiEvent[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getState().then((state) => {
      if (mounted) setEvents(state.events.filter((event) => event.slug.startsWith("admin-")).slice(-4).reverse());
    }).catch(() => { if (mounted) setLoadFailed(true); });
    return () => { mounted = false; };
  }, []);

  if (!events.length && !loadFailed) return null;

  return <section className="ticketground-container mt-16" data-section="admin-published-events"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-black text-ticketground">NEW</p><h2 className="mt-1 text-2xl font-black text-ink sm:text-3xl">새로 등록된 공연</h2></div><Link className="text-sm font-black text-ticketground" href="/contents/ranking">더보기</Link></div>{loadFailed ? <p className="mt-5 text-sm font-bold text-warn" role="status">새로 등록된 공연을 불러오지 못했습니다.</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{events.map((event) => <Link className="group min-w-0 overflow-hidden rounded-lg border border-line bg-card transition-colors hover:border-line-strong focus-visible:ring-3 focus-visible:ring-ring/50" href={`/goods/${event.slug}`} key={event.id}><div className="relative aspect-[3/4] overflow-hidden bg-surface"><Image alt={`${event.title} 포스터`} className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" src={event.image} /></div><div className="min-w-0 p-4"><p className="text-xs font-black text-ticketground">{event.sale.label}</p><h3 className="mt-1 clamp-2 text-base font-black leading-snug text-ink">{event.title}</h3><p className="mt-2 clamp-1 text-sm font-bold text-ink-3">{event.venue}</p><p className="mt-1 text-sm text-ink-3">{event.date.slice(0, 10)}</p><p className="mt-3 text-sm font-black text-ink">{priceLabel(event)}</p></div></Link>)}</div>}</section>;
}
