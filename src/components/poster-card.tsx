import { cn } from "@/lib/utils";

export type PosterGradient = `g${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}` | "g10" | "g11" | "g12";

interface PosterCardProps {
  readonly poster?: string;
  readonly title: string;
  readonly venue?: string;
  readonly date?: string;
  readonly rank?: number;
  readonly badge?: string;
  readonly width?: 206 | 240;
  readonly href?: string;
  readonly gradient?: PosterGradient;
  readonly className?: string;
}

const badgeStyle: Record<string, string> = {
  단독판매: "bg-tint-blue text-ticketground",
  좌석우위: "bg-surface-2 text-ink-3",
};

export const posterGradientClasses: Record<PosterGradient, string> = {
  g1: "g1 bg-[linear-gradient(135deg,#ff2d3f,#ff6a3d_50%,#ffce4a)] text-white",
  g2: "g2 bg-[linear-gradient(160deg,#0a0a1a,#1a47ff_70%,#6ec3ff)] text-white",
  g3: "g3 bg-[linear-gradient(135deg,#2b0a4a,#ff2d8e)] text-white",
  g4: "g4 bg-[linear-gradient(135deg,#0d3b2e,#1f8a5b_60%,#f0e6c2)] text-[#0d2418]",
  g5: "g5 bg-[linear-gradient(135deg,#1a1a1d,#29292d_60%,#ffe92e)] text-[#1a1a1d]",
  g6: "g6 bg-[linear-gradient(135deg,#6a1b9a,#d81b60)] text-white",
  g7: "g7 bg-[linear-gradient(160deg,#ff6a3d,#ffce4a)] text-[#2b1100]",
  g8: "g8 bg-[linear-gradient(135deg,#0a1a3f,#4a2a7a)] text-white",
  g9: "g9 bg-[linear-gradient(135deg,#f3f3f3,#d6d6d8_60%,#999)] text-[#1a1a1d]",
  g10: "g10 bg-[linear-gradient(135deg,#5c1212,#1a1a1d)] text-white",
  g11: "g11 bg-[linear-gradient(135deg,#ffe6d6,#ffb88a)] text-[#4a1a00]",
  g12: "g12 bg-[linear-gradient(160deg,#1f8a5b,#0d3b2e)] text-white",
};

const posterWidthClasses: Record<NonNullable<PosterCardProps["width"]>, string> = {
  206: "w-[206px]",
  240: "w-[240px]",
};

export function PosterCard({
  poster,
  title,
  venue,
  date,
  rank,
  badge,
  width = 206,
  href = "/goods/dracula",
  gradient = "g2",
  className,
}: PosterCardProps) {
  return (
    <a
      href={href}
      className={cn(
        "group block shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        posterWidthClasses[width],
        className,
      )}
    >
      <div className={cn("poster relative aspect-[3/4] overflow-hidden rounded-[10px] bg-surface-2", !poster && posterGradientClasses[gradient])}>
        {poster ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poster}
              alt={title}
              className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-[1.01]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/60 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
          </>
        ) : (
          <div className="poster-type flex h-full flex-col justify-end gap-1 p-4">
            <strong className="ptitle clamp-2 text-[22px] font-black leading-tight">{title}</strong>
            {venue && <span className="psub text-sm font-bold opacity-85">{venue}</span>}
            {date && <span className="pmeta text-sm font-medium opacity-75">{date}</span>}
          </div>
        )}
        {rank !== undefined && (
          <span className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-md bg-ink/75 px-1.5 text-[15px] font-bold text-white">
            {rank}
          </span>
        )}
      </div>
      <div className="mt-2.5">
        <h3 className="clamp-2 text-[15px] font-bold leading-[1.35] text-ink-2 group-hover:underline">{title}</h3>
        {venue && <p className="clamp-1 mt-1 text-sm text-ink-3">{venue}</p>}
        {date && <p className="mt-0.5 text-sm text-ink-4">{date}</p>}
        {badge && (
          <span className={cn("mt-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium", badgeStyle[badge] ?? "bg-surface-2 text-ink-3")}>
            {badge}
          </span>
        )}
      </div>
    </a>
  );
}
