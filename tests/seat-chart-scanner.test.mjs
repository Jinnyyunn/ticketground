import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptScannerRows,
  detectSeatCandidates,
  groupCandidatesIntoRows,
} from "../src/lib/seat-designer/scanner.ts";

function circleGrid({ angle = 0, rows = 3, columns = 5 }) {
  const width = 160;
  const height = 120;
  const data = new Uint8ClampedArray(width * height).fill(255);
  const radians = (angle * Math.PI) / 180;
  const center = { x: width / 2, y: height / 2 };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const localX = (column - (columns - 1) / 2) * 20;
      const localY = (row - (rows - 1) / 2) * 24;
      const cx = Math.round(center.x + localX * Math.cos(radians) - localY * Math.sin(radians));
      const cy = Math.round(center.y + localX * Math.sin(radians) + localY * Math.cos(radians));
      for (let y = cy - 4; y <= cy + 4; y += 1) {
        for (let x = cx - 4; x <= cx + 4; x += 1) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= 16) data[y * width + x] = 0;
        }
      }
    }
  }
  return { width, height, data };
}

test("scanner detects a rotated seat grid and groups deterministic rows", () => {
  const result = detectSeatCandidates(circleGrid({ angle: 12 }), {
    threshold: 96,
    minDiameter: 6,
    maxDiameter: 12,
    rowAngleTolerance: 4,
  });
  assert.equal(result.candidates.length, 15);
  assert.ok(result.candidates.every((candidate) => candidate.confidence >= 0.7));
  const rows = groupCandidatesIntoRows(result.candidates, 7);
  assert.deepEqual(rows.map((row) => row.candidates.length), [5, 5, 5]);
  assert.deepEqual(rows.map((row) => row.label), ["A", "B", "C"]);
  const objects = acceptScannerRows({ ...result, rows });
  assert.deepEqual(objects.map((row) => row.label), ["A", "B", "C"]);
  assert.deepEqual(objects[0].seats.map((seat) => seat.label), ["1", "2", "3", "4", "5"]);
});

test("scanner rejects noise and returns an explicit empty result", () => {
  const image = { width: 30, height: 30, data: new Uint8ClampedArray(900).fill(255) };
  image.data[2] = 0;
  const result = detectSeatCandidates(image, {
    threshold: 96,
    minDiameter: 6,
    maxDiameter: 12,
    rowAngleTolerance: 4,
  });
  assert.deepEqual(result.candidates, []);
  assert.equal(result.rejectionReason, "NO_SEAT_CANDIDATES");
  assert.deepEqual(acceptScannerRows({ ...result, rows: [] }), []);
});
