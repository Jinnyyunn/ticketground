import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "@/components/icons";

export function MoreButton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-center", className)}>
      <a
        href="#"
        className="flex h-[52px] items-center gap-1 rounded-full border border-line px-7 text-lg font-bold text-ink-2 transition-colors hover:border-line-strong"
      >
        {children}
        <ChevronRightIcon className="size-4" />
      </a>
    </div>
  );
}
