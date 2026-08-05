"use client";

import type { ReactNode } from "react";
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
} from "lucide-react";
import type { ToolId } from "@/types/seat-chart";
import { ko } from "@/lib/seat-designer/i18n";
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
  onTool,
  onOpenLayers,
}: {
  readonly tool: ToolId;
  readonly onTool: (t: ToolId) => void;
  readonly onOpenLayers: () => void;
}) {
  return (
    <div className="flex w-[42px] shrink-0 flex-col items-center gap-0.5 border-r border-black/10 bg-[#f5f5f5] py-1.5">
      {tools.map((t) => (
        <button
          key={t.id}
          type="button"
          title={`${ko.tools[t.id]} (${t.shortcut})`}
          onClick={() => onTool(t.id)}
          className={cn(
            "flex size-9 items-center justify-center rounded-md text-[#333] transition hover:bg-black/5",
            tool === t.id && selectedToolClass,
          )}
        >
          {t.icon}
        </button>
      ))}
      <div className="mt-auto px-1 pb-1">
        <button
          type="button"
          title={ko.selectionLayer}
          onClick={onOpenLayers}
          className="flex size-9 items-center justify-center rounded-md text-[#666] hover:bg-black/5"
        >
          <Layers className="size-4" />
        </button>
      </div>
    </div>
  );
}
