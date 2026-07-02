import Link from "next/link";
import { Home } from "lucide-react";

export function LoginHomeLink() {
  return (
    <Link
      href="/"
      aria-label="메인 홈으로 이동"
      className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-line bg-white px-3 text-sm font-black text-ink transition hover:border-line-strong hover:bg-surface focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <Home className="size-4" aria-hidden="true" />
      <span>홈</span>
    </Link>
  );
}
