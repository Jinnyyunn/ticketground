import Link from "next/link";
import { TicketingPageShell } from "@/components/ticketing/page-shell";

const categories = ["예매/결제", "클린티켓", "취소/환불", "입장/현장"] as const;

const faqs = [
  {
    question: "예매내역은 어디에서 확인하나요?",
    answer: "마이페이지의 예매내역에서 공연일, 좌석, 결제 금액, 클린티켓 QR 상태를 확인할 수 있습니다.",
  },
  {
    question: "공식 재판매와 양도는 어디에서 진행하나요?",
    answer: "마이페이지 예매내역에서 공식 재판매와 동반자 양도로 이동할 수 있습니다. 재판매는 정가의 90~100% 범위에서만 등록됩니다.",
  },
  {
    question: "공연 당일 입장 문의는 어떻게 하나요?",
    answer: "공연 당일 입장 문의는 1:1 문의에서 예매번호를 포함해 남기면 우선 응대합니다.",
  },
  {
    question: "가상 티켓과 입장 QR은 무엇이 다른가요?",
    answer: "구매 직후 티켓은 소유 확인용 가상 티켓입니다. 공연 2~3시간 전 앱에서 20초 갱신 입장 QR이 활성화됩니다.",
  },
  {
    question: "취소 수수료는 어디에서 확인하나요?",
    answer: "취소/환불 화면에서 관람일 기준 수수료 정책과 예상 환불액을 단계별로 확인한 뒤 동의할 수 있습니다.",
  },
  {
    question: "관심공연 알림은 언제 발송되나요?",
    answer: "관심공연으로 등록하면 예매 오픈 D-3과 당일에 선택한 채널로 알림을 받을 수 있습니다.",
  },
  {
    question: "동반자가 따로 입장해야 하면 어떻게 하나요?",
    answer: "QR 캡처 전달은 지원하지 않습니다. 공식 양도에서 받는 사람 정보를 등록하면 동반자가 별도로 입장할 수 있습니다.",
  },
] as const;

type Contact = {
  readonly label: string;
  readonly value: string;
  readonly description: string;
  readonly href?: string;
};

const contacts: readonly Contact[] = [
  { label: "전화 상담", value: "1577-0000", description: "평일 09:00~18:00, 공연 당일 입장 문의 우선 응대" },
  { label: "1:1 문의", value: "문의 스레드 열기", description: "예매정보 자동첨부, 상담원 답변과 시스템 접수 알림", href: "/inquiry" },
  { label: "카카오 상담", value: "Ticketground 채널", description: "알림 수신 동의와 예매 오픈 알림 설정을 함께 확인" },
];

export default function HelpPage() {
  return (
    <TicketingPageShell>
      <section className="bg-ink text-white">
        <div className="ticketground-container py-12">
          <p className="text-sm font-black text-accent-2">고객센터</p>
          <h1 className="balanced-title mt-3 text-[30px] font-black leading-tight sm:text-[34px]">무엇을 도와드릴까요?</h1>
          <Link
            href="/contents/search"
            className="mt-7 flex h-12 max-w-[620px] items-center rounded-full bg-white px-5 text-sm font-bold text-ink-3"
          >
            예매번호, 공연명, 문의 유형 검색
          </Link>
        </div>
      </section>

      <section className="ticketground-container py-10">
        <div className="grid gap-3 md:grid-cols-4">
          {categories.map((category) => (
            <Link key={category} href="#faq" className="rounded-lg border border-line bg-surface px-5 py-4 text-sm font-black text-ink hover:border-line-strong">
              {category}
            </Link>
          ))}
        </div>

        <div id="faq" className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-lg font-black text-ink">FAQ 카테고리</h2>
            <nav className="mt-4 grid gap-2 text-sm font-bold text-ink-3" aria-label="FAQ category navigation">
              {categories.map((category) => (
                <a key={category} href="#faq" className="rounded-lg px-3 py-2 hover:bg-surface hover:text-ink">
                  {category}
                </a>
              ))}
            </nav>
          </aside>

          <div>
            <h2 className="text-2xl font-black text-ink">자주 묻는 질문</h2>
            <div className="mt-5 grid gap-3">
              {faqs.map((faq) => (
                <details key={faq.question} className="rounded-lg border border-line bg-white p-5">
                  <summary className="cursor-pointer text-sm font-black text-ink">{faq.question}</summary>
                  <p className="mt-3 text-sm leading-loose text-ink-3">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {contacts.map((contact) => {
            const body = (
              <>
                <span className="text-xs font-black text-ticketground">{contact.label}</span>
                <strong className="mt-2 block text-lg font-black text-ink">{contact.value}</strong>
                <span className="mt-3 block text-sm leading-loose text-ink-3">{contact.description}</span>
              </>
            );
            return contact.href ? (
              <Link key={contact.label} href={contact.href} className="rounded-lg border border-line bg-white p-5 hover:border-line-strong">
                {body}
              </Link>
            ) : (
              <article key={contact.label} className="rounded-lg border border-line bg-white p-5">
                {body}
              </article>
            );
          })}
        </div>
      </section>
    </TicketingPageShell>
  );
}
