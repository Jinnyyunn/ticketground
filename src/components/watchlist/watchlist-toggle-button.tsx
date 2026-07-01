"use client";

import { cn } from "@/lib/utils";

export function WatchlistToggleButton({
  active,
  label,
  onToggle,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} ${active ? "켜짐" : "꺼짐"}`}
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "inline-flex h-10 min-w-28 items-center justify-center rounded-lg border px-4 text-sm font-black focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink",
      )}
    >
      {active ? "켜짐" : "꺼짐"}
    </button>
  );
}
