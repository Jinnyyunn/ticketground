import type { TicketShow } from "@/types";

// Hybrid ranking: admin-pinned shows (pinnedRank 1-10, set from the admin
// console) claim their exact slot; every other slot is filled by real
// booking demand (soldCount, tickets actually purchased), highest first.
// A pinnedRank collision (two shows pinned to the same slot) is resolved
// first-come-first-placed; the loser falls back into the auto-ranked pool.
export function rankShows(shows: readonly TicketShow[], slots = 10): TicketShow[] {
  const bySlot: (TicketShow | undefined)[] = new Array(slots).fill(undefined);
  const claimedSlugs = new Set<string>();

  for (const show of shows) {
    if (show.pinnedRank === null || show.pinnedRank < 1 || show.pinnedRank > slots) continue;
    const index = show.pinnedRank - 1;
    if (bySlot[index]) continue;
    bySlot[index] = show;
    claimedSlugs.add(show.slug);
  }

  const autoSorted = shows.filter((show) => !claimedSlugs.has(show.slug)).sort((a, b) => b.soldCount - a.soldCount);

  let autoIndex = 0;
  for (let index = 0; index < slots; index += 1) {
    if (bySlot[index]) continue;
    bySlot[index] = autoSorted[autoIndex];
    autoIndex += 1;
  }

  return bySlot.filter((show): show is TicketShow => Boolean(show));
}
