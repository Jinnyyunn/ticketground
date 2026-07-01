import Link from "next/link";
import { posterGradientClasses, type PosterGradient } from "@/components/poster-card";
import { TicketgroundTag } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import type { FeaturedShow, PosterFit, RankingShow } from "./home-content";

type GradientPosterProps = {
  readonly title: string;
  readonly gradient: PosterGradient;
  readonly poster?: string;
  readonly fit?: PosterFit;
  readonly className?: string;
};

type FeaturedCardProps = {
  readonly show: FeaturedShow;
  readonly size: "large" | "mini";
};

export function GradientPoster({ title, gradient, poster, fit = "cover", className }: GradientPosterProps) {
  return (
    <div
      className={cn(
        "poster relative aspect-[3/4] overflow-hidden rounded-lg",
        fit === "contain" ? "bg-white" : "bg-surface-2",
        !poster && posterGradientClasses[gradient],
        className,
      )}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={title}
          className={cn(
            "size-full transition-transform duration-300",
            fit === "contain" ? "object-contain" : "object-cover group-hover:scale-[1.03]",
          )}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/50 to-transparent p-4">
          <strong className="clamp-2 block text-[22px] font-black leading-tight">{title}</strong>
        </div>
      )}
    </div>
  );
}

export function FeaturedCard({ show, size }: FeaturedCardProps) {
  return (
    <Link
      href={show.href}
      className={cn(
        "group relative isolate grid overflow-hidden rounded-xl border border-line bg-ink text-white shadow-ticket-1 transition-transform hover:-translate-y-0.5 hover:shadow-ticket-3 focus-visible:ring-3 focus-visible:ring-ring/50",
        size === "large" ? "min-h-[420px] md:min-h-[580px]" : "min-h-[280px]",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={show.poster}
        alt=""
        className={cn(
          "absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] group-active:scale-[1.01]",
          size === "large" ? "object-top" : "object-center",
        )}
        loading={size === "large" ? "eager" : "lazy"}
        decoding="async"
      />
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/55 to-ink/10",
          size === "mini" && "via-ink/45 to-ink/20",
        )}
      />
      <div className={cn("relative z-10 flex min-h-full flex-col justify-between p-5", size === "large" && "md:p-8")}>
        <div className={cn(size === "large" ? "max-w-[520px]" : "max-w-[250px]")}>
          <TicketgroundTag className="bg-white/90 text-ink shadow-ticket-1" tone={size === "large" ? "open" : "soon"}>
            {show.eyebrow}
          </TicketgroundTag>
          <h1 className={cn("mt-4 font-black leading-tight text-white", size === "large" ? "text-[clamp(37px,5vw,50px)]" : "text-[24px]")}>
            {show.title}
          </h1>
          <p className="mt-4 text-[15px] font-bold text-white/90">{show.venue}</p>
          <p className="mt-1 text-[13px] text-white/75">{show.date}</p>
        </div>
        <span className="mt-6 inline-flex h-10 min-w-[112px] w-fit items-center justify-center whitespace-nowrap rounded-lg bg-white px-4 text-[15px] font-black text-ink transition-colors group-hover:bg-ticketground group-hover:text-white">
          {show.cta} →
        </span>
      </div>
    </Link>
  );
}

type SectionHeadProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly moreHref?: string;
};

export function SectionHead({ title, subtitle, moreHref = "/contents/search" }: SectionHeadProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[28px] font-black leading-tight text-ink">{title}</h2>
        {subtitle && <p data-section-subtitle className="mt-2 text-[14px] leading-snug text-ink-3 sm:text-[15px]">{subtitle}</p>}
      </div>
      <Link href={moreHref} className="shrink-0 text-[13px] font-black text-link hover:text-ticketground">
        더보기
      </Link>
    </div>
  );
}

export function Movement({ movement, delta }: { readonly movement: RankingShow["movement"]; readonly delta: string }) {
  if (movement === "same") return <span className="text-ink-4">—</span>;
  return <span className={movement === "up" ? "text-ticketground" : "text-link"}>{movement === "up" ? "▲" : "▼"} {delta}</span>;
}
