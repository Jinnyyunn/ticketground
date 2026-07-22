import { GroupBookingForm } from "@/components/ticketing/group-booking-form";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getGroupBookingCatalogEvents } from "@/data/catalog-server";

export const metadata = {
  title: "단체/기관 예매 신청 | Ticketground",
};

export default async function GroupBookingPage() {
  const events = await getGroupBookingCatalogEvents();
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <p className="text-sm font-black text-ticketground">단체/기관 예매</p>
        <h1 className="mt-2 text-[34px] font-black text-ink">단체/기관 예매 신청</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
          학교, 학원, 복지기관, 기업, 지자체 등 단체로 예매하실 경우 아래 신청서를 제출해주세요. 담당자 검토 후
          희망 공연의 좌석 확보 상황에 맞춰 배정 결과를 안내해드립니다. 단체 예매 티켓은 개인 재판매 및 공식
          재판매 풀 등록이 제한됩니다.
        </p>
        <div className="mt-8 max-w-2xl">
          <GroupBookingForm events={events} />
        </div>
      </section>
    </TicketingPageShell>
  );
}
