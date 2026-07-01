import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingSide } from "@/components/floating-side";

type TicketingPageShellProps = {
  readonly children: React.ReactNode;
  readonly showHeaderSearchBar?: boolean;
};

export function TicketingPageShell({ children, showHeaderSearchBar = true }: TicketingPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <SiteHeader showSearchBar={showHeaderSearchBar} />
      <main id="content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <FloatingSide />
    </div>
  );
}
