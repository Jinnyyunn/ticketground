import {
  consumeServiceCredentialRateLimit,
  seatChartServiceCredentialRoot,
  verifyServiceCredential,
  type SeatChartServiceScope,
  type ServiceCredentialRecord,
} from "./service-credentials.ts";

export type ServiceAuthorization =
  | { readonly ok: true; readonly record: ServiceCredentialRecord }
  | { readonly ok: false; readonly status: 401 | 429 };

export async function authorizeSeatChartService(request: Request, scope: SeatChartServiceScope): Promise<ServiceAuthorization> {
  const url = new URL(request.url);
  const record = await verifyServiceCredential({
    rootDir: seatChartServiceCredentialRoot,
    authorization: request.headers.get("authorization"),
    queryCredential: url.searchParams.get("key") ?? url.searchParams.get("apiKey"),
    scope,
  });
  if (!record) return { ok: false, status: 401 };
  if (!consumeServiceCredentialRateLimit(record.id)) return { ok: false, status: 429 };
  return { ok: true, record };
}
