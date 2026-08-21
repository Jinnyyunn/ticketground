import Image from "next/image";
import { ImageOff, X } from "lucide-react";
import type { SeatPlace } from "@/types/seat-chart";

type SeatViewDialogProps = {
  readonly seat: SeatPlace;
  readonly onClose: () => void;
};

function safeSeatViewHref(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") || value.startsWith("data:image/") || value.startsWith("https://")) return value;
  return null;
}

export function SeatViewDialog({ seat, onClose }: SeatViewDialogProps) {
  const href = safeSeatViewHref(seat.viewFromSeatHref);
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-[var(--editor-overlay)] p-4"
      data-testid="seat-designer-v2-seat-view-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={`${seat.displayedLabel ?? seat.label} 좌석 시점`}
    >
      <section className="flex max-h-[86dvh] w-full max-w-3xl flex-col overflow-hidden rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--editor-border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">좌석 시점</h2>
            <p className="mt-1 text-sm text-[var(--editor-muted)]">{seat.displayedLabel ?? seat.label} 좌석에서 보이는 무대 이미지</p>
          </div>
          <button type="button" title="좌석 시점 닫기" className="grid size-9 place-items-center rounded hover:bg-[var(--editor-hover)]" onClick={onClose}>
            <X className="size-4" />
          </button>
        </header>
        <div className="grid min-h-72 place-items-center bg-[var(--editor-panel)] p-5">
          {href ? (
            <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded bg-[var(--editor-surface)] shadow-[var(--editor-elevation)]">
              <Image
                src={href}
                alt={`${seat.displayedLabel ?? seat.label} 좌석 시점`}
                fill
                sizes="(min-width: 768px) 672px, calc(100vw - 72px)"
                unoptimized
                className="object-contain"
              />
            </div>
          ) : (
            <div className="grid max-w-sm place-items-center gap-3 text-center text-sm text-[var(--editor-muted)]">
              <ImageOff className="size-10" />
              <p className="break-keep">선택한 좌석에 시점 이미지가 없습니다. 좌석 설정에서 이미지 URL을 먼저 등록하세요.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
