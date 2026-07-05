import Image from "next/image";
import { promoBanners } from "@/data/content";

export function PromoRow() {
  return (
    <section className="ticketground-container mt-6">
      <div className="grid grid-cols-3 gap-4">
        {promoBanners.map((src) => (
          <a key={src} href="#" className="relative block aspect-[413/103] overflow-hidden rounded-2xl">
            <Image src={src} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" unoptimized={src.endsWith(".gif")} />
          </a>
        ))}
      </div>
    </section>
  );
}

export function NoticeBar() {
  return (
    <section className="ticketground-container mt-4">
      <a
        href="#"
        className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-card py-[18px] text-lg"
      >
        <span className="rounded bg-ink px-1.5 py-0.5 text-xs font-medium text-on-ink">공지</span>
        <span className="font-bold text-ink-2">
          Ticketground 공식 예매 혜택이 업데이트되었습니다
        </span>
        <span className="text-ink-4">›</span>
      </a>
    </section>
  );
}
