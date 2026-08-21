import type { ChartDocument } from "@/types/seat-chart";
import type { SeatChartRecord, SeatChartSummary, SeatChartVenue } from "./types";
import type { InventoryResult } from "./inventory";
import { z } from "zod";

export type ServiceCredentialSummary = {
  readonly id: string;
  readonly label: string;
  readonly prefix: string;
  readonly suffix: string;
  readonly scopes: readonly ("seat-chart:read" | "seat-chart:write")[];
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt?: string;
};

const adminSessionSchema = z.object({
  ok: z.literal(true),
  data: z.object({ csrf: z.string().min(1) }),
});

async function adminMutationHeaders(): Promise<Record<string, string>> {
  const response = await fetch("/api/admin/session", { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error("ADMIN_SESSION_REQUIRED");
  const session = adminSessionSchema.parse(await response.json());
  return { "Content-Type": "application/json", "x-tig-csrf": session.data.csrf };
}

export async function apiUploadReferenceAsset(input: {
  readonly file: File;
  readonly purpose: "reference" | "background" | "object";
  readonly page?: number;
}): Promise<{
  readonly asset: { readonly id: string; readonly width: number; readonly height: number };
  readonly url: string;
}> {
  const form = new FormData();
  form.set("file", input.file);
  form.set("purpose", input.purpose);
  if (input.page !== undefined) form.set("page", String(input.page));
  const headers = await adminMutationHeaders();
  delete headers["Content-Type"];
  const response = await fetch("/api/seat-charts", {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  if (!response.ok) throw new Error("REFERENCE_ASSET_UPLOAD_FAILED");
  return response.json();
}

export async function apiListCharts(): Promise<SeatChartSummary[]> {
  const res = await fetch("/api/seat-charts", { cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error("LIST_FAILED");
  const data = (await res.json()) as { charts: SeatChartSummary[] };
  return data.charts;
}

export async function apiGetChart(id: string): Promise<SeatChartRecord> {
  const res = await fetch(`/api/seat-charts/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error("GET_FAILED");
  const data = (await res.json()) as { record: SeatChartRecord };
  return data.record;
}

export async function apiDeleteChart(id: string): Promise<void> {
  const res = await fetch(`/api/seat-charts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: await adminMutationHeaders(),
  });
  if (!res.ok) throw new Error("DELETE_FAILED");
}

export async function apiSaveChart(
  chart: ChartDocument,
  boundVenue?: SeatChartVenue | null,
): Promise<SeatChartRecord> {
  const res = await fetch("/api/seat-charts", {
    method: "POST",
    credentials: "include",
    headers: await adminMutationHeaders(),
    body: JSON.stringify({ chart, boundVenue }),
  });
  if (!res.ok) throw new Error("SAVE_FAILED");
  const data = (await res.json()) as { record: SeatChartRecord };
  return data.record;
}

export async function apiPublishChart(
  id: string,
  publish: boolean,
  boundVenue?: SeatChartVenue | null,
): Promise<SeatChartRecord> {
  const res = await fetch(`/api/seat-charts/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    credentials: "include",
    headers: await adminMutationHeaders(),
    body: JSON.stringify({ publish, boundVenue }),
  });
  if (!res.ok) throw new Error("PUBLISH_FAILED");
  const data = (await res.json()) as { record: SeatChartRecord };
  return data.record;
}

export async function apiChartForShow(slug: string, prices?: {
  vip?: number;
  r?: number;
  s?: number;
  a?: number;
}): Promise<{
  source: "published" | "not_ready";
  message?: string;
  chart: ChartDocument | null;
  inventory: InventoryResult | null;
  record: { id: string; name: string; boundVenue: SeatChartVenue } | null;
}> {
  const q = new URLSearchParams();
  if (prices?.vip) q.set("vip", String(prices.vip));
  if (prices?.r) q.set("r", String(prices.r));
  if (prices?.s) q.set("s", String(prices.s));
  if (prices?.a) q.set("a", String(prices.a));
  const res = await fetch(`/api/seat-charts/for-show/${encodeURIComponent(slug)}?${q}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("FETCH_FAILED");
  return res.json();
}

export async function apiListSeatChartCredentials(): Promise<readonly ServiceCredentialSummary[]> {
  const response = await fetch("/api/seat-charts?resource=service-credentials", { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error("SERVICE_CREDENTIAL_LIST_FAILED");
  return ((await response.json()) as { credentials: ServiceCredentialSummary[] }).credentials;
}

export async function apiIssueSeatChartCredential(label: string): Promise<{ readonly credential: string; readonly record: ServiceCredentialSummary }> {
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const response = await fetch("/api/seat-charts", {
    method: "POST",
    credentials: "include",
    headers: await adminMutationHeaders(),
    body: JSON.stringify({ operation: "issue-service-credential", label, scopes: ["seat-chart:read"], expiresAt }),
  });
  if (!response.ok) throw new Error("SERVICE_CREDENTIAL_ISSUE_FAILED");
  return response.json();
}

export async function apiRevokeSeatChartCredential(id: string): Promise<void> {
  const response = await fetch(`/api/seat-charts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: await adminMutationHeaders(),
  });
  if (!response.ok) throw new Error("SERVICE_CREDENTIAL_REVOKE_FAILED");
}
