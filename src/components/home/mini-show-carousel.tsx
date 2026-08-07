"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { FeaturedCard } from "./home-cards";
import type { FeaturedShow } from "./home-content";

const SLIDE_GAP = 20;
const AUTOPLAY_INTERVAL_MS = 4000;

type MiniShowCarouselProps = {
  readonly shows: readonly FeaturedShow[];
  readonly ariaSlides: string;
  readonly ariaPrev: string;
  readonly ariaNext: string;
  readonly primaryCtaLabel: string;
  readonly secondaryCtaLabel: string;
};

export function MiniShowCarousel({ shows, ariaSlides, ariaPrev, ariaNext, primaryCtaLabel, secondaryCtaLabel }: MiniShowCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToSlide = (index: number) => {
    const track = trackRef.current;
    if (!track || shows.length <= 1) return;

    const nextIndex = (index + shows.length) % shows.length;
    const slideWidth = track.clientWidth + SLIDE_GAP;
    setActiveIndex(nextIndex);
    track.scrollTo({ left: nextIndex * slideWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track || shows.length <= 1) return;

    const timer = window.setInterval(() => {
      const slideWidth = track.clientWidth + SLIDE_GAP;
      const currentIndex = Math.round(track.scrollLeft / slideWidth);
      const nextIndex = (currentIndex + 1) % shows.length;
      track.scrollTo({ left: nextIndex * slideWidth, behavior: "smooth" });
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [shows.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      const slideWidth = track.clientWidth + SLIDE_GAP;
      const nextIndex = Math.min(shows.length - 1, Math.max(0, Math.round(track.scrollLeft / slideWidth)));
      setActiveIndex(nextIndex);
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [shows.length]);

  return (
    <div className="relative min-w-0">
      <div
        ref={trackRef}
        className="no-scrollbar flex min-w-0 snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth"
        aria-label={ariaSlides}
      >
        {shows.map((show, index) => (
          <div key={show.title} className="w-full shrink-0 snap-start">
            <FeaturedCard show={show} size="large" ctaLabel={index === 0 ? primaryCtaLabel : secondaryCtaLabel} />
          </div>
        ))}
      </div>
      {shows.length > 1 && (
        <>
          <button
            type="button"
            aria-label={ariaPrev}
            data-hero-carousel-prev
            className="absolute left-0 top-[64%] z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-ink/70 text-white shadow-ticket-2 backdrop-blur-sm transition-colors hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:left-3 sm:top-1/2 sm:size-11 md:left-5"
            onClick={() => scrollToSlide(activeIndex - 1)}
          >
            <ChevronLeftIcon className="pointer-events-none size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={ariaNext}
            data-hero-carousel-next
            className="absolute right-3 top-[64%] z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/35 bg-ink/70 text-white shadow-ticket-2 backdrop-blur-sm transition-colors hover:bg-card hover:text-ink focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:top-1/2 sm:size-11 md:right-5"
            onClick={() => scrollToSlide(activeIndex + 1)}
          >
            <ChevronRightIcon className="pointer-events-none size-5" aria-hidden />
          </button>
          <span
            className="pointer-events-none absolute right-4 top-4 z-10 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-black text-white backdrop-blur-sm"
            data-hero-carousel-count
            aria-live="polite"
          >
            {activeIndex + 1} / {shows.length}
          </span>
        </>
      )}
    </div>
  );
}
