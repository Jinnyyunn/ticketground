import type { TicketShow } from "@/types";
import { ShowTile } from "./show-tile";

type RankingListProps = {
  readonly shows: readonly TicketShow[];
};

export function RankingList({ shows }: RankingListProps) {
  return (
    <section className="ticketground-container py-10">
      <div className="border-b border-line pb-7">
        <p className="text-sm font-black text-ticketground">TOP LIST</p>
        <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">실시간 예매 랭킹 TOP 10</h1>
        <p className="mt-3 text-base text-ink-3">클린티켓 예매 전환과 관심공연 알림을 반영한 Ticketground 랭킹입니다.</p>
      </div>
      <ol className="mt-8 grid gap-4">
        {shows.slice(0, 10).map((show, index) => (
          <li key={show.slug} className="grid gap-4 rounded-lg border border-line bg-white p-4 md:grid-cols-[88px_1fr] md:items-center">
            <div className="flex items-baseline gap-1 text-ticketground">
              <span className="text-sm font-black">TOP</span>
              <span className="text-5xl font-black leading-none">{index + 1}</span>
            </div>
            <ShowTile show={show} compact />
          </li>
        ))}
      </ol>
    </section>
  );
}
