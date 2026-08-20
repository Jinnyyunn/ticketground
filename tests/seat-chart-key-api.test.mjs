import assert from "node:assert/strict";
import test from "node:test";

import { publicSeatChartRevision, seatChartEtag } from "../src/lib/seat-charts/public-revision.ts";

test("public revisions expose immutable geometry without admin metadata", () => {
  const revision = {
    chartKey: "chart_abc",
    revisionId: "rev_def",
    venueId: "venue-main",
    publishedAt: "2026-08-21T00:00:00.000Z",
    publishedBy: "admin-secret",
    contentHash: "deadbeef",
    document: {
      version: 2,
      chartKey: "chart_abc",
      venueId: "venue-main",
      venueName: "메인 공연장",
      draftRevision: 8,
      id: "chart_abc",
      name: "메인 좌석도",
      venueType: "simple",
      activeFloorId: "floor-1",
      floors: [], zones: [], categories: [], objects: [],
      assets: [{ id: "asset_abc", kind: "reference", mimeType: "image/png", width: 1, height: 1, originalName: "secret-plan.png" }],
    },
  };

  const result = publicSeatChartRevision(revision);
  assert.equal(result.revisionId, "rev_def");
  assert.equal(result.document.draftRevision, undefined);
  assert.equal(result.document.venueName, "메인 공연장");
  assert.equal(result.document.assets[0].originalName, undefined);
  assert.equal("publishedBy" in result, false);
  assert.equal(seatChartEtag(revision), '"deadbeef"');
});
