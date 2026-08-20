import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readAsset(assetId: string): Promise<{ readonly bytes: Buffer; readonly mediaType: "image/png" | "application/pdf" } | null> {
  if (!/^asset_[a-z0-9]{20,}$/.test(assetId)) return null;
  const candidates = [
    { extension: "png", mediaType: "image/png" },
    { extension: "pdf", mediaType: "application/pdf" },
  ] as const;
  for (const candidate of candidates) {
    try {
      const bytes = await readFile(path.join(process.cwd(), "data", "seat-chart-assets", `${assetId}.${candidate.extension}`));
      return { bytes, mediaType: candidate.mediaType };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly assetId: string }> },
) {
  const { assetId } = await context.params;
  const stored = await readAsset(assetId);
  if (!stored) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return new NextResponse(new Uint8Array(stored.bytes), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Type": stored.mediaType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
