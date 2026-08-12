import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  readonly className?: string;
  readonly priority?: boolean;
};

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <span aria-label="Ticketground" className="inline-flex" role="img">
      <Image
        alt=""
        aria-hidden="true"
        className={cn("h-7 w-auto object-contain dark:hidden", className)}
        height={179}
        priority={priority}
        sizes="(min-width: 768px) 180px, 156px"
        src="/images/brand/ticketground-logo.png"
        width={1015}
      />
      <Image
        alt=""
        aria-hidden="true"
        className={cn("hidden h-7 w-auto object-contain dark:block", className)}
        height={179}
        priority={priority}
        sizes="(min-width: 768px) 180px, 156px"
        src="/images/brand/ticketground-logo-dark.png"
        width={1015}
      />
    </span>
  );
}
