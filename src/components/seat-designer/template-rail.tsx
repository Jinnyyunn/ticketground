"use client";

import { CHART_TEMPLATES, templateIdFromChart, type TemplateId } from "@/lib/seat-designer/templates";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import type { ChartDocument } from "@/types/seat-chart";
import { cn } from "@/lib/utils";
import { ChartLibrary } from "./chart-library";

function MiniPreview({ swatch, id }: { swatch: readonly string[]; id: TemplateId }) {
  if (id === "blank") {
    return (
      <div className="flex h-full w-full items-center justify-center rounded bg-[#f8fafc] text-[10px] text-[#94a3b8]">
        +
      </div>
    );
  }
  if (id === "gala-dinner") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded bg-white">
        <div className="absolute left-1/2 top-1 h-2 w-8 -translate-x-1/2 rounded-sm bg-[#6b7280]" />
        {swatch.map((c, i) => (
          <span
            key={i}
            className="absolute size-2.5 rounded-full border border-white/80"
            style={{
              background: c,
              left: `${18 + (i % 3) * 28}%`,
              top: `${30 + Math.floor(i / 3) * 32}%`,
            }}
          />
        ))}
      </div>
    );
  }
  if (id === "trade-show") {
    return (
      <div className="grid h-full w-full grid-cols-4 gap-0.5 rounded bg-white p-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="rounded-[2px]" style={{ background: swatch[i % swatch.length] }} />
        ))}
      </div>
    );
  }
  // theatres
  return (
    <div className="relative h-full w-full overflow-hidden rounded bg-white">
      <div className="absolute left-1/2 top-1.5 h-1.5 w-6 -translate-x-1/2 rounded-sm bg-[#6b7280]" />
      <div
        className="absolute left-1/2 top-[38%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-sm opacity-90"
        style={{ background: swatch[0] }}
      />
      <div
        className="absolute left-1/2 top-[58%] h-3 w-10 -translate-x-1/2 rounded-full opacity-80"
        style={{ background: swatch[1] ?? swatch[0] }}
      />
      <div
        className="absolute left-1/2 top-[78%] h-2.5 w-12 -translate-x-1/2 rounded-full opacity-70"
        style={{ background: swatch[2] ?? swatch[0] }}
      />
    </div>
  );
}

export function TemplateRail({
  chart,
  onSelect,
  api,
}: {
  readonly chart: ChartDocument;
  readonly onSelect: (id: TemplateId) => void;
  readonly api: SeatEditorApi;
}) {
  const active = templateIdFromChart(chart);

  return (
    <aside className="flex w-[112px] shrink-0 flex-col overflow-y-auto border-r border-black/10 bg-[#ececec]">
      <div className="flex flex-col gap-2 p-2">
        <div className="px-0.5 text-[10px] font-semibold tracking-wide text-[#666]">템플릿</div>
        {CHART_TEMPLATES.map((t) => {
          const selected = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              title={`${t.name}\n${t.description}`}
              onClick={() => {
                if (selected) return;
                const ok = window.confirm(
                  `"${t.name}" 템플릿을 불러올까요?\n현재 편집 내용은 되돌릴 수 있는 히스토리로만 남고, 새 차트로 교체됩니다.`,
                );
                if (ok) onSelect(t.id);
              }}
              className={cn(
                "group flex flex-col gap-1 rounded-lg border bg-white p-1.5 text-left shadow-sm transition",
                selected
                  ? "border-[#0784fa] ring-2 ring-[#0784fa]/35"
                  : "border-black/10 hover:border-[#0784fa]/50 hover:shadow",
              )}
            >
              <div className="h-[56px] w-full overflow-hidden rounded border border-black/5 bg-white">
                <MiniPreview swatch={t.swatch} id={t.id} />
              </div>
              <div className="px-0.5">
                <div
                  className={cn(
                    "text-[11px] font-semibold leading-tight",
                    selected ? "text-[#0784fa]" : "text-[#333]",
                  )}
                >
                  {t.name}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-[#888]">{t.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      <ChartLibrary api={api} />
    </aside>
  );
}
