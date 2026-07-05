import { SummaryRow, TicketgroundToast } from "@/components/ticketground/primitives";

type ResaleAuditAsideProps = {
  readonly policyMaxPercent: number;
  readonly policyMinPercent: number;
  readonly reservationId: string;
  readonly seatLabel: string;
  readonly showTitle: string;
  readonly toast: string;
};

export function ResaleAuditAside({
  policyMaxPercent,
  policyMinPercent,
  reservationId,
  seatLabel,
  showTitle,
  toast,
}: ResaleAuditAsideProps) {
  return (
    <aside className="h-fit rounded-xl border border-line bg-card shadow-ticket-2 lg:sticky lg:top-24">
      <div className="border-b border-line bg-ink px-5 py-4 text-on-ink">
        <p className="text-xs font-black text-accent-2">OFFICIAL LEDGER</p>
        <h2 className="mt-2 break-words text-2xl font-black">{reservationId}</h2>
        <p className="mt-1 text-sm font-bold text-on-ink-2">판매자와 구매자 모두 같은 원장 기준으로 검증됩니다.</p>
      </div>
      <div className="grid gap-4 p-5">
        <dl className="rounded-lg border border-line bg-surface px-4">
          <SummaryRow label="공연" value={showTitle} />
          <SummaryRow label="보유 좌석" value={seatLabel} />
          <SummaryRow label="정책 범위" value={`${policyMinPercent}~${policyMaxPercent}%`} />
          <SummaryRow label="플랫폼 수수료" value="5%" strong />
        </dl>
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-black text-ink-3">
          <span className="rounded-sm border border-line bg-background px-2 py-2">정가 범위</span>
          <span className="rounded-sm border border-line bg-background px-2 py-2">랜덤 배정</span>
          <span className="rounded-sm border border-line bg-background px-2 py-2">수수료 공개</span>
          <span className="rounded-sm border border-line bg-background px-2 py-2">원장 기록</span>
        </div>
        {toast && <div data-testid="resale-toast"><TicketgroundToast title={toast} tone="success" /></div>}
      </div>
    </aside>
  );
}
