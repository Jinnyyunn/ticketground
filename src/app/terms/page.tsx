import { TicketingPageShell } from "@/components/ticketing/page-shell";

const terms = [
  {
    title: "서비스 이용",
    body: "Ticketground는 공연 예매, 클린티켓 확인, 공식 재판매와 고객 문의를 연결하는 티켓 서비스입니다. 회원은 본인 계정으로 예매와 문의 내역을 관리해야 합니다.",
  },
  {
    title: "예매와 결제",
    body: "예매 가능 좌석, 결제 금액, 수수료와 관람일 정보는 결제 전 화면에서 확인할 수 있습니다. 결제가 완료되면 마이페이지에서 예매 상태와 티켓 정보를 확인할 수 있습니다.",
  },
  {
    title: "취소와 환불",
    body: "취소 가능 여부와 환불 금액은 공연별 정책과 관람일 기준에 따라 달라질 수 있습니다. 취소/환불 화면에서 예상 수수료를 확인한 뒤 진행합니다.",
  },
  {
    title: "공식 재판매",
    body: "공식 재판매는 Ticketground가 제공하는 절차 안에서만 등록할 수 있습니다. 외부 거래, 캡처 이미지 전달, 비공식 양도는 지원하지 않습니다.",
  },
  {
    title: "고객 문의",
    body: "서비스 이용 중 문제가 발생하면 고객센터 또는 1:1 문의를 통해 예매번호와 공연 정보를 포함해 접수할 수 있습니다.",
  },
] as const;

export default function TermsPage() {
  return (
    <TicketingPageShell>
      <section className="bg-surface">
        <div className="ticketground-container py-12">
          <p className="text-sm font-black text-ticketground">Ticketground</p>
          <h1 className="balanced-title mt-3 text-[30px] font-black leading-tight text-ink sm:text-[34px]">이용약관</h1>
          <p className="mt-4 max-w-[720px] text-sm leading-loose text-ink-3">
            Ticketground 서비스 이용을 위한 주요 기준을 안내합니다. 실제 서비스 운영 정책은 공연, 판매자, 결제 수단에 따라 달라질 수 있습니다.
          </p>
        </div>
      </section>

      <section className="ticketground-container py-10">
        <div className="grid gap-4">
          {terms.map((term) => (
            <article key={term.title} className="rounded-lg border border-line bg-white p-5">
              <h2 className="text-lg font-black text-ink">{term.title}</h2>
              <p className="mt-3 text-sm leading-loose text-ink-3">{term.body}</p>
            </article>
          ))}
        </div>
      </section>
    </TicketingPageShell>
  );
}
