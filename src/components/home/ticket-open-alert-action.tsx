"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TicketOpenAlertAction({ label }: { readonly label: string }) {
  return (
    <span data-slot="button" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 h-8 px-3 text-xs")}>
      {label}
    </span>
  );
}
