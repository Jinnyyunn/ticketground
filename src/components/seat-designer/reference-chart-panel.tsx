"use client";

import { useCallback, useState } from "react";
import { FileImage, ScanSearch, Upload } from "lucide-react";
import { apiUploadReferenceAsset } from "@/lib/seat-charts/client";
import { referenceAssetSizeError } from "@/lib/seat-designer/reference-asset-policy";
import { acceptScannerRows, type ScannerRow } from "@/lib/seat-designer/scanner";
import { ScannerReview } from "./scanner-review";

type PreparedReference = {
  readonly file: File;
  readonly width: number;
  readonly height: number;
  readonly gray: Uint8ClampedArray;
};

async function renderReference(file: File, pageNumber: number): Promise<PreparedReference> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("REFERENCE_CANVAS_UNAVAILABLE");
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    if (pageNumber < 1 || pageNumber > pdf.numPages) throw new Error("REFERENCE_ASSET_PAGE_OUT_OF_RANGE");
    const page = await pdf.getPage(pageNumber);
    const rawViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 2200 / Math.max(rawViewport.width, rawViewport.height));
    const viewport = page.getViewport({ scale });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
  } else {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2500 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  }
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let source = 0, target = 0; source < rgba.data.length; source += 4, target += 1) {
    gray[target] = Math.round(rgba.data[source] * 0.299 + rgba.data[source + 1] * 0.587 + rgba.data[source + 2] * 0.114);
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("REFERENCE_ENCODE_FAILED")), "image/png"));
  return { file: new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-page-${pageNumber}.png`, { type: "image/png" }), width: canvas.width, height: canvas.height, gray };
}

export function ReferenceChartPanel({
  onComplete,
}: {
  readonly onComplete: (input: { readonly href: string; readonly width: number; readonly height: number; readonly rows?: ReturnType<typeof acceptScannerRows> }) => void;
}) {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [threshold, setThreshold] = useState(120);
  const [prepared, setPrepared] = useState<PreparedReference | null>(null);
  const [rows, setRows] = useState<readonly ScannerRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const prepare = useCallback(async (scan: boolean) => {
    if (!sourceFile) return;
    setBusy(true);
    setError("");
    try {
      const next = await renderReference(sourceFile, page);
      setPrepared(next);
      if (!scan) {
        const upload = await apiUploadReferenceAsset({ file: next.file, purpose: "reference" });
        onComplete({ href: upload.url, width: next.width, height: next.height });
        return;
      }
      const worker = new Worker(new URL("../../lib/seat-designer/scanner-worker.ts", import.meta.url), { type: "module" });
      const result = await new Promise<{ readonly rows: readonly ScannerRow[] }>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<{ readonly rows: readonly ScannerRow[] }>) => resolve(event.data);
        worker.onerror = () => reject(new Error("SCANNER_WORKER_FAILED"));
        worker.postMessage({ width: next.width, height: next.height, data: next.gray, options: { threshold, minDiameter: 5, maxDiameter: 48, rowAngleTolerance: 5 } });
      });
      worker.terminate();
      setRows(result.rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "도면을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [onComplete, page, sourceFile, threshold]);

  const accept = useCallback(async () => {
    if (!prepared || !rows) return;
    setBusy(true);
    try {
      const upload = await apiUploadReferenceAsset({ file: prepared.file, purpose: "reference" });
      onComplete({ href: upload.url, width: prepared.width, height: prepared.height, rows: acceptScannerRows({ candidates: rows.flatMap((row) => row.candidates), rows }) });
    } catch {
      setError("좌석 도면을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }, [onComplete, prepared, rows]);

  if (rows) return <ScannerReview rows={rows} onBack={() => setRows(null)} onAccept={() => void accept()} />;

  return (
    <section className="space-y-4">
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b8c6d5] bg-[#f8fafc] px-5 text-center hover:border-[#0784fa] hover:bg-[#f3f8ff]">
        {sourceFile ? <FileImage className="mb-2 size-8 text-[#0784fa]" /> : <Upload className="mb-2 size-8 text-[#667085]" />}
        <span className="text-sm font-semibold">{sourceFile?.name ?? "JPG, PNG, WEBP 또는 PDF 도면 선택"}</span>
        <span className="mt-1 text-xs text-[#667085]">최대 10MB · 원본 메타데이터 제거 · PDF 페이지 선택 지원</span>
        <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          const sizeError = file ? referenceAssetSizeError(file.size) : null;
          setError(sizeError ?? "");
          setSourceFile(sizeError ? null : file);
          setRows(null);
        }} />
      </label>
      {sourceFile?.type === "application/pdf" && (
        <label className="flex items-center gap-3 text-sm">PDF 페이지<input className="w-20 rounded-md border border-black/15 px-2 py-1" type="number" min={1} value={page} onChange={(event) => setPage(Number(event.target.value))} /></label>
      )}
      <label className="block text-xs text-[#667085]">자동 인식 임계값 {threshold}<input className="mt-2 w-full" type="range" min={40} max={220} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></label>
      {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={!sourceFile || busy} className="rounded-md border border-black/10 px-4 py-2 text-sm disabled:opacity-40" onClick={() => void prepare(false)}>도면만 불러오기</button>
        <button type="button" disabled={!sourceFile || busy} className="flex items-center gap-2 rounded-md bg-[#0784fa] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => void prepare(true)}><ScanSearch className="size-4" />{busy ? "분석 중…" : "좌석 자동 인식"}</button>
      </div>
    </section>
  );
}
