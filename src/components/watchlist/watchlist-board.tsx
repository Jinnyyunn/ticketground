"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMyWatchlist, getState, removeFromMyWatchlist, storedSessionCredential } from "@/lib/ticketground-api";

type WatchlistEntry = {
  readonly watchlistId: string;
  readonly eventId: string;
  readonly title: string;
  readonly venue: string;
  readonly slug: string;
  readonly poster: string;
  readonly saleLabel: string;
};

export function WatchlistBoard() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<readonly WatchlistEntry[]>([]);
  const [status, setStatus] = useState("관심공연을 불러오는 중입니다");
  const [loaded, setLoaded] = useState(false);

  async function refresh(): Promise<void> {
    setStatus("관심공연을 불러오는 중입니다");
    try {
      const [items, state] = await Promise.all([getMyWatchlist(), getState()]);
      const eventsById = new Map(state.events.map((event) => [event.id, event]));
      const resolved = items.flatMap((item) => {
        const event = eventsById.get(item.eventId);
        if (!event) return [];
        return [{
          watchlistId: item.id,
          eventId: item.eventId,
          title: event.title,
          venue: event.venue,
          slug: event.slug,
          poster: event.image,
          saleLabel: event.sale.label,
        }];
      });
      setEntries(resolved);
      setStatus(resolved.length ? `${resolved.length}건의 관심공연` : "저장된 관심공연이 아직 없습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "관심공연을 불러오지 못했습니다.");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    const credential = storedSessionCredential();
    setLoggedIn(Boolean(credential));
    if (!credential) {
      setLoaded(true);
      return;
    }
    void refresh();
  }, []);

  const remove = async (eventId: string): Promise<void> => {
    try {
      await removeFromMyWatchlist(eventId);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "관심공연 삭제에 실패했습니다.");
    }
  };

  if (loggedIn === false) {
    return (
      <section className="ticketground-container py-16 text-center">
        <p className="text-sm font-black text-ticketground">관심공연·알림</p>
        <h1 className="mt-2 text-[28px] font-black text-ink">로그인이 필요합니다</h1>
        <p className="mt-3 text-sm text-ink-3">관심공연 등록·조회는 로그인 후 이용할 수 있습니다.</p>
        <Link className="mt-6 inline-flex h-11 items-center rounded-lg bg-ink px-6 text-sm font-black text-on-ink" href="/login">
          로그인하러 가기
        </Link>
      </section>
    );
  }

  return (
    <section className="ticketground-container py-10">
      <div className="border-b border-line pb-7">
        <p className="text-sm font-black text-ticketground">관심공연·알림</p>
        <h1 className="mt-2 text-[34px] font-black text-ink">관심공연</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-3">공연 상세 페이지의 &ldquo;찜하기&rdquo;로 등록한 공연을 모아봅니다.</p>
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm font-bold text-ink-3" aria-live="polite">
          {status}
        </p>
      </div>

      <div className="mt-8 grid gap-4" aria-label="관심공연 목록">
        {entries.map((entry) => (
          <article key={entry.watchlistId} className="rounded-lg border border-line bg-card p-5 shadow-ticket-1">
            <div className="grid gap-4 sm:grid-cols-[112px_1fr] md:grid-cols-[128px_1fr]">
              <Link
                href={`/goods/${entry.slug}`}
                aria-label={`${entry.title} 상세보기`}
                className="relative block aspect-[3/4] overflow-hidden rounded-lg bg-surface-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <Image src={entry.poster} alt={`${entry.title} 포스터`} fill unoptimized sizes="128px" className="object-cover" />
              </Link>
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <span className="rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-2">{entry.saleLabel}</span>
                  <h2 className="mt-3 text-xl font-black text-ink">{entry.title}</h2>
                  <p className="mt-1 text-sm text-ink-3">{entry.venue}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Link href={`/goods/${entry.slug}`} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-black text-ink hover:border-line-strong">
                    상세보기
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(entry.eventId)}
                    className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-black text-ink hover:border-ticketground hover:text-ticketground"
                  >
                    찜 해제
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {loaded && loggedIn && entries.length === 0 ? (
          <p className="rounded-lg border border-line p-6 text-center text-sm font-bold text-ink-3">
            아직 등록한 관심공연이 없습니다. 공연 상세 페이지에서 찜하기를 눌러보세요.
          </p>
        ) : null}
      </div>
    </section>
  );
}
