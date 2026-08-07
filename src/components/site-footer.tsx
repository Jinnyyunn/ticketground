import Link from "next/link";
import { footerColumnLinks, footerLinks } from "@/data/content";
import { dictionary as koDictionary } from "@/i18n/dictionaries/ko";
import type { Dictionary } from "@/i18n/get-dictionary";

type SiteFooterProps = {
  readonly dict?: Dictionary["footer"];
};

export function SiteFooter({ dict = koDictionary.footer }: SiteFooterProps) {
  return (
    <footer className="mt-[70px] border-t border-line bg-background text-ink">
      <div className="ticketground-container grid gap-8 py-10 md:grid-cols-[minmax(0,1.15fr)_minmax(0,3fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-1 whitespace-nowrap text-2xl font-black text-ink">
            Ticketground
            <span className="mt-1 size-2 rounded-full bg-ticketground" aria-hidden />
          </Link>
          <p className="mt-4 break-keep text-sm leading-loose text-ink-3">
            {dict.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-ink-3">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-ink-3 visited:text-ink-3 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
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
                      <Link href={link.href} className="block min-w-0 break-keep hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
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

      <div className="border-t border-line">
        <div className="ticketground-container flex flex-col gap-3 py-5 text-sm text-ink-4 md:flex-row md:items-center">
          <p>{dict.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
