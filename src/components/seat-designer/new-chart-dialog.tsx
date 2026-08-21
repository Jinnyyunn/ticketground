"use client";

import { useEffect, useState } from "react";
import { FileImage, Plus, X } from "lucide-react";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import type { SeatChartVenue } from "@/lib/seat-charts/types";
import { listBindableVenues } from "@/lib/seat-charts/venues";
import { ReferenceChartPanel } from "./reference-chart-panel";

export function NewChartDialog({ api, open, onClose }: { readonly api: SeatEditorApi; readonly open: boolean; readonly onClose: () => void }) {
  const [mode, setMode] = useState<"choice" | "reference">("choice");
  const [venues, setVenues] = useState<readonly SeatChartVenue[]>([]);
  const [venue, setVenue] = useState<SeatChartVenue | null>(null);
  const [name, setName] = useState("새 좌석 배치도");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    void listBindableVenues()
      .then((items) => {
        if (!active) return;
        setVenues(items);
        setVenue((current) => current ?? items[0] ?? null);
      })
      .catch(() => {
        if (active) setError("공연장 목록을 불러오지 못했습니다.");
      });
    return () => { active = false; };
  }, [open]);
  if (!open) return null;
  const close = () => { setMode("choice"); onClose(); };
  const begin = () => {
    if (!venue || !name.trim()) {
      setError("공연장과 좌석 배치도 이름을 입력하세요.");
      return false;
    }
    api.loadTemplate("blank");
    api.dispatch({ type: "SET_NAME", name: name.trim() });
    api.dispatch({ type: "SET_BOUND_VENUE", venue });
    setError("");
    return true;
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="새 좌석 차트 만들기">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-[#20242a]">새 좌석 배치도</h2><p className="mt-1 text-sm text-[#667085]">공연장을 선택하고 빈 캔버스나 도면에서 시작하세요.</p></div>{api.state.boundVenue && <button type="button" className="rounded-md p-2 hover:bg-black/5" onClick={close} aria-label="닫기"><X className="size-5" /></button>}</div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <label className="text-[13px] font-medium text-[#444]">공연장
            <select className="mt-1.5 w-full rounded-md border border-black/15 bg-white px-3 py-2" value={venue?.id ?? ""} onChange={(event) => setVenue(venues.find((item) => item.id === event.target.value) ?? null)}>
              <option value="">공연장 선택</option>
              {venues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-[13px] font-medium text-[#444]">좌석 배치도 이름
            <input className="mt-1.5 w-full rounded-md border border-black/15 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="mb-4 text-[13px] text-[#c4362e]">{error}</p>}
        {mode === "choice" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="rounded-xl border border-black/10 p-5 text-left hover:border-[#0784fa] hover:bg-[#f5f9ff]" onClick={() => { if (begin()) close(); }}><Plus className="mb-8 size-7 text-[#0784fa]" /><strong className="block text-sm">빈 캔버스</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">모든 좌석과 도형을 직접 배치합니다.</span></button>
            <button type="button" className="rounded-xl border border-[#9dccf8] bg-[#f5f9ff] p-5 text-left hover:border-[#0784fa]" onClick={() => { if (begin()) setMode("reference"); }}><FileImage className="mb-8 size-7 text-[#0784fa]" /><strong className="block text-sm">도면 불러오기</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">이미지를 불러와 편집하거나 좌석을 자동 인식합니다.</span></button>
          </div>
        ) : (
          <ReferenceChartPanel onComplete={(input) => { api.startFromReference({ ...input, name: name.trim() }); close(); }} />
        )}
      </div>
    </div>
  );
}
