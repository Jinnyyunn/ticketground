import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TosspaymentsResultPanel } from "@/components/ticketing/tosspayments-result-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getShowBySlug } from "@/data/catalog-server";
import { queryParam } from "@/lib/search-params";

export default async function CheckoutResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    paymentKey?: string | string[];
    orderId?: string | string[];
    paymentMethod?: string | string[];
    date?: string | string[];
    time?: string | string[];
    message?: string | string[];
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const show = await getShowBySlug(slug);
  if (!show) notFound();

  return (
    <TicketingPageShell>
      <Suspense fallback={<div className="ticketground-container py-10 text-lg font-bold">결제 결과를 확인하는 중입니다.</div>}>
        <TosspaymentsResultPanel
          show={show}
          paymentKey={queryParam(query.paymentKey)}
          orderId={queryParam(query.orderId)}
          paymentMethod={queryParam(query.paymentMethod)}
          date={queryParam(query.date)}
          time={queryParam(query.time)}
          failMessage={queryParam(query.message)}
        />
      </Suspense>
    </TicketingPageShell>
  );
}
