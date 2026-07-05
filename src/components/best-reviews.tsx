import Image from "next/image";
import { reviews } from "@/data/content";
import { RefreshIcon, StarIcon } from "@/components/icons";
import { SectionHeading } from "@/components/section-heading";

export function BestReviews() {
  return (
    <section className="ticketground-container mt-[80px]">
      <SectionHeading>베스트 관람후기</SectionHeading>
      <div className="mt-9 grid grid-cols-2 gap-x-12 gap-y-10">
        {reviews.map((r) => (
          <article key={r.show} className="flex gap-5">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-sm text-ink-4">{r.show}</p>
              <h3 className="clamp-2 mt-1.5 text-[19px] font-bold leading-snug text-ink-2">{r.headline}</h3>
              <p className="clamp-3 mt-2.5 text-base leading-[1.55] text-ink-3">{r.body}</p>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <Image src={r.avatar} alt="" width={28} height={28} className="size-7 rounded-full" />
                <span className="text-sm text-ink-2">{r.user}</span>
                <span className="ml-1 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarIcon key={i} className="size-3.5 text-[#ffb400]" />
                  ))}
                </span>
                <span className="text-sm font-bold text-ink-2">{r.score}</span>
              </div>
            </div>
            <Image src={r.poster} alt="" width={112} height={150} className="h-[150px] w-[112px] shrink-0 rounded-xl object-cover" unoptimized={r.poster.endsWith(".gif")} />
          </article>
        ))}
      </div>
      <div className="mt-12 flex justify-center">
        <a
          href="#"
          className="flex h-[52px] items-center gap-2 rounded-full border border-line px-7 text-lg font-bold text-ink-2 hover:border-line-strong"
        >
          <RefreshIcon className="size-4" />
          관람후기 새로 보기
        </a>
      </div>
    </section>
  );
}
