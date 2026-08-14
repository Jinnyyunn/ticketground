"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { addToMyWatchlist, getMyWatchlist, removeFromMyWatchlist, storedSessionCredential, TicketgroundApiError } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

export function WatchlistAddButton({ className, eventId, title }: { readonly className?: string; readonly eventId: string; readonly title: string }) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const credential = storedSessionCredential();
    setLoggedIn(Boolean(credential));
    if (!credential) {
      setReady(true);
      return;
    }
    let mounted = true;
    getMyWatchlist()
      .then((items) => {
        if (mounted) setActive(items.some((item) => item.eventId === eventId));
      })
      .catch(() => {
        // A failed initial fetch leaves the button in "not added" state -
        // clicking it will still work and simply report its own error.
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [eventId]);

  const toggle = async (): Promise<void> => {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setPending(true);
    try {
      if (active) {
        await removeFromMyWatchlist(eventId);
        setActive(false);
      } else {
        await addToMyWatchlist(eventId);
        setActive(true);
      }
    } catch (error) {
      if (error instanceof TicketgroundApiError && error.code === "LOGIN_REQUIRED") {
        router.push("/login");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      aria-label={`${title} ${active ? "관심공연에서 제거" : "관심공연으로 등록"}`}
      aria-pressed={active}
      disabled={!ready || pending}
      onClick={() => void toggle()}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
        active ? "border-ticketground bg-ticketground text-white" : "border-line-strong bg-card text-ink hover:border-ink",
        className,
      )}
    >
      <Heart aria-hidden className={cn("size-4", active && "fill-current")} />
      {active ? "찜 완료" : "찜하기"}
    </button>
  );
}
