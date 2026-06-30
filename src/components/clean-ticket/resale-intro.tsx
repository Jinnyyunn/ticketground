import { CleanTicketPolicyBanner, TicketgroundTag } from "@/components/ticketground/primitives";

export function ResaleIntro({ apiStatus }: { readonly apiStatus: string }) {
  return (
    <>
      <header>
        <TicketgroundTag tone="sale">CLEAN TICKET</TicketgroundTag>
        <h1 className="mt-3 text-4xl font-black text-ink">공식 재판매</h1>
        <p className="mt-3 max-w-[720px] text-base leading-loose text-ink-3">
          좌석 지정 거래를 막고 공식 풀에서 조건부 랜덤 매칭으로 배정합니다. 재판매 등록은 정가의 90~100%만 허용됩니다.
        </p>
      </header>

      <CleanTicketPolicyBanner>
        <ul className="grid gap-2 sm:grid-cols-3">
          <li>등록가: 정가의 90~100%</li>
          <li>플랫폼 수수료: 거래액 5%</li>
          <li>구매자는 좌석번호 직접 선택 불가</li>
        </ul>
      </CleanTicketPolicyBanner>
      <div className="rounded-lg border border-line bg-surface p-4" aria-live="polite">
        <p className="text-sm font-black text-ink">공식 재판매 상태</p>
        <p className="mt-1 text-sm font-bold text-ink-3">{apiStatus}</p>
      </div>
    </>
  );
}
