import Link from "next/link";
import type { TicketShow } from "@/types";
import { ShowTile } from "./show-tile";

type SearchPanelsProps = {
  readonly query: string;
  readonly results: readonly TicketShow[];
  readonly fallbackShows: readonly TicketShow[];
};

const tabs = ["전체", "공연", "아티스트", "장소", "기획전"] as const;
const relatedTerms = ["레미제라블 좌석", "블루스퀘어 신한카드홀", "레미제라블 캐스팅", "뮤지컬 클린티켓"] as const;

function titleWithHighlight(show: TicketShow, query: string) {
  if (!query.includes("레미제라블") || !show.title.includes("레미제라블")) {
    return show.title;
  }
  return (
    <>
      <mark className="highlight rounded bg-accent-2 px-1 text-ink">레미제라블</mark>
      {show.title.replace("레미제라블", "")}
    </>
  );
}

export function SearchPanels({ query, results, fallbackShows }: SearchPanelsProps) {
  const emptyQuery = query.trim().length === 0;
  const visibleResults = emptyQuery ? [] : results;
  const lesMiserablesMode = query.includes("레미제라블");

  return (
    <section className="ticketground-container grid min-w-0 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <form action="/contents/search" className="flex min-w-0 rounded-full border border-line bg-white p-1">
          <input name="q" defaultValue={query} placeholder="공연명, 장소, 장르를 검색하세요" className="h-11 min-w-0 flex-1 rounded-full px-4 text-base outline-none" />
          <button className="h-11 shrink-0 whitespace-nowrap rounded-full bg-ink px-5 text-base font-black text-white sm:px-6">검색</button>
        </form>

        <div className="mt-8 border-b border-line pb-4">
          <h1 className="balanced-title text-[30px] font-black text-ink sm:text-4xl">
            {emptyQuery ? (
              "검색어를 입력하세요"
            ) : lesMiserablesMode ? (
              <>
                <mark className="highlight rounded bg-accent-2 px-1 text-ink">레미제라블</mark> 검색 결과
              </>
            ) : (
              <>{query} 검색 결과</>
            )}
          </h1>
          {lesMiserablesMode && (
            <div className="mt-4">
              <h2 className="text-sm font-black text-ink-3">연관 검색어</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {relatedTerms.map((term) => (
                  <Link key={term} href={`/contents/search?q=${encodeURIComponent(term)}`} className="rounded-full border border-line px-3 py-1.5 text-sm font-black text-ink">
                    {term}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div role="tablist" aria-label="검색 분류" className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              role="tab"
              aria-selected={index === 0}
              className={index === 0 ? "h-9 rounded-full bg-ink px-4 text-sm font-black text-white" : "h-9 rounded-full border border-line px-4 text-sm font-black text-ink"}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-4">
          {visibleResults.length === 0 ? (
            <div className="min-w-0 rounded-lg bg-surface p-6 text-center sm:p-10">
              <h2 className="balanced-title min-w-0 break-words text-[22px] font-black leading-tight text-ink [overflow-wrap:anywhere] sm:text-2xl">&quot;{query}&quot;에 대한 판매중/예정 공연이 없습니다.</h2>
              <p className="mt-3 text-base text-ink-3">판매종료된 공연 또는 인기 공연 정보를 확인해 보세요.</p>
            </div>
          ) : (
            visibleResults.map((show) => (
              <article key={show.slug} className="min-w-0 rounded-lg border border-line bg-white p-4">
                <h2 className="balanced-title min-w-0 break-words text-2xl font-black text-ink [overflow-wrap:anywhere]">{titleWithHighlight(show, query)}</h2>
                <div className="mt-4">
                  <ShowTile show={show} compact />
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <aside className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-2xl font-black text-ink">하이라이트</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">레미제라블 40주년은 블루스퀘어, VIP 190,000원, 클린티켓 대표 공연입니다.</p>
        <div className="mt-5 grid gap-3">
          {fallbackShows.slice(0, 3).map((show) => (
            <ShowTile key={show.slug} show={show} compact />
          ))}
        </div>
      </aside>
    </section>
  );
}
