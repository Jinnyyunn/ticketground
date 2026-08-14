"use client";

import { useCallback, useEffect, useState } from "react";
import { apiListCharts } from "@/lib/seat-charts/client";
import type { SeatChartSummary } from "@/lib/seat-charts/types";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import { cn } from "@/lib/utils";

export function ChartLibrary({ api }: { readonly api: SeatEditorApi }) {
  const [charts, setCharts] = useState<SeatChartSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await apiListCharts();
      setCharts(list);
    } catch {
      setError("목록 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, api.state.serverStatus]);

  return (
    <div className="border-t border-black/10 px-1.5 py-2">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="text-[10px] font-semibold tracking-wide text-[#666]">서버 차트</span>
        <button type="button" className="text-[10px] text-[#0784fa]" onClick={() => void refresh()}>
          새로고침
        </button>
      </div>
      {loading && <p className="px-0.5 text-[10px] text-[#999]">불러오는 중…</p>}
      {error && <p className="px-0.5 text-[10px] text-red-500">{error}</p>}
      {!loading && charts.length === 0 && (
        <p className="px-0.5 text-[10px] leading-snug text-[#999]">저장된 차트 없음. 서버 저장 후 표시됩니다.</p>
      )}
      <ul className="max-h-[220px] space-y-1.5 overflow-y-auto">
        {charts.map((c) => {
          const active = api.state.chart.id === c.id || api.state.chart.id.startsWith(c.id);
          return (
            <li key={c.id}>
              <div
                className={cn(
                  "rounded-md border bg-white p-1.5 text-left shadow-sm",
                  active ? "border-[#0784fa]" : "border-black/10",
                )}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => void api.loadFromServer(c.id)}
                  title="불러오기"
                >
                  <div className="text-[11px] font-semibold leading-tight text-[#333]">{c.name}</div>
                  <div className="mt-0.5 text-[9px] text-[#888]">
                    {c.placeCount.toLocaleString("ko-KR")}석 ·{" "}
                    <span className={c.published ? "text-emerald-600" : "text-amber-600"}>
                      {c.published ? "게시" : "초안"}
                    </span>
                  </div>
                  {c.boundShowSlugs.length > 0 && (
                    <div className="mt-0.5 line-clamp-2 text-[9px] text-[#0784fa]">
                      {c.boundShowSlugs.join(", ")}
                    </div>
                  )}
                </button>
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    className="flex-1 rounded border border-black/10 py-0.5 text-[9px] hover:bg-black/[0.03]"
                    onClick={() => void api.loadFromServer(c.id)}
                  >
                    열기
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-1.5 py-0.5 text-[9px] text-red-500"
                    onClick={() => {
                      if (window.confirm(`"${c.name}" 을(를) 서버에서 삭제할까요?`)) {
                        void api.deleteFromServer(c.id).then(() => refresh());
                      }
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
