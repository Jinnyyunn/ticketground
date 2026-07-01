import { notFound } from "next/navigation";
import { QueueWaitingRoom } from "@/components/ticketing/queue-waiting-room";
import { getShow, ticketShows } from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";

export function generateStaticParams() {
  return ticketShows.map((show) => ({ slug: show.slug }));
}

export default async function QueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string | string[]; time?: string | string[]; testMode?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const show = getShow(slug);
  if (!show) notFound();

  const fallbackSchedule = show.schedules[0];
  const fallbackDate = fallbackSchedule?.date ?? "2026.07.10";
  const fallbackTime = fallbackSchedule?.times[0] ?? "19:30";
  const requestedDate = queryParam(query.date);
  const requestedTime = queryParam(query.time);
  const requestedSchedule = show.schedules.find((schedule) => schedule.date === requestedDate);
  const hasRequestedSchedule = requestedSchedule?.times.includes(requestedTime) ?? false;
  const date = hasRequestedSchedule ? requestedDate : fallbackDate;
  const time = hasRequestedSchedule ? requestedTime : fallbackTime;
  const testMode = queryParam(query.testMode) === "fast" ? "fast" : "normal";
  const bookingHref = `/booking/${show.slug}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`;

  return (
    <QueueWaitingRoom
      title={show.title}
      venue={show.venue}
      date={date}
      time={time}
      bookingHref={bookingHref}
      testMode={testMode}
    />
  );
}
