import Link from "next/link";
import { TicketingPageShell } from "@/components/ticketing/page-shell";

const regions = ["서울", "경기/인천", "부산", "대구", "광주", "대전"];

export default function RegionPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <p className="text-sm font-bold text-ticketground">지역별</p>
        <h1 className="mt-2 text-[34px] font-black text-ink-2">지역별 공연 찾기</h1>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {regions.map((region) => (
            <Link key={region} href={`/contents/search?q=${encodeURIComponent(region)}`} className="rounded-md border border-line p-5 text-2xl font-bold">
              {region}
            </Link>
          ))}
        </div>
      </section>
    </TicketingPageShell>
  );
}
