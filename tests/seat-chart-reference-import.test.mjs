import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  ReferenceAssetValidationError,
  sanitizeReferenceAsset,
} from "../src/lib/seat-designer/reference-assets.ts";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("a raster reference is sniffed, normalized, stripped, and stored behind an opaque id", async () => {
  const storageDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-reference-"));
  const withTrailingMetadata = Buffer.concat([tinyPng, Buffer.from("EXIF-secret-location")]);
  const asset = await sanitizeReferenceAsset({
    bytes: withTrailingMetadata,
    fileName: "잠실 좌석도.png",
    declaredMediaType: "image/png",
    purpose: "reference",
    storageDir,
  });

  assert.match(asset.id, /^asset_[a-z0-9]{20,}$/);
  assert.equal(asset.mediaType, "image/png");
  assert.equal(asset.width, 1);
  assert.equal(asset.height, 1);
  assert.equal(asset.originalName, "잠실 좌석도.png");
  const stored = await readFile(path.join(storageDir, `${asset.id}.png`));
  assert.equal(stored.includes(Buffer.from("EXIF-secret-location")), false);
  assert.equal("storagePath" in asset, false);
});

test("EXIF-oriented raster metadata reports the dimensions of the sanitized pixels", async () => {
  const storageDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-reference-oriented-"));
  const source = await sharp({ create: { width: 20, height: 40, channels: 3, background: "#ef4444" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const asset = await sanitizeReferenceAsset({
    bytes: source,
    fileName: "세로 도면.jpg",
    declaredMediaType: "image/jpeg",
    purpose: "object",
    storageDir,
  });
  const stored = await readFile(path.join(storageDir, `${asset.id}.png`));
  const metadata = await sharp(stored).metadata();
  assert.equal(asset.width, 40);
  assert.equal(asset.height, 20);
  assert.equal(metadata.width, asset.width);
  assert.equal(metadata.height, asset.height);
});

test("MIME spoofing and oversized uploads fail closed", async () => {
  const storageDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-reference-reject-"));
  await assert.rejects(
    sanitizeReferenceAsset({
      bytes: Buffer.from("<script>alert(1)</script>"),
      fileName: "fake.png",
      declaredMediaType: "image/png",
      purpose: "reference",
      storageDir,
    }),
    ReferenceAssetValidationError,
  );
  await assert.rejects(
    sanitizeReferenceAsset({
      bytes: new Uint8Array(10 * 1024 * 1024 + 1),
      fileName: "huge.jpg",
      declaredMediaType: "image/jpeg",
      purpose: "reference",
      storageDir,
    }),
    /REFERENCE_ASSET_TOO_LARGE/,
  );
});

test("safe SVG plans are rasterized while executable SVG payloads fail closed", async () => {
  const storageDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-reference-svg-"));
  const safe = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#fff"/><circle cx="40" cy="40" r="10"/></svg>');
  const asset = await sanitizeReferenceAsset({
    bytes: safe,
    fileName: "공연장.svg",
    declaredMediaType: "image/svg+xml",
    purpose: "object",
    storageDir,
  });
  assert.equal(asset.mediaType, "image/png");
  assert.equal(asset.width, 120);
  assert.equal(asset.height, 80);

  await assert.rejects(
    sanitizeReferenceAsset({
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      fileName: "unsafe.svg",
      declaredMediaType: "image/svg+xml",
      purpose: "object",
      storageDir,
    }),
    /REFERENCE_ASSET_UNSAFE_SVG/,
  );
});

test("PDF imports require a valid page and expose no embedded payload", async () => {
  const storageDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-reference-pdf-"));
  const pdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 2/Kids[]>>endobj\n%%EOF",
  );
  const asset = await sanitizeReferenceAsset({
    bytes: pdf,
    fileName: "2층 좌석도.pdf",
    declaredMediaType: "application/pdf",
    purpose: "reference",
    page: 2,
    storageDir,
  });
  assert.equal(asset.page, 2);
  assert.equal(asset.pageCount, 2);
  assert.equal("bytes" in asset, false);
  await assert.rejects(
    sanitizeReferenceAsset({
      bytes: pdf,
      fileName: "2층 좌석도.pdf",
      declaredMediaType: "application/pdf",
      purpose: "reference",
      page: 3,
      storageDir,
    }),
    /REFERENCE_ASSET_PAGE_OUT_OF_RANGE/,
  );
});
