"use client";

import { useState } from "react";
import { FileImage, LayoutTemplate, Plus, X } from "lucide-react";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import { ReferenceChartPanel } from "./reference-chart-panel";

export function NewChartDialog({ api, open, onClose }: { readonly api: SeatEditorApi; readonly open: boolean; readonly onClose: () => void }) {
  const [mode, setMode] = useState<"choice" | "reference">("choice");
  if (!open) return null;
  const close = () => { setMode("choice"); onClose(); };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="새 좌석 차트 만들기">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-[#20242a]">새 좌석 차트</h2><p className="mt-1 text-sm text-[#667085]">빈 캔버스, 템플릿 또는 실제 공연장 도면에서 시작하세요.</p></div><button type="button" className="rounded-md p-2 hover:bg-black/5" onClick={close} aria-label="닫기"><X className="size-5" /></button></div>
        {mode === "choice" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <button type="button" className="rounded-xl border border-black/10 p-5 text-left hover:border-[#0784fa] hover:bg-[#f5f9ff]" onClick={() => { api.loadTemplate("blank"); close(); }}><Plus className="mb-8 size-7 text-[#0784fa]" /><strong className="block text-sm">빈 차트</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">모든 요소를 직접 배치합니다.</span></button>
            <button type="button" className="rounded-xl border border-black/10 p-5 text-left hover:border-[#0784fa] hover:bg-[#f5f9ff]" onClick={close}><LayoutTemplate className="mb-8 size-7 text-[#0784fa]" /><strong className="block text-sm">템플릿 선택</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">왼쪽 템플릿 목록에서 시작합니다.</span></button>
            <button type="button" className="rounded-xl border border-[#9dccf8] bg-[#f5f9ff] p-5 text-left hover:border-[#0784fa]" onClick={() => setMode("reference")}><FileImage className="mb-8 size-7 text-[#0784fa]" /><strong className="block text-sm">도면 불러오기</strong><span className="mt-1 block text-xs leading-5 text-[#667085]">JPG·PNG·PDF를 트레이싱하거나 좌석을 자동 인식합니다.</span></button>
          </div>
        ) : (
          <ReferenceChartPanel onComplete={(input) => { api.startFromReference(input); close(); }} />
        )}
      </div>
    </div>
  );
}
