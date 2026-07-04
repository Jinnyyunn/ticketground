type VirtualTicketCardProps = {
  readonly date: string;
  readonly reservationId: string;
  readonly seatLabel: string;
  readonly ticketIndex: number;
  readonly ticketTotal: number;
};

export function VirtualTicketCard({ date, reservationId, seatLabel, ticketIndex, ticketTotal }: VirtualTicketCardProps) {
  const displayReservationId = ticketTotal > 1 ? `${reservationId}-${String(ticketIndex + 1).padStart(2, "0")}` : reservationId;

  return (
    <figure
      aria-label="소유 확인용 가상 티켓 이미지"
      className="relative mx-auto aspect-[4/5] w-full max-w-[260px] overflow-hidden rounded-[10px] border border-line bg-white p-3 shadow-ticket-1"
    >
      <div className="absolute inset-x-0 top-0 h-2 bg-ticketground" />
      <div className="flex h-full flex-col rounded-sm border border-line bg-surface">
        <div className="bg-white px-3 py-3 text-left">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-black tracking-[0.08em] text-ticketground">TICKETGROUND</p>
              <p className="mt-1 text-xl leading-tight font-black text-ink">VIRTUAL TICKET</p>
            </div>
            <p className="rounded-full border border-line bg-surface px-2 py-1 text-[10px] font-black text-ink-3">
              {ticketIndex + 1}/{ticketTotal}
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between p-3 text-left">
          <div>
            <p className="text-[11px] font-black text-ink-3">소유 확인</p>
            <p className="mt-1 break-all text-sm font-black text-ink">{displayReservationId}</p>
          </div>
          <div className="grid gap-2 text-[11px]">
            <div className="rounded-[6px] border border-line bg-white px-2 py-1">
              <p className="font-black text-ink-3">DATE</p>
              <p className="mt-0.5 font-bold text-ink">{date}</p>
            </div>
            <div className="rounded-[6px] border border-line bg-white px-2 py-1">
              <p className="font-black text-ink-3">SEAT</p>
              <p className="mt-0.5 break-words font-bold text-ink">{seatLabel}</p>
            </div>
            <div className="flex items-center justify-between rounded-[6px] bg-ink px-2 py-2 text-[11px] font-black text-white">
              <span>APP ONLY</span>
              <span>입장 불가</span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
