import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  children,
  eyebrow,
  description,
  action,
  align = "center",
  className,
}: {
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly align?: "left" | "center";
  readonly className?: string;
}) {
  return (
    <div className={cn("section-head", align === "center" ? "text-center" : "text-left", className)}>
      {eyebrow && <small className="text-sm font-bold text-ticketground">{eyebrow}</small>}
      <div className={cn("flex items-end gap-4", align === "center" ? "justify-center" : "justify-between")}>
        <h2 className="text-4xl font-bold leading-tight text-ink">{children}</h2>
        {action}
      </div>
      {description && <p className={cn("mt-2 text-sm text-ink-3", align === "center" && "mx-auto max-w-[640px]")}>{description}</p>}
    </div>
  );
}
