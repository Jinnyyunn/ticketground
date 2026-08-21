"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { V2ToolIcon } from "./tool-icon";
import { toolSpec, type V2ToolId } from "./tool-catalog";

type ToolGroup = { readonly id: string; readonly tools: readonly V2ToolId[] };
const GROUPS: readonly ToolGroup[] = [
  { id: "select", tools: ["select"] },
  { id: "seatSelect", tools: ["seatSelect"] },
  { id: "brush", tools: ["brush"] },
  { id: "sameType", tools: ["sameType"] },
  { id: "node", tools: ["node"] },
  { id: "focal", tools: ["focal"] },
  { id: "row", tools: ["row", "segmentedRow", "multipleRows", "section"] },
  { id: "table", tools: ["roundTable", "rectangularTable"] },
  { id: "booth", tools: ["booth"] },
  { id: "area", tools: ["rectangularArea", "ellipticArea", "polygonalArea"] },
  { id: "shape", tools: ["rectangle", "ellipse", "polygon"] },
  { id: "line", tools: ["line"] },
  { id: "text", tools: ["text"] },
  { id: "image", tools: ["image"] },
  { id: "icon", tools: ["icon"] },
  { id: "hand", tools: ["hand"] },
] as const;

export function Toolbar({
  active,
  onSelect,
}: {
  readonly active: V2ToolId;
  readonly onSelect: (tool: V2ToolId) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <nav
      className="relative z-20 flex w-[42px] shrink-0 flex-col items-center border-r border-[#ddd] bg-[#fafafa] py-2"
      aria-label="좌석 배치 도구"
    >
      {GROUPS.map((group, index) => {
        const selected = group.tools.includes(active);
        const primary = selected ? active : group.tools[0];
        if (!primary) return null;
        const spec = toolSpec(primary);
        return (
          <div
            key={group.id}
            className={`relative ${index === 6 || index === 11 ? "mt-2 border-t border-[#ddd] pt-2" : ""}`}
          >
            <button
              type="button"
              title={`${spec.label}${spec.shortcut ? ` (${spec.shortcut})` : ""}`}
              data-testid={`seat-designer-v2-tool-${primary}`}
              aria-pressed={selected}
              onClick={() => {
                if (group.tools.length === 1) {
                  onSelect(primary);
                  setOpen(null);
                } else
                  setOpen((current) =>
                    current === group.id ? null : group.id,
                  );
              }}
              className={`relative grid size-9 place-items-center rounded-sm ${selected ? "bg-[#eaf4ff] text-[#087ffa]" : "text-[#444] hover:bg-[#eee]"}`}
            >
              <V2ToolIcon id={primary} />
              {group.tools.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 size-0 border-b-[4px] border-l-[4px] border-b-[#777] border-l-transparent" />
              )}
            </button>
            {open === group.id && group.tools.length > 1 && (
              <div
                className="absolute left-[38px] top-0 z-30 min-w-48 rounded border border-[#ccc] bg-white py-1 shadow-lg"
                data-testid={`seat-designer-v2-flyout-${group.id}`}
              >
                {group.tools.map((tool) => {
                  const item = toolSpec(tool);
                  return (
                    <button
                      key={tool}
                      type="button"
                      data-testid={`seat-designer-v2-tool-${tool}`}
                      className="flex h-10 w-full items-center gap-3 px-3 text-left hover:bg-[#f1f6fb]"
                      onClick={() => {
                        onSelect(tool);
                        setOpen(null);
                      }}
                    >
                      <V2ToolIcon id={tool} />
                      <span className="flex-1">{item.label}</span>
                      {tool === active && (
                        <ChevronRight className="size-4 text-[#087ffa]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
