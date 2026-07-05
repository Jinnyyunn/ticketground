"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";

type ThemeToggleProps = {
  readonly className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const darkEnabled = resolvedTheme === "dark";
  const label = darkEnabled ? "라이트 모드 켜기" : "다크 모드 켜기";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={darkEnabled}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-grid h-7 w-14 shrink-0 grid-cols-2 items-center rounded-full border border-line bg-surface p-0.5 text-ink-3 transition-colors",
        "hover:border-line-strong hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      onClick={() => setTheme(darkEnabled ? "light" : "dark")}
      data-theme-toggle
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-6 rounded-full bg-card shadow-ticket-1 transition-transform",
          darkEnabled && "translate-x-7",
        )}
        aria-hidden
      />
      <span className={cn("relative z-10 grid place-items-center", !darkEnabled && "text-ticketground")} aria-hidden>
        <Sun className="size-3.5" />
      </span>
      <span className={cn("relative z-10 grid place-items-center", darkEnabled && "text-ticketground")} aria-hidden>
        <Moon className="size-3.5" />
      </span>
    </button>
  );
}
