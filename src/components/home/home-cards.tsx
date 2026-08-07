import Image from "next/image";
import Link from "next/link";
import { posterGradientClasses, type PosterGradient } from "@/components/poster-card";
import { TicketgroundTag } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import type { FeaturedShow, PosterFit, RankingShow } from "./home-content";
import { homeFeaturedImagePolicy } from "./home-featured-image-policy";

type GradientPosterProps = {
  readonly title: string;
  readonly gradient: PosterGradient;
  readonly poster?: string;
  readonly fit?: PosterFit;
  readonly className?: string;
  readonly priority?: boolean;
};

type FeaturedCardProps = {
  readonly show: FeaturedShow;
  readonly size: "large" | "mini";
  readonly ctaLabel: string;
};

export function GradientPoster({ title, gradient, poster, fit = "cover", className, priority = false }: GradientPosterProps) {
  return (
    <div
      className={cn(
        "poster relative aspect-[3/4] overflow-hidden rounded-lg",
        fit === "contain" ? "bg-card" : "bg-surface-2",
        !poster && posterGradientClasses[gradient],
        className,
      )}
    >
      {poster ? (
        <Image
          src={poster}
          alt={title}
          fill
          sizes="(min-width: 1024px) 260px, 45vw"
          className={cn(
            "size-full transition-transform duration-300",
            fit === "contain" ? "object-contain" : "object-cover group-hover:scale-[1.03]",
          )}
          loading={priority ? "eager" : undefined}
          fetchPriority={priority ? "high" : undefined}
          unoptimized={poster.endsWith(".gif")}
        />
      ) : (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim/50 to-transparent p-4 text-white">
          <strong className="clamp-2 block text-2xl font-black leading-tight">{title}</strong>
        </div>
      )}
    </div>
  );
}

export function FeaturedCard({ show, size, ctaLabel }: FeaturedCardProps) {
  return (
    <Link
      href={show.href}
      className={cn(
        "group relative isolate grid overflow-hidden rounded-xl border border-line bg-ink shadow-ticket-1 transition-transform hover:-translate-y-0.5 hover:shadow-ticket-3 focus-visible:ring-3 focus-visible:ring-ring/50",
        size === "large" ? "min-h-[420px] md:min-h-[580px]" : "min-h-[280px]",
      )}
    >
      {show.poster === homeFeaturedImagePolicy.src && size === "large" ? (
        <Image
          {...homeFeaturedImagePolicy}
          alt={homeFeaturedImagePolicy.alt}
          className="absolute inset-0 size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03] group-active:scale-[1.01]"
        />
      ) : (
        <Image
          src={show.poster}
          alt=""
          fill
          sizes={size === "large" ? "(min-width: 768px) 56vw, 100vw" : "(min-width: 768px) 34vw, 100vw"}
          className={cn(
            "absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03] group-active:scale-[1.01]",
            size === "large" ? "object-top" : "object-center",
          )}
          loading={size === "large" ? "eager" : undefined}
          fetchPriority={size === "large" ? "high" : undefined}
          unoptimized={show.poster.endsWith(".gif")}
        />
      )}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r from-scrim/90 via-scrim/55 to-scrim/10",
          size === "mini" && "via-scrim/45 to-scrim/20",
        )}
      />
      <div className={cn("relative z-10 flex min-h-full flex-col justify-between p-5", size === "large" && "md:p-8")}>
        <div className={cn(size === "large" ? "max-w-[520px]" : "max-w-[250px]")}>
          <TicketgroundTag className="bg-white/90 text-on-accent-2 shadow-ticket-1" tone={size === "large" ? "open" : "soon"}>
            {show.eyebrow}
          </TicketgroundTag>
          <h1 className={cn("mt-4 font-black leading-tight text-white", size === "large" ? "text-[clamp(37px,5vw,50px)]" : "text-[24px]")}>
            {show.title}
          </h1>
          <p className="mt-4 text-base font-bold text-white/90">{show.venue}</p>
          <p className="mt-1 text-sm text-white/75">{show.date}</p>
        </div>
        <span className="mt-6 inline-flex h-10 min-w-[112px] w-fit items-center justify-center whitespace-nowrap rounded-lg bg-card px-4 text-base font-black text-ink transition-colors group-hover:bg-ticketground group-hover:text-white">
          {ctaLabel} →
        </span>
      </div>
    </Link>
  );
}

type SectionHeadProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly moreHref: string;
  readonly moreLabel: string;
  readonly badge?: string;
};

export function SectionHead({ title, subtitle, moreHref, moreLabel, badge }: SectionHeadProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-4xl font-black leading-tight text-ink">{title}</h2>
          {badge && (
            <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-accent-2 px-2.5 text-[11px] font-black tracking-tight text-on-accent-2">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p data-section-subtitle className="mt-2 break-keep text-sm leading-snug text-ink-3 sm:text-base">{subtitle}</p>}
      </div>
      <Link href={moreHref} className="shrink-0 text-sm font-black text-ink hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50">
        {moreLabel}
      </Link>
    </div>
  );
}

export function Movement({ movement, delta }: { readonly movement: RankingShow["movement"]; readonly delta: string }) {
  if (movement === "same") return <span className="text-ink-4">—</span>;
  return <span className={movement === "up" ? "text-ticketground" : "text-link"}>{movement === "up" ? "▲" : "▼"} {delta}</span>;
}
