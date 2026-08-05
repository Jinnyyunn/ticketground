import { z } from "zod";

const catalogResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    events: z.array(z.object({
      id: z.string(),
      slug: z.string().optional(),
      title: z.string(),
      shortTitle: z.string().optional(),
      venue: z.string(),
    })),
  }),
});

export interface BindableShow {
  readonly slug: string;
  readonly label: string;
  readonly venue: string;
}

/** All Ticketground shows available for chart binding. */
export async function listBindableShows(): Promise<readonly BindableShow[]> {
  const response = await fetch("/api/catalog", { credentials: "include" });
  if (!response.ok) throw new Error("공연 목록을 불러오지 못했습니다.");
  const payload = catalogResponseSchema.parse(await response.json());
  return payload.data.events.flatMap((show) => {
    const slug = show.slug ?? show.id;
    return slug ? [{ slug, label: show.shortTitle || show.title, venue: show.venue }] : [];
  });
}
