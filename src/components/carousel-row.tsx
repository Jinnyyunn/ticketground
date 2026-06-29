"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

export function CarouselRow({
  children,
  className,
  step = 880,
}: {
  children: React.ReactNode;
  className?: string;
  step?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="group/carousel relative">
      <div ref={ref} className={cn("no-scrollbar flex gap-[18px] overflow-x-auto scroll-smooth", className)}>
        {children}
      </div>
      <button
        aria-label="이전"
        onClick={() => scroll(-1)}
        className="absolute -left-5 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#eee] bg-white text-[#333] shadow-[0_4px_16px_rgba(0,0,0,0.12)] group-hover/carousel:flex"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <button
        aria-label="다음"
        onClick={() => scroll(1)}
        className="absolute -right-5 top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#eee] bg-white text-[#333] shadow-[0_4px_16px_rgba(0,0,0,0.12)] group-hover/carousel:flex"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  );
}
