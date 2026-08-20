export function canEnterSeatSelection(input: {
  readonly bookable: boolean;
  readonly timerExpired: boolean;
  readonly date: string;
  readonly time: string;
  readonly quantity: number;
  readonly chartReady: boolean;
  readonly inventoryReady: boolean;
}): boolean {
  return input.bookable
    && !input.timerExpired
    && Boolean(input.date && input.time && input.quantity)
    && input.chartReady
    && input.inventoryReady;
}

export function seatChartReadinessMessage(input: { readonly loaded: boolean; readonly chartReady: boolean; readonly bindingReady: boolean }): string {
  if (!input.loaded) return "공연장 좌석 배치도 확인 중";
  if (!input.chartReady) return "공연장 좌석 배치도 준비 중";
  if (!input.bindingReady) return "게시된 좌석 배치도와 예매 좌석을 연결할 수 없습니다.";
  return "좌석 배치도 준비 완료";
}
