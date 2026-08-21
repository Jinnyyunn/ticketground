export function createTosspaymentsOrderId(ticketIds: readonly string[], requestId = crypto.randomUUID()): string {
  if (ticketIds.length === 1) return ticketIds[0];
  return `order_${requestId.replaceAll("-", "").slice(0, 58)}`;
}
