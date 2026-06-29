import Link from "next/link";

export function FloatingSide() {
  return (
    <Link
      href="/inquiry"
      aria-label="1:1 문의"
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 rounded-lg border border-line bg-white px-3 py-3 text-[13px] font-black text-ink shadow-ticket-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 lg:grid"
    >
      1:1 문의
    </Link>
  );
}
