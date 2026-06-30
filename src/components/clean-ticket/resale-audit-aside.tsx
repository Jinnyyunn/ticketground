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
    <aside className="h-fit rounded-xl border border-line bg-card p-5 shadow-ticket-1">
      <p className="text-sm font-bold text-ticketground">감사 원장 연동</p>
      <h2 className="mt-2 text-2xl font-black text-ink">{reservationId}</h2>
      <dl className="mt-4 rounded-lg bg-surface px-4">
        <SummaryRow label="공연" value={showTitle} />
        <SummaryRow label="보유 좌석" value={seatLabel} />
        <SummaryRow label="정책 범위" value={`${policyMinPercent}~${policyMaxPercent}%`} />
        <SummaryRow label="백엔드 수수료" value="5%" strong />
      </dl>
      {toast && <div className="mt-4" data-testid="resale-toast"><TicketgroundToast title={toast} tone="success" /></div>}
    </aside>
  );
}
