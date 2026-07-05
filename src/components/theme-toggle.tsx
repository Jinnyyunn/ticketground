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
  const Icon = darkEnabled ? Sun : Moon;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={darkEnabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full border border-line bg-card text-ink-2 transition-colors",
        "hover:border-line-strong hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      onClick={() => setTheme(darkEnabled ? "light" : "dark")}
      data-theme-toggle
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
