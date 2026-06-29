import { keywordTabs, mdPick, mdPickTabs, recommendKeyword } from "@/data/content";
import { CarouselRow } from "@/components/carousel-row";
import { PillTabs } from "@/components/pill-tabs";
import { PosterCard } from "@/components/poster-card";
import { SectionHeading } from "@/components/section-heading";
import type { ProductItem } from "@/types";

function TabbedPosterSection({
  title,
  tabs,
  items,
}: {
  title: string;
  tabs: string[];
  items: ProductItem[];
}) {
  return (
    <section className="ticketground-container mt-[80px]">
      <SectionHeading>{title}</SectionHeading>
      <PillTabs tabs={tabs} className="mt-7" />
      <div className="mt-9">
        <CarouselRow>
          {items.map((item) => (
            <PosterCard key={item.title} {...item} />
          ))}
        </CarouselRow>
      </div>
    </section>
  );
}

export function MdPick() {
  return <TabbedPosterSection title="MD Pick!" tabs={mdPickTabs} items={mdPick} />;
}

export function RecommendKeyword() {
  return <TabbedPosterSection title="추천 키워드" tabs={keywordTabs} items={recommendKeyword} />;
}
