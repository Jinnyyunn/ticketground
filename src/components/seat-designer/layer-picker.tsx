"use client";

import type { SelectionLayer } from "@/types/seat-chart";
import { ko } from "@/lib/seat-designer/i18n";
import { cn } from "@/lib/utils";

const layers: SelectionLayer[] = ["all", "foreground", "interactive", "background", "surroundings"];

export function LayerPicker({
  value,
  onChange,
  onClose,
}: {
  readonly value: SelectionLayer;
  readonly onChange: (layer: SelectionLayer) => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="absolute left-12 top-3 z-20 w-[225px] rounded-md border border-black/10 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-black/5 px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-[#666]">{ko.selectionLayer}</span>
        <button type="button" className="text-[12px] text-[#999]" onClick={onClose}>
          ✕
        </button>
      </div>
      <ul className="py-1">
        {layers.map((layer) => (
          <li key={layer}>
            <button
              type="button"
              onClick={() => {
                onChange(layer);
                onClose();
              }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-[13px] text-[#333] hover:bg-black/[0.04]",
                value === layer && "bg-[#0784fa]/8 text-[#0784fa]",
              )}
            >
              {ko.layers[layer]}
              {value === layer && <span className="text-[#0784fa]">✓</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
