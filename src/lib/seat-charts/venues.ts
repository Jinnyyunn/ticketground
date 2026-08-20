import { z } from "zod";
import type { SeatChartVenue } from "./types";

const catalogResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    venues: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })),
  }),
});

export async function listBindableVenues(): Promise<readonly SeatChartVenue[]> {
  const response = await fetch("/api/admin/venues", { credentials: "include" });
  if (!response.ok) throw new Error("공연장 목록을 불러오지 못했습니다.");
  const payload = catalogResponseSchema.parse(await response.json());
  return payload.data.venues.toSorted((left, right) => left.name.localeCompare(right.name, "ko"));
}
