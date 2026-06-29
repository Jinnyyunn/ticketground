import { genreTabs, ranking } from "@/data/content";
import { CarouselRow } from "@/components/carousel-row";
import { PillTabs } from "@/components/pill-tabs";
import { PosterCard } from "@/components/poster-card";
import { SectionHeading } from "@/components/section-heading";
import { MoreButton } from "@/components/more-button";

export function GenreRanking() {
  return (
    <section className="ticketground-container mt-[72px]">
      <SectionHeading>장르별 랭킹</SectionHeading>
      <PillTabs tabs={genreTabs} className="mt-7" />
      <div className="mt-9">
        <CarouselRow>
          {ranking.map((item) => (
            <PosterCard key={item.rank} {...item} width={240} />
          ))}
        </CarouselRow>
      </div>
      <MoreButton className="mt-9">뮤지컬 랭킹 전체보기</MoreButton>
    </section>
  );
}
