"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function FloatingSide() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 480);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="맨 위로 이동"
          className="grid size-12 place-items-center rounded-full border border-line bg-ink text-on-ink shadow-ticket-2 transition-colors hover:bg-ink-2 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
        >
          <ArrowUp className="size-5 shrink-0" aria-hidden />
        </button>
      )}
      <Link
        href="https://pf.kakao.com/_xmTniX/chat"
        aria-label="1:1 문의"
        target="_blank"
        rel="noreferrer"
        className="hidden items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm font-black text-ink shadow-ticket-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 lg:flex"
      >
        <Image alt="" className="size-6 rounded-md object-cover" height={24} src="/images/kakao-channel-logo.jpg" width={24} />
        1:1 문의
      </Link>
    </div>
  );
}
