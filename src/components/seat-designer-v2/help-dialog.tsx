"use client";

import { X } from "lucide-react";
import { V2_TOOLS } from "./tool-catalog";

type HelpDialogProps = {
  readonly onClose: () => void;
};

const SHORTCUTS = [
  ["⌘/Ctrl + Z", "실행 취소"],
  ["⌘/Ctrl + Shift + Z", "다시 실행"],
  ["⌘/Ctrl + C / V", "복사 / 붙여넣기"],
  ["Delete", "선택 삭제"],
  ["Shift", "행 각도 15° 고정"],
  ["Alt", "스냅과 노드 추가 핸들 잠시 끄기"],
  ["Enter", "구간 행·다각형 완성"],
  ["Escape", "현재 작업 취소"],
] as const;

export function HelpDialog({ onClose }: HelpDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
      data-testid="seat-designer-v2-help-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="좌석 디자이너 도움말"
    >
      <section className="flex max-h-[86dvh] w-full max-w-[920px] flex-col overflow-hidden rounded border border-[#cfcfcf] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#ddd] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">도구와 단축키</h2>
            <p className="mt-1 text-sm text-[#666]">
              각 도구를 선택하면 하단에도 현재 제스처가 표시됩니다.
            </p>
          </div>
          <button
            type="button"
            title="도움말 닫기"
            className="grid size-9 place-items-center rounded hover:bg-[#eee]"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-[1.35fr_1fr]">
          <section>
            <h3 className="mb-3 font-semibold">도구</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {V2_TOOLS.map((tool) => (
                <article key={tool.id} className="rounded border border-[#ddd] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{tool.label}</strong>
                    {tool.shortcut && (
                      <kbd className="rounded bg-[#eee] px-2 py-1 text-[11px]">
                        {tool.shortcut}
                      </kbd>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#666]">
                    {tool.help.join(" · ")}
                  </p>
                </article>
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">공통 단축키</h3>
            <dl className="divide-y divide-[#e5e5e5] rounded border border-[#ddd]">
              {SHORTCUTS.map(([keys, description]) => (
                <div key={keys} className="grid grid-cols-[9rem_1fr] gap-3 px-3 py-3">
                  <dt><kbd className="rounded bg-[#eee] px-2 py-1 text-xs">{keys}</kbd></dt>
                  <dd className="text-sm text-[#555]">{description}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 rounded border border-[#b9dafb] bg-[#eef6ff] p-3 text-sm leading-6 text-[#315f8c]">
              여러 행은 먼저 기준 행을 드래그한 뒤, 두 번째 드래그로 행 수와 방향을
              정합니다. 구간 행은 마지막 좌석을 다시 클릭하거나 Enter로 완성합니다.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
