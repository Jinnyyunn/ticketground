import { InquiryThreadSurface } from "@/components/support/inquiry-thread-surface";
import type { InquiryThread, Reservation, TicketShow } from "@/types";

type InquiryFormProps = {
  readonly threads: readonly InquiryThread[];
  readonly reservations: readonly Reservation[];
  readonly shows: readonly TicketShow[];
};

export function InquiryForm({ threads, reservations, shows }: InquiryFormProps) {
  return (
    <InquiryThreadSurface threads={threads} reservations={reservations} shows={shows} />
  );
}
