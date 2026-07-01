import Link from "next/link";
import { footerColumnLinks, footerLinks } from "@/data/content";

export function SiteFooter() {
  return (
    <footer className="mt-[70px] border-t border-line bg-white text-ink">
      <div className="ticketground-container grid gap-8 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,3fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 whitespace-nowrap text-[22px] font-black text-ink">
            Ticketground
            <span className="mt-1 size-2 rounded-full bg-ticketground" aria-hidden />
          </Link>
          <p className="mt-4 text-sm leading-loose text-ink-3">
            공식 예매, 클린티켓, 고객 문의를 한 곳에서 다루는 공연 티켓 서비스입니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-bold text-ink-3">
            {footerLinks.map((link) => (
              <Link key={link.label} href={link.href} className={link.label === "개인정보처리방침" ? "text-ink" : "hover:text-ticketground"}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-4 md:gap-8">
          {footerColumnLinks.map((column) => (
            <nav key={column.title} aria-label={column.title} className="min-w-0">
              <h2 className="truncate text-center text-[13px] font-black text-ink md:text-left md:text-sm">{column.title}</h2>
              <ul className="mt-3 grid gap-2 text-center text-[12px] leading-snug text-ink-3 sm:text-[13px] md:mt-4 md:gap-3 md:text-left md:text-sm">
                {column.links.map((link) => (
                  <li key={link.label} className="min-w-0">
                    <Link href={link.href} className="block min-w-0 break-keep hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="ticketground-container flex flex-col gap-3 py-5 text-[13px] text-ink-4 md:flex-row md:items-center">
          <p>© Ticketground Inc. 통신판매중개자로서 공연 예매와 공식 문의 연결을 제공합니다.</p>
        </div>
      </div>
    </footer>
  );
}
