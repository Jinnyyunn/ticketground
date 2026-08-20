"use client";

import type { ScannerRow } from "@/lib/seat-designer/scanner";

export function ScannerReview({
  rows,
  onAccept,
  onBack,
}: {
  readonly rows: readonly ScannerRow[];
  readonly onAccept: () => void;
  readonly onBack: () => void;
}) {
  const seatCount = rows.reduce((total, row) => total + row.candidates.length, 0);
  return (
    <section className="space-y-4" aria-label="좌석 자동 인식 검토">
      <div className="rounded-lg border border-[#b7d9fb] bg-[#eff7ff] p-4">
        <p className="text-sm font-semibold text-[#124f85]">{rows.length}개 행 · {seatCount}석 감지</p>
        <p className="mt-1 text-xs leading-5 text-[#49677f]">확정 전 도면과 행별 좌석 수를 확인하세요. 확정하면 일반 좌석 행으로 변환되며 이후 편집할 수 있습니다.</p>
      </div>
      <div className="max-h-44 overflow-y-auto rounded-lg border border-black/10">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between border-b border-black/5 px-3 py-2 text-sm last:border-b-0">
            <span className="font-semibold">{row.label}행</span>
            <span className="text-[#667085]">{row.candidates.length}석</span>
          </div>
        ))}
        {rows.length === 0 && <p className="p-4 text-sm text-[#667085]">감지된 좌석이 없습니다. 임계값을 조정하거나 도면을 직접 따라 그려주세요.</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-md border border-black/10 px-4 py-2 text-sm" onClick={onBack}>도면 다시 선택</button>
        <button type="button" className="rounded-md bg-[#0784fa] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={rows.length === 0} onClick={onAccept}>감지 좌석 확정</button>
      </div>
    </section>
  );
}
