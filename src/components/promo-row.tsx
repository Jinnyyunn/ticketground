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
        className="flex items-center justify-center gap-3 rounded-2xl border border-[#eee] bg-white py-[18px] text-[16px]"
      >
        <span className="rounded bg-[#6b6b6b] px-1.5 py-0.5 text-[12px] font-medium text-white">공지</span>
        <span className="font-bold text-[#29292d]">
          Ticketground 공식 예매 혜택이 업데이트되었습니다
        </span>
        <span className="text-[#bdbdbd]">›</span>
      </a>
    </section>
  );
}
