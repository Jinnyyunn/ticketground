"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type SiteSearchBarProps = {
  readonly className?: string;
  readonly keyboardReachable?: boolean;
};

export function SiteSearchBar({ className, keyboardReachable = true }: SiteSearchBarProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const clearRestoredQuery = () => {
      setQuery("");
    };

    window.addEventListener("pageshow", clearRestoredQuery);
    return () => window.removeEventListener("pageshow", clearRestoredQuery);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedQuery = query.trim();
    setQuery("");
    router.push(submittedQuery ? `/contents/search?q=${encodeURIComponent(submittedQuery)}` : "/contents/search");
  };

  return (
    <form
      aria-hidden={keyboardReachable ? undefined : true}
      action="/contents/search"
      onSubmit={handleSubmit}
      role="search"
      suppressHydrationWarning
      className={cn(
        "flex h-10 min-w-0 items-center gap-2 rounded-full border-2 border-ink bg-card pl-5 pr-3",
        "transition-colors focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      <input
        aria-label="공연명, 아티스트, 공연장 검색"
        className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none placeholder:text-ink-3"
        name="q"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="공연명, 아티스트, 공연장 검색"
        tabIndex={keyboardReachable ? undefined : -1}
        type="search"
        value={query}
        suppressHydrationWarning
      />
      <button
        aria-label="검색"
        className="grid size-8 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
        tabIndex={keyboardReachable ? undefined : -1}
        type="submit"
        suppressHydrationWarning
      >
        <SearchIcon className="size-5" />
      </button>
    </form>
  );
}
