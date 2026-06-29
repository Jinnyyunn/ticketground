import { cn } from "@/lib/utils";
import { ChevronRightIcon } from "@/components/icons";

export function MoreButton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-center", className)}>
      <a
        href="#"
        className="flex h-[52px] items-center gap-1 rounded-full border border-[#e0e0e0] px-7 text-[16px] font-bold text-[#29292d] transition-colors hover:border-[#bdbdbd]"
      >
        {children}
        <ChevronRightIcon className="size-4" />
      </a>
    </div>
  );
}
