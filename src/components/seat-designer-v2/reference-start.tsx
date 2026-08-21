"use client";

import { Building2, FileImage, Upload } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { apiUploadReferenceAsset } from "@/lib/seat-charts/client";
import type { SeatChartVenue } from "@/lib/seat-charts/types";
import { listBindableVenues } from "@/lib/seat-charts/venues";
import type { V2ReferencePlan } from "./editor-model";

type ReferenceStartProps = {
  readonly onBlank: (venue: SeatChartVenue) => void;
  readonly onReady: (plan: V2ReferencePlan, venue: SeatChartVenue) => void;
};

export function ReferenceStart({ onBlank, onReady }: ReferenceStartProps) {
  const inputId = useId();
  const [venues, setVenues] = useState<readonly SeatChartVenue[]>([]);
  const [venueId, setVenueId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let active = true;
    void listBindableVenues().then((items) => {
      if (!active) return;
      setVenues(items);
      setVenueId(items[0]?.id ?? "");
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "공연장 목록을 불러오지 못했습니다.");
    });
    return () => { active = false; };
  }, []);

  const venue = venues.find((item) => item.id === venueId) ?? null;

  async function upload(file: File): Promise<void> {
    if (!venue) {
      setError("좌석 배치도를 적용할 공연장을 먼저 선택하세요.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const uploaded = await apiUploadReferenceAsset({ file, purpose: "reference" });
      onReady({ asset: uploaded.asset, href: uploaded.url, name: file.name, opacity: 0.5, locked: true, visible: true, x: 80, y: 60, width: 760, height: 560, rotation: 0 }, venue);
    } catch (cause) {
      setError(cause instanceof Error ? "도면을 불러오지 못했습니다. 파일 형식과 용량을 확인하세요." : "도면을 불러오지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#f4f4f4] p-6" data-testid="seat-designer-v2-reference-start">
      <section className="w-full max-w-[680px] rounded border border-[#d8d8d8] bg-white p-8 shadow-[0_18px_54px_rgba(0,0,0,.12)]">
        <div className="mb-6 flex items-start gap-4">
          <div className="grid size-12 place-items-center rounded bg-[#eef6ff] text-[#087ffa]"><FileImage /></div>
          <div><h1 className="text-xl font-semibold text-[#252525]">공연장 좌석 배치도 불러오기</h1><p className="mt-1 text-sm text-[#707070]">공연장 도면을 먼저 올린 뒤 그 위에 좌석과 구역을 그대로 배치합니다.</p></div>
        </div>
        <label className="mb-4 block text-sm font-medium text-[#3f3f3f]" htmlFor="v2-venue"><span className="mb-2 flex items-center gap-2"><Building2 className="size-4" />적용 공연장</span><select id="v2-venue" data-testid="seat-designer-v2-venue" value={venueId} onChange={(event) => setVenueId(event.currentTarget.value)} className="h-10 w-full rounded border border-[#cfcfcf] bg-white px-3 outline-none focus:border-[#087ffa]"><option value="">공연장을 선택하세요</option>{venues.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor={inputId} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void upload(file); }} className={`grid min-h-64 cursor-pointer place-items-center rounded border-2 border-dashed text-center transition-colors ${dragging ? "border-[#087ffa] bg-[#eef6ff]" : "border-[#c9c9c9] bg-[#fafafa] hover:border-[#087ffa] hover:bg-[#f5faff]"}`}>
          <span><Upload className="mx-auto mb-4 size-9 text-[#777]" /><strong className="block text-base text-[#333]">도면을 끌어놓거나 클릭해 업로드</strong><small className="mt-2 block text-[#777]">PNG, GIF, JPEG, WEBP, SVG, PDF · 최대 10 MB</small></span>
          <input id={inputId} className="sr-only" type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf" disabled={pending || !venue} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
        </label>
        {pending && <p className="mt-4 text-sm text-[#087ffa]">도면을 안전하게 준비하고 있습니다…</p>}
        {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-6 flex items-center justify-between"><span className="text-xs text-[#777]">업로드한 도면은 잠긴 트레이싱 레이어로 배치됩니다.</span><button type="button" disabled={!venue} className="rounded border border-[#ccc] px-4 py-2 text-sm text-[#555] hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => { if (venue) onBlank(venue); }}>빈 캔버스로 시작</button></div>
      </section>
    </div>
  );
}
