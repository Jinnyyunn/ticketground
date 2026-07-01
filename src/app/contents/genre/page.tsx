import Link from "next/link";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ticketShows } from "@/data/ticketing";

const genreLinks = [
  { label: "콘서트", href: "/contents/genre/concert", category: "콘서트", description: "대형 투어와 라이브 공연을 빠르게 비교합니다." },
  { label: "뮤지컬", href: "/contents/genre/musical", category: "뮤지컬", description: "대표 뮤지컬과 소극장 신작을 한 번에 살펴봅니다." },
  { label: "연극", href: "/contents/genre/theater", category: "연극", description: "대학로와 주요 극장의 연극 라인업을 모았습니다." },
  { label: "클래식", href: "/contents/genre/classic", category: "클래식", description: "리사이틀과 오케스트라 공연을 장르별로 정리합니다." },
  { label: "전시/행사", href: "/contents/genre/exhibition", category: "전시/행사", description: "전시와 행사형 티켓을 별도 목록에서 확인합니다." },
  { label: "아동/가족", href: "/contents/genre/children", category: "아동/가족", description: "가족 관람에 맞는 공연과 체험형 콘텐츠를 찾습니다." },
  { label: "스포츠", href: "/contents/genre/sports", category: "스포츠", description: "경기와 응원석 정보를 함께 비교합니다." },
] as const;

export default function GenreIndexPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <div className="border-b border-line pb-7">
          <p className="text-sm font-black text-ticketground">Category</p>
          <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">장르별 공연</h1>
          <p className="mt-3 max-w-[760px] text-base leading-relaxed text-ink-3">
            홈 추천 섹션에서 다룬 장르를 전용 목록으로 확장해 탐색합니다.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {genreLinks.map((genre) => (
            <Link
              key={genre.href}
              href={genre.href}
              className="group rounded-lg border border-line bg-white p-5 transition-colors hover:border-line-strong hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <p className="text-sm font-black text-ticketground">{ticketShows.filter((show) => show.category === genre.category).length}개 공연</p>
              <h2 className="mt-3 text-[24px] font-black text-ink group-hover:underline">{genre.label}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-3">{genre.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </TicketingPageShell>
  );
}
