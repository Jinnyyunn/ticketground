import Link from "next/link";
import { notFound } from "next/navigation";
import { ShowTile } from "@/components/discovery/show-tile";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ticketShows } from "@/data/ticketing";

export function generateStaticParams() {
  return ticketShows.flatMap((show) => (show.artistSlug ? [{ slug: show.artistSlug }] : []));
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const show = ticketShows.find((item) => item.artistSlug === slug);
  if (!show) notFound();

  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <div className="grid gap-8 rounded-xl bg-surface p-8 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="flex size-40 items-center justify-center rounded-full bg-ink text-6xl font-black text-white">{show.shortTitle.slice(0, 1)}</div>
          <div>
            <p className="text-sm font-black text-ticketground">아티스트 프로필</p>
            <h1 className="mt-2 text-5xl font-black text-ink">{show.shortTitle} 캐스팅</h1>
            <p className="mt-4 max-w-[720px] text-base leading-relaxed text-ink-3">
              {show.title} 대표 캐스트와 관련 공연 이력을 한 화면에서 확인하는 아티스트 발견 페이지입니다.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["예매중 공연", "1개"],
            ["누적 관객", "48만"],
            ["평균 평점", "9.6"],
          ].map(([label, value]) => (
            <article key={label} className="rounded-lg border border-line bg-white p-5">
              <p className="text-sm font-black text-ink-3">{label}</p>
              <strong className="mt-2 block text-4xl font-black text-ink">{value}</strong>
            </article>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-3xl font-black text-ink">예매중 공연</h2>
          <div className="mt-4 max-w-[720px]">
            <ShowTile show={show} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-3xl font-black text-ink">주요 캐스트</h2>
          <ol className="mt-4 grid gap-3 border-l border-line pl-5">
            {show.casts.map((cast) => (
              <li key={cast} className="relative rounded-lg bg-white p-4 shadow-ticket-1 before:absolute before:-left-[25px] before:top-5 before:size-3 before:rounded-full before:bg-ticketground">
                <p className="text-base font-black text-ink">{cast}</p>
                <p className="mt-1 text-sm text-ink-3">{show.shortTitle} 주요 캐스트로 등록되어 있습니다.</p>
              </li>
            ))}
          </ol>
        </section>

        <Link href={`/goods/${show.slug}`} className="mt-8 inline-flex h-12 items-center rounded-lg bg-ticketground px-6 text-base font-black text-white">
          공연 상세로 돌아가기
        </Link>
      </section>
    </TicketingPageShell>
  );
}
