"use client";

import { useId, useState, type DragEvent } from "react";
import { FileImage, LoaderCircle } from "lucide-react";
import { apiUploadReferenceAsset } from "@/lib/seat-charts/client";
import { uid } from "@/lib/seat-designer/geometry";
import type { SeatEditorApi } from "@/lib/seat-designer/use-editor";
import { cn } from "@/lib/utils";

const acceptedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const maximumBytes = 10 * 1024 * 1024;

function imageSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, 560 / width, 420 / height);
  return { width: Math.max(1, width * scale), height: Math.max(1, height * scale) };
}

export function ImageImportControl({
  api,
  compact = false,
}: {
  readonly api: SeatEditorApi;
  readonly compact?: boolean;
}) {
  const inputId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const importFile = async (file: File) => {
    if (!acceptedTypes.has(file.type)) {
      setError("PNG, JPEG, GIF, WEBP, SVG 파일만 불러올 수 있습니다.");
      return;
    }
    if (file.size > maximumBytes) {
      setError("이미지는 10MB 이하여야 합니다.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const uploaded = await apiUploadReferenceAsset({ file, purpose: "object" });
      const size = imageSize(uploaded.asset.width, uploaded.asset.height);
      const object = {
        id: uid("image"),
        type: "image" as const,
        label: file.name,
        layer: "background" as const,
        floorId: api.state.chart.activeFloorId,
        x: 100,
        y: 80,
        width: size.width,
        height: size.height,
        href: uploaded.url,
        opacity: 1,
      };
      api.dispatch({ type: "ADD_OBJECT", object, asset: uploaded.asset, status: "이미지를 불러왔습니다.", select: true, targetChartId: api.state.chart.id, targetChartGeneration: api.state.chartGeneration });
    } catch {
      setError("이미지를 불러오지 못했습니다. 파일을 확인하고 다시 시도하세요.");
    } finally {
      setPending(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void importFile(file);
  };

  return (
    <div
      className={cn("flex flex-col", compact ? "gap-1" : "items-center gap-3")}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <label
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className={cn(
          "cursor-pointer border border-dashed border-[#a8aaad] bg-white text-[#333] transition hover:border-[#087bea] hover:bg-[#f7fbff]",
          compact
            ? "flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-[13px]"
            : "flex min-h-32 w-80 flex-col items-center justify-center rounded-md px-8 py-6 text-center shadow-sm",
        )}
      >
        {pending ? <LoaderCircle className="size-6 animate-spin text-[#087bea]" /> : <FileImage className="size-7 text-[#087bea]" />}
        <span className={cn("font-medium", !compact && "mt-3 text-[14px]")}>{pending ? "불러오는 중" : "이미지 불러오기"}</span>
        {!compact && <span className="mt-1 text-[12px] text-[#777]">여기에 놓거나 클릭 · PNG/JPEG/GIF/WEBP/SVG · 최대 10MB</span>}
        <input
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          className="sr-only"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {error && <p role="alert" className="max-w-80 text-[12px] leading-5 text-[#c4362e]">{error}</p>}
    </div>
  );
}
