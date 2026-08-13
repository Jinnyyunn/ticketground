import Link from "next/link";
import { footerColumnLinks, footerLinks } from "@/data/content";
import { BrandLogo } from "@/components/brand-logo";
import { dictionary as koDictionary } from "@/i18n/dictionaries/ko";
import type { Dictionary } from "@/i18n/get-dictionary";
import { defaultLocale, type Locale } from "@/i18n/config";
import { localizeHref } from "@/i18n/routing";

type SiteFooterProps = {
  readonly dict?: Dictionary["footer"];
  readonly locale?: Locale;
  readonly showBusinessInformation?: boolean;
};

export function SiteFooter({
  dict = koDictionary.footer,
  locale = defaultLocale,
  showBusinessInformation = true,
}: SiteFooterProps) {
  return (
    <footer className="mt-[70px] border-t border-line bg-background text-ink">
      <div className="ticketground-container grid gap-8 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,3fr)]">
        <div>
          <Link href={localizeHref(locale, "/")} aria-label="Ticketground" className="inline-flex items-center">
            <BrandLogo className="h-8" />
          </Link>
          <p className="mt-4 break-keep text-sm leading-loose text-ink-3">
            {dict.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-ink-3">
            {footerLinks.map((link) => (
              <Link key={link.href} href={localizeHref(locale, link.href)} className="text-ink-3 visited:text-ink-3 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
                {dict.links[link.id]}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-4 gap-2 sm:gap-4 md:gap-8">
          {footerColumnLinks.map((column) => {
            const columnDict = dict.columns[column.id];
            return (
              <nav key={column.id} aria-label={columnDict.title} className="min-w-0">
                <h2 className="truncate text-center text-sm font-black text-ink md:text-left md:text-sm">{columnDict.title}</h2>
                <ul className="mt-3 grid gap-2 text-center text-xs leading-snug text-ink-3 sm:text-sm md:mt-4 md:gap-3 md:text-left md:text-sm">
                  {column.links.map((link) => (
                    <li key={link.href} className="min-w-0">
                      <Link href={localizeHref(locale, link.href)} className="block min-w-0 break-keep hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
                        {(columnDict as unknown as Record<string, string>)[link.id]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>
      </div>

      {showBusinessInformation ? (
        <section className="border-t border-line" aria-labelledby="footer-business-information-title">
          <div className="ticketground-container grid gap-6 py-8 text-sm text-ink-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:gap-10">
            <div>
              <h2 id="footer-business-information-title" className="font-black text-ink">
                티켓그라운드 사업자 정보
              </h2>
              <address className="mt-3 break-words not-italic leading-loose">
                <p>주소 : 경기도 고양시 주교동 독곶이길 117</p>
                <p>대표 : 윤진영</p>
                <p>사업자등록번호 : 527-44-01245</p>
              </address>
            </div>
            <div>
              <h2 className="font-black text-ink">고객센터</h2>
              <a
                className="mt-3 inline-block break-all leading-loose text-ink-3 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50"
                href="mailto:tigmaster@ticketground.co.kr"
              >
                이메일 : tigmaster@ticketground.co.kr
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <div className="border-t border-line">
        <div className="ticketground-container flex flex-col gap-3 py-5 text-sm text-ink-4 md:flex-row md:items-center">
          <p className="pr-16 md:pr-0">{dict.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
