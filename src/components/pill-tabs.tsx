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
            "h-[42px] rounded-full px-5 text-[15px] font-medium transition-colors",
            i === active
              ? "bg-[#1a1a1a] text-white"
              : "border border-[#e5e5e5] bg-white text-[#41414a] hover:border-[#bdbdbd]",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
