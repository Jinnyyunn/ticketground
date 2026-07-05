"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function PillTabs({ tabs, className }: { tabs: string[]; className?: string }) {
  const [active, setActive] = useState(0);
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", className)}>
      {tabs.map((t, i) => (
        <button
          key={t}
          onClick={() => setActive(i)}
          className={cn(
            "h-[42px] rounded-full px-5 text-base font-medium transition-colors",
            i === active
              ? "bg-ink text-on-ink"
              : "border border-line bg-card text-ink-2 hover:border-line-strong",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
