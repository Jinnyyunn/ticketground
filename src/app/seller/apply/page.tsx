import { SellerApplicationForm } from "@/components/ticketing/seller-application-form";
import { TicketingPageShell } from "@/components/ticketing/page-shell";

export const metadata = {
  title: "기업 판매자 등록 신청 | Ticketground",
};

export default function SellerApplyPage() {
  return (
    <TicketingPageShell>
      <section className="ticketground-container py-10">
        <p className="text-sm font-black text-ticketground">기업 판매자 등록</p>
        <h1 className="mt-2 text-[34px] font-black text-ink">판매자 등록 신청</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-3">
          제작사, 기획사, 공연장, 문화재단, 스포츠구단 등 공연/경기 권리자가 Ticketground를 통해 판매를
          위탁하기 위한 신청서입니다. 담당자가 사업자등록번호와 연락처, 공연 정보를 확인한 뒤 승인하며,
          이 신청은 예비 신청으로 실제 판매 개시는 별도 계약과 관리자 카탈로그 등록 절차를 거쳐 진행됩니다.
        </p>
        <div className="mt-8 max-w-3xl">
          <SellerApplicationForm />
        </div>
      </section>
    </TicketingPageShell>
  );
}
