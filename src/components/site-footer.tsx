import Link from "next/link";
import { footerColumnLinks, footerLinks } from "@/data/content";

export function SiteFooter() {
  return (
    <footer className="mt-[70px] border-t border-line bg-white text-ink">
      <div className="ticketground-container grid gap-8 py-10 md:grid-cols-4">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 text-[22px] font-black text-ink">
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
        {footerColumnLinks.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-black text-ink">{column.title}</h2>
            <ul className="mt-4 grid gap-3 text-sm text-ink-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="ticketground-container flex flex-col gap-3 py-5 text-[13px] text-ink-4 md:flex-row md:items-center">
          <p>© Ticketground Inc. 통신판매중개자로서 공연 예매와 공식 문의 연결을 제공합니다.</p>
          <Link href="/admin" className="md:ml-auto hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50">
            운영 콘솔
          </Link>
        </div>
      </div>
    </footer>
  );
}
