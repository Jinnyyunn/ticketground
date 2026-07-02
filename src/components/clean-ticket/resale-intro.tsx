import { TicketgroundTag } from "@/components/ticketground/primitives";

const resalePolicyItems = [
  {
    label: "등록가",
    value: "정가의 90~100%",
    note: "정가 범위 안에서만 공식 풀에 등록",
  },
  {
    label: "수수료",
    value: "거래액 5%",
    note: "플랫폼 클린티켓 운영 수수료",
  },
  {
    label: "좌석",
    value: "조건부 랜덤 매칭",
    note: "구매자는 좌석번호 직접 선택 불가",
  },
] as const;

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

      <aside
        className="relative overflow-hidden rounded-xl border border-line bg-background text-ink shadow-ticket-2"
        aria-labelledby="resale-policy-title"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-ticketground" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 bg-ink px-5 py-4 text-background">
          <div className="min-w-0">
            <p id="resale-policy-title" className="font-black">
              클린티켓 정책
            </p>
            <p className="mt-1 text-sm font-bold leading-relaxed text-background/70">
              등록 가능 금액과 좌석 배정 기준을 한 번에 확인하세요.
            </p>
          </div>
          <span className="shrink-0 rounded-sm bg-accent-2 px-2.5 py-1 text-xs font-black text-ink">
            공식
          </span>
        </div>

        <dl className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {resalePolicyItems.map((item, index) => (
            <div
              key={item.label}
              className="flex items-start gap-3 bg-background p-4 sm:p-5"
              data-resale-policy-item={item.label}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface text-xs font-black text-ticketground"
                aria-hidden="true"
              >
                {`0${index + 1}`}
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-black text-ticketground">{item.label}</dt>
                <dd className="mt-0.5 text-base font-black leading-snug text-ink">{item.value}</dd>
                <dd className="mt-1 text-xs font-bold leading-relaxed text-ink-3">{item.note}</dd>
              </div>
            </div>
          ))}
        </dl>
      </aside>
      <div className="rounded-lg border border-line bg-surface p-4" aria-live="polite">
        <p className="text-sm font-black text-ink">공식 재판매 상태</p>
        <p className="mt-1 text-sm font-bold text-ink-3">{apiStatus}</p>
      </div>
    </>
  );
}
