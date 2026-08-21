"use client";

import { useState, type ReactNode } from "react";
import {
  Box,
  Circle,
  Crosshair,
  Hand,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Paintbrush,
  Pentagon,
  Shapes,
  Square,
  Star,
  Type,
  Waypoints,
  ChevronRight,
} from "lucide-react";
import type { ToolId, ToolMode } from "@/types/seat-chart";
import { ko } from "@/lib/seat-designer/i18n";
import { toolGroupFor } from "@/lib/seat-designer/tool-catalog";
import { cn } from "@/lib/utils";

const selectedToolClass = "text-[#0784fa] ring-1 ring-[#0784fa]";

const tools: { id: ToolId; shortcut: string; icon: ReactNode }[] = [
  { id: "select", shortcut: "V", icon: <MousePointer2 className="size-4" /> },
  { id: "selectSeats", shortcut: "X", icon: <Crosshair className="size-4" /> },
  { id: "brush", shortcut: "C", icon: <Paintbrush className="size-4" /> },
  { id: "selectSame", shortcut: "Z", icon: <Layers className="size-4" /> },
  { id: "node", shortcut: "A", icon: <Waypoints className="size-4" /> },
  { id: "focal", shortcut: "F", icon: <Circle className="size-4" /> },
  { id: "row", shortcut: "R", icon: <span className="text-[11px] font-bold">=</span> },
  { id: "section", shortcut: "S", icon: <Pentagon className="size-4" /> },
  { id: "table", shortcut: "E", icon: <Circle className="size-3.5" /> },
  { id: "booth", shortcut: "B", icon: <Box className="size-4" /> },
  { id: "area", shortcut: "G", icon: <Shapes className="size-4" /> },
  { id: "rectangle", shortcut: "H", icon: <Square className="size-4" /> },
  { id: "line", shortcut: "L", icon: <span className="text-sm">/</span> },
  { id: "text", shortcut: "T", icon: <Type className="size-4" /> },
  { id: "image", shortcut: "I", icon: <ImageIcon className="size-4" /> },
  { id: "icon", shortcut: "O", icon: <Star className="size-4" /> },
  { id: "hand", shortcut: "SPACE", icon: <Hand className="size-4" /> },
];

export function ToolPicker({
  tool,
  mode,
  onTool,
  onMode,
  onOpenLayers,
}: {
  readonly tool: ToolId;
  readonly mode: ToolMode;
  readonly onTool: (t: ToolId) => void;
  readonly onMode: (mode: ToolMode) => void;
  readonly onOpenLayers: () => void;
}) {
  const [openTool, setOpenTool] = useState<ToolId | null>(null);

  return (
    <div className="seat-designer-tool-rail flex w-[41px] shrink-0 flex-col items-center gap-0.5 border-r py-[3px]">
      {tools.map((t) => {
        const group = toolGroupFor(t.id);
        return (
          <div key={t.id} className="relative">
            <button
              type="button"
              data-testid={`tool-${t.id}`}
              data-mode={tool === t.id ? mode : undefined}
              aria-pressed={tool === t.id}
              aria-haspopup={group ? "menu" : undefined}
              aria-expanded={group ? openTool === t.id : undefined}
              title={`${ko.tools[t.id]} (${t.shortcut})`}
              onClick={() => {
                if (group) {
                  onTool(t.id);
                  setOpenTool((current) => current === t.id ? null : t.id);
                  return;
                }
                setOpenTool(null);
                onTool(t.id);
              }}
              className={cn(
                "seat-designer-control flex size-[35px] items-center justify-center",
                tool === t.id && selectedToolClass,
              )}
            >
              {t.icon}
              {group && <ChevronRight className="absolute bottom-0.5 right-0.5 size-2.5 text-[#777]" />}
            </button>
            {group && openTool === t.id && (
              <div
                role="menu"
                aria-label={group.label}
                className="absolute left-[39px] top-0 z-40 min-w-52 rounded-md border border-black/15 bg-white p-1 shadow-xl"
              >
                {group.choices.map((choice) => (
                  <button
                    key={choice.mode}
                    type="button"
                    role="menuitem"
                    data-mode={choice.mode}
                    onClick={() => {
                      onMode(choice.mode);
                      setOpenTool(null);
                    }}
                    className={cn(
                      "block w-full rounded px-3 py-2 text-left text-[13px] hover:bg-[#eef5ff]",
                      mode === choice.mode && "bg-[#e5f1ff] text-[#087bea]",
                    )}
                  >
                    <span className="block font-medium">{choice.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-[#737373]">{choice.help}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-auto px-1 pb-1">
        <button
          type="button"
          title={ko.selectionLayer}
          onClick={onOpenLayers}
          className="flex size-[35px] items-center justify-center rounded-md text-[#666] hover:bg-black/5"
        >
          <Layers className="size-4" />
        </button>
      </div>
    </div>
  );
}
