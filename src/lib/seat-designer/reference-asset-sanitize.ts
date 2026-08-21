import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { REFERENCE_ASSET_MAX_BYTES } from "./reference-asset-policy.ts";

const MAX_PIXELS = 100_000_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_SIGNATURE = Buffer.from("RIFF");
const GIF87_SIGNATURE = Buffer.from("GIF87a");
const GIF89_SIGNATURE = Buffer.from("GIF89a");
const PDF_SIGNATURE = Buffer.from("%PDF-");

export type StoredReferenceAsset = {
  readonly id: `asset_${string}`;
  readonly kind: "reference" | "background" | "object";
  readonly mediaType: "image/png" | "application/pdf";
  readonly width: number;
  readonly height: number;
  readonly page?: number;
  readonly pageCount?: number;
  readonly contentHash: string;
  readonly originalName: string;
};

export class ReferenceAssetValidationError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "ReferenceAssetValidationError";
  }
}

function sniffMediaType(bytes: Buffer): "raster" | "svg" | "pdf" | null {
  if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return "raster";
  if (bytes.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return "raster";
  if (bytes.subarray(0, WEBP_SIGNATURE.length).equals(WEBP_SIGNATURE) && bytes.subarray(8, 12).toString() === "WEBP") return "raster";
  if (bytes.subarray(0, GIF87_SIGNATURE.length).equals(GIF87_SIGNATURE)) return "raster";
  if (bytes.subarray(0, GIF89_SIGNATURE.length).equals(GIF89_SIGNATURE)) return "raster";
  if (bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) return "pdf";
  if (/^(?:\uFEFF|\s)*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(bytes.subarray(0, 4096).toString("utf8"))) return "svg";
  return null;
}

function assertSafeSvg(bytes: Buffer): void {
  const source = bytes.toString("utf8");
  if (
    /<\s*(?:script|foreignObject|iframe|object|embed)\b/i.test(source) ||
    /\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:|\/\/)/i.test(source) ||
    /\burl\s*\(/i.test(source) ||
    /<!DOCTYPE|<!ENTITY/i.test(source) ||
    /\bon\w+\s*=/i.test(source)
  ) {
    throw new ReferenceAssetValidationError("REFERENCE_ASSET_UNSAFE_SVG");
  }
}

function pdfDetails(bytes: Buffer): { pageCount: number; width: number; height: number } {
  const source = bytes.toString("latin1");
  if (/\/(JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile)\b/.test(source)) {
    throw new ReferenceAssetValidationError("REFERENCE_ASSET_UNSAFE_PDF");
  }
  const counts = [...source.matchAll(/\/Count\s+(\d+)/g)].map((match) => Number(match[1]));
  const pageCount = Math.max(1, ...counts.filter(Number.isFinite));
  const mediaBox = source.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/);
  return {
    pageCount,
    width: mediaBox ? Math.max(1, Math.round(Number(mediaBox[3]) - Number(mediaBox[1]))) : 612,
    height: mediaBox ? Math.max(1, Math.round(Number(mediaBox[4]) - Number(mediaBox[2]))) : 792,
  };
}

export async function prepareReferenceAsset(input: {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly declaredMediaType: string;
  readonly purpose: StoredReferenceAsset["kind"];
  readonly page?: number;
}): Promise<{ readonly asset: StoredReferenceAsset; readonly storedBytes: Buffer; readonly extension: "png" | "pdf" }> {
  if (input.bytes.byteLength > REFERENCE_ASSET_MAX_BYTES) throw new ReferenceAssetValidationError("REFERENCE_ASSET_TOO_LARGE");
  const source = Buffer.from(input.bytes);
  const detected = sniffMediaType(source);
  const declaredMatches = detected === "pdf"
    ? input.declaredMediaType === "application/pdf"
    : detected === "svg"
      ? input.declaredMediaType === "image/svg+xml"
      : detected === "raster" && input.declaredMediaType.startsWith("image/");
  if (!detected || !declaredMatches) throw new ReferenceAssetValidationError("REFERENCE_ASSET_TYPE_MISMATCH");

  const id = `asset_${randomUUID().replaceAll("-", "")}` as const;
  if (detected === "pdf") {
    const details = pdfDetails(source);
    const page = input.page ?? 1;
    if (!Number.isInteger(page) || page < 1 || page > details.pageCount) {
      throw new ReferenceAssetValidationError("REFERENCE_ASSET_PAGE_OUT_OF_RANGE");
    }
    return {
      asset: {
        id,
        kind: input.purpose,
        mediaType: "application/pdf",
        width: details.width,
        height: details.height,
        page,
        pageCount: details.pageCount,
        contentHash: createHash("sha256").update(source).digest("hex"),
        originalName: path.basename(input.fileName),
      },
      storedBytes: source,
      extension: "pdf",
    };
  }

  if (detected === "svg") assertSafeSvg(source);

  const image = sharp(source, { failOn: "warning", limitInputPixels: MAX_PIXELS });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
    throw new ReferenceAssetValidationError("REFERENCE_ASSET_INVALID_DIMENSIONS");
  }
  const sanitized = await image.rotate().png({ compressionLevel: 9, palette: false }).toBuffer();
  const sanitizedMetadata = await sharp(sanitized).metadata();
  if (!sanitizedMetadata.width || !sanitizedMetadata.height) {
    throw new ReferenceAssetValidationError("REFERENCE_ASSET_INVALID_DIMENSIONS");
  }
  return {
    asset: {
      id,
      kind: input.purpose,
      mediaType: "image/png",
      width: sanitizedMetadata.width,
      height: sanitizedMetadata.height,
      contentHash: createHash("sha256").update(sanitized).digest("hex"),
      originalName: path.basename(input.fileName),
    },
    storedBytes: sanitized,
    extension: "png",
  };
}
