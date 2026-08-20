import { NextResponse } from "next/server";
import path from "node:path";
import type { ChartDocument } from "@/types/seat-chart";
import { seatChartVenueSchema } from "@/lib/seat-charts/types";
import { listSeatCharts, saveSeatChart } from "@/lib/seat-charts/store";
import { issueServiceCredential, listServiceCredentials, seatChartServiceCredentialRoot, type SeatChartServiceScope, type ServiceCredentialRecord } from "@/lib/seat-charts/service-credentials";
import { ReferenceAssetValidationError, sanitizeReferenceAsset } from "@/lib/seat-designer/reference-assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicCredentialRecord(record: ServiceCredentialRecord) {
  return {
    id: record.id,
    label: record.label,
    prefix: record.prefix,
    suffix: record.suffix,
    scopes: record.scopes,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    ...(record.revokedAt ? { revokedAt: record.revokedAt } : {}),
  };
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("resource") === "service-credentials") {
    const records = await listServiceCredentials(seatChartServiceCredentialRoot);
    return NextResponse.json({ credentials: records.map(publicCredentialRecord) });
  }
  const list = await listSeatCharts();
  return NextResponse.json({ charts: list });
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const purpose = form.get("purpose");
      const pageValue = form.get("page");
      if (!(file instanceof File) || !["reference", "background", "object"].includes(String(purpose))) {
        return NextResponse.json({ error: "INVALID_REFERENCE_ASSET" }, { status: 400 });
      }
      const asset = await sanitizeReferenceAsset({
        bytes: new Uint8Array(await file.arrayBuffer()),
        fileName: file.name,
        declaredMediaType: file.type,
        purpose: String(purpose) as "reference" | "background" | "object",
        page: pageValue === null ? undefined : Number(pageValue),
        storageDir: path.join(process.cwd(), "data", "seat-chart-assets"),
      });
      return NextResponse.json({ asset, url: `/api/seat-charts/assets/${encodeURIComponent(asset.id)}` });
    }
    const body = (await request.json()) as {
      chart?: ChartDocument;
      boundVenue?: unknown;
      operation?: string;
      label?: string;
      scopes?: SeatChartServiceScope[];
      expiresAt?: string;
    };
    if (body.operation === "issue-service-credential") {
      if (!body.label || !body.expiresAt || !body.scopes?.length || body.scopes.some((scope) => scope !== "seat-chart:read" && scope !== "seat-chart:write")) {
        return NextResponse.json({ error: "INVALID_SERVICE_CREDENTIAL" }, { status: 400 });
      }
      const issued = await issueServiceCredential({ rootDir: seatChartServiceCredentialRoot, label: body.label, scopes: body.scopes, expiresAt: body.expiresAt });
      return NextResponse.json({ credential: issued.credential, record: publicCredentialRecord(issued.record) }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (!body.chart?.id || !body.chart?.name) {
      return NextResponse.json({ error: "INVALID_CHART" }, { status: 400 });
    }
    const venueResult = seatChartVenueSchema.nullable().optional().safeParse(body.boundVenue);
    if (!venueResult.success) {
      return NextResponse.json({ error: "INVALID_VENUE" }, { status: 400 });
    }
    const rec = await saveSeatChart({
      chart: body.chart,
      boundVenue: venueResult.data,
    });
    return NextResponse.json({ ok: true, record: rec });
  } catch (e) {
    if (e instanceof ReferenceAssetValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "SAVE_FAILED", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
