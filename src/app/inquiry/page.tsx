import { InquiryForm } from "@/components/ticketing/inquiry-form";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { inquiryThreads } from "@/data/ticketing-inquiries";
import { reservations, ticketShows } from "@/data/ticketing";

export default function InquiryPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <p className="text-sm font-black text-ticketground">1:1 문의</p>
        <h1 className="mt-2 text-[34px] font-black text-ink">문의 스레드</h1>
        <p className="mt-3 text-sm text-ink-3">예매정보가 자동 첨부된 대화형 문의함입니다. 공연 당일 입장 문의는 우선 분류됩니다.</p>
        <div className="mt-8">
          <InquiryForm threads={inquiryThreads} reservations={reservations} shows={ticketShows} />
        </div>
      </section>
    </TicketingPageShell>
  );
}
