import { KakaoChannelChat } from "@/components/support/kakao-channel-chat";
import { TicketingPageShell } from "@/components/ticketing/page-shell";

export default function InquiryPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <p className="text-sm font-black text-ticketground">1:1 문의</p>
        <h1 className="mt-2 text-[34px] font-black text-ink">카카오톡 1:1 문의</h1>
        <p className="mt-3 text-sm text-ink-3">Ticketground 1:1 문의는 카카오톡 채널에서만 접수합니다.</p>
        <div className="mt-8">
          <KakaoChannelChat />
        </div>
      </section>
    </TicketingPageShell>
  );
}
