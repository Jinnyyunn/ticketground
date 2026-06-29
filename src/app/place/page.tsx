import Link from "next/link";
import { ShowTile } from "@/components/discovery/show-tile";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ticketShows } from "@/data/ticketing";

export default function PlacePage() {
  const currentShows = ticketShows.slice(0, 3);

  return (
    <TicketingPageShell>
      <section className="ticketground-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">공연장</p>
          <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">블루스퀘어 신한카드홀</h1>
          <p className="mt-4 max-w-[720px] text-base leading-relaxed text-ink-3">
            뮤지컬 중심의 대형 프로시니엄 공연장입니다. 좌석 등급과 교통 동선을 예매 전에 확인할 수 있습니다.
          </p>

          <section className="mt-10">
            <h2 className="text-[26px] font-black text-ink sm:text-3xl">좌석 배치도</h2>
            <div className="mt-4 grid gap-2 rounded-lg border border-line bg-white p-5">
              {["VIP 1층 중앙", "R 1층 사이드", "S 2층 전방", "A 2층 후방"].map((zone, index) => (
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
              <p>지하철 6호선 한강진역 2번 출구 도보 5분</p>
              <p>공연 당일 주차 혼잡으로 대중교통 이용을 권장합니다.</p>
              <p>입장 QR 활성화는 공연 2~3시간 전 앱에서 진행됩니다.</p>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-lg border border-line bg-white p-5 lg:sticky lg:top-[128px]">
          <h2 className="text-2xl font-black text-ink">공연장 정보</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="font-black text-ink-3">주소</dt>
              <dd className="text-right text-ink">서울 용산구 이태원로 294</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-black text-ink-3">객석</dt>
              <dd className="text-ink">1,766석</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-black text-ink-3">문의</dt>
              <dd className="text-ink">1577-0000</dd>
            </div>
          </dl>
          <Link href="/contents/search?q=레미제라블" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-ink text-sm font-black text-white">
            이 공연장 검색
          </Link>
        </aside>
      </section>
    </TicketingPageShell>
  );
}
