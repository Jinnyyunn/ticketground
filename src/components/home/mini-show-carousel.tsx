"use client";

import { useEffect, useRef, useState } from "react";
import { FeaturedCard } from "./home-cards";
import type { FeaturedShow } from "./home-content";

const SLIDE_GAP = 20;
const AUTOPLAY_INTERVAL_MS = 4000;

export function MiniShowCarousel({ shows }: { readonly shows: readonly FeaturedShow[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
      setActiveIndex(Math.round(track.scrollLeft / slideWidth));
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative min-w-0">
      <div
        ref={trackRef}
        className="no-scrollbar flex min-w-0 snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth"
        aria-label="추천 공연 슬라이드"
      >
        {shows.map((show) => (
          <div key={show.title} className="w-full shrink-0 snap-start">
            <FeaturedCard show={show} size="large" />
          </div>
        ))}
      </div>
      {shows.length > 1 && (
        <span
          className="pointer-events-none absolute right-4 top-4 z-10 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-black text-white backdrop-blur-sm"
          aria-live="polite"
        >
          {activeIndex + 1} / {shows.length}
        </span>
      )}
    </div>
  );
}
