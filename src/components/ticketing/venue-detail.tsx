import Link from "next/link";
import { ShowTile } from "@/components/discovery/show-tile";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import type { TicketVenue } from "@/data/venues";
import type { TicketShow } from "@/types";

type VenueDetailProps = {
  readonly venue: TicketVenue;
  readonly currentShows: readonly TicketShow[];
};

export function VenueDetail({ venue, currentShows }: VenueDetailProps) {
  return (
    <TicketingPageShell>
      <section className="ticketground-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">공연장</p>
          <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">{venue.displayName}</h1>
          <p className="mt-4 max-w-[720px] text-base leading-relaxed text-ink-3">{venue.description}</p>

          <section className="mt-10">
            <h2 className="text-[26px] font-black text-ink sm:text-3xl">좌석 배치도</h2>
            <div className="mt-4 grid gap-2 rounded-lg border border-line bg-white p-5">
              {venue.zones.map((zone, index) => (
                <div key={zone} className="grid grid-cols-[120px_1fr] items-center gap-3">
                  <span className="text-sm font-black text-ink-3">{zone}</span>
                  <div className={index === 0 ? "h-8 rounded bg-tier-vip" : index === 1 ? "h-8 rounded bg-tier-r" : index === 2 ? "h-8 rounded bg-tier-s" : "h-8 rounded bg-tier-a"} />
                </div>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-[26px] font-black text-ink sm:text-3xl">현재 공연중</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {currentShows.map((show) => (
                <ShowTile key={show.slug} show={show} compact />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-[26px] font-black text-ink sm:text-3xl">교통 안내</h2>
            <div className="mt-4 grid gap-3 rounded-lg bg-surface p-5 text-base text-ink-3">
              {venue.transport.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-line bg-white p-5 lg:sticky lg:top-[128px]">
          <h2 className="text-2xl font-black text-ink">공연장 정보</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="font-black text-ink-3">주소</dt>
              <dd className="text-right text-ink">{venue.address}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-black text-ink-3">객석</dt>
              <dd className="text-ink">{venue.seats}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-black text-ink-3">문의</dt>
              <dd className="text-ink">{venue.inquiry}</dd>
            </div>
          </dl>
          <Link href={`/contents/search?q=${encodeURIComponent(venue.searchQuery)}`} className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-ink text-sm font-black text-white">
            이 공연장 검색
          </Link>
        </aside>
      </section>
    </TicketingPageShell>
  );
}
