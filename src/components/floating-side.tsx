import Link from "next/link";

export function FloatingSide() {
  return (
    <Link
      href="/inquiry"
      aria-label="1:1 문의"
      className="fixed bottom-6 left-6 z-30 hidden rounded-lg border border-line bg-white px-3 py-3 text-[13px] font-black text-ink shadow-ticket-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 lg:grid"
    >
      1:1 문의
    </Link>
  );
}
