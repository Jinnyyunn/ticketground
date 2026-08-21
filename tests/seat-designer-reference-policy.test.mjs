import assert from "node:assert/strict";
import test from "node:test";
import { REFERENCE_ASSET_MAX_BYTES, referenceAssetSizeError } from "../src/lib/seat-designer/reference-asset-policy.ts";

test("reference imports reject files above the shared ten-megabyte boundary", () => {
  assert.equal(REFERENCE_ASSET_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(referenceAssetSizeError(REFERENCE_ASSET_MAX_BYTES), null);
  assert.equal(referenceAssetSizeError(REFERENCE_ASSET_MAX_BYTES + 1), "도면 파일은 최대 10MB까지 불러올 수 있습니다.");
});
