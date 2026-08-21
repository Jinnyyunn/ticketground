import type { SeatPlace } from "@/types/seat-chart";
import { TextField, ToggleField } from "./inspector-controls";

export function SeatFields({ seat, onSeat }: { readonly seat: SeatPlace; readonly onSeat: (seat: SeatPlace) => void }) {
  return (
    <div className="space-y-4" data-testid="seat-designer-v2-seat-fields">
      <TextField label="좌석 라벨" value={seat.label} onChange={(label) => onSeat({ ...seat, label })} />
      <TextField label="관객 표시 라벨" value={seat.displayedLabel ?? ""} onChange={(displayedLabel) => onSeat({ ...seat, displayedLabel })} />
      <TextField label="좌석 시점 이미지 URL" value={seat.viewFromSeatHref ?? ""} onChange={(viewFromSeatHref) => onSeat({ ...seat, viewFromSeatHref })} />
      <ToggleField label="휠체어 좌석" checked={seat.accessible ?? false} onChange={(accessible) => onSeat({ ...seat, accessible })} />
      <ToggleField label="동반자 좌석" checked={seat.companion ?? false} onChange={(companion) => onSeat({ ...seat, companion })} />
      <ToggleField label="이동석" checked={seat.transferSeat ?? false} onChange={(transferSeat) => onSeat({ ...seat, transferSeat })} />
      <ToggleField label="시야 제한석" checked={seat.restrictedView ?? false} onChange={(restrictedView) => onSeat({ ...seat, restrictedView })} />
    </div>
  );
}
