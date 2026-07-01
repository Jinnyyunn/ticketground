import Link from "next/link";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { shortcuts } from "@/components/home/home-content";

export default function ShortcutsPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <div className="border-b border-line pb-7">
          <p className="text-sm font-black text-ticketground">Quick Links</p>
          <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">바로가기</h1>
          <p className="mt-3 max-w-[760px] text-base leading-relaxed text-ink-3">
            홈에서 자주 쓰는 탐색 경로를 한 화면에 모았습니다.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="rounded-lg border border-line bg-white p-5 transition-colors hover:border-line-strong hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <h2 className="text-[22px] font-black text-ink">{shortcut.label}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-3">{shortcut.helper}</p>
            </Link>
          ))}
        </div>
      </section>
    </TicketingPageShell>
  );
}
