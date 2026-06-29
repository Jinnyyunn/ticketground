import Link from "next/link";
import { TicketingPageShell } from "@/components/ticketing/page-shell";

const regions = ["서울", "경기/인천", "부산", "대구", "광주", "대전"];

export default function RegionPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <p className="text-[14px] font-bold text-ticketground">지역별</p>
        <h1 className="mt-2 text-[34px] font-bold text-[#29292d]">지역별 공연 찾기</h1>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {regions.map((region) => (
            <Link key={region} href={`/contents/search?q=${encodeURIComponent(region)}`} className="rounded-[10px] border border-[#eee] p-5 text-[20px] font-bold">
              {region}
            </Link>
          ))}
        </div>
      </section>
    </TicketingPageShell>
  );
}
