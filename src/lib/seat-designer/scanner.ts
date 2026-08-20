import type { RowObject, SeatPlace } from "../../types/seat-chart.ts";

export type ScannerOptions = {
  readonly threshold: number;
  readonly minDiameter: number;
  readonly maxDiameter: number;
  readonly rowAngleTolerance: number;
};

export type SeatCandidate = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly diameter: number;
  readonly confidence: number;
};

export type ScannerRow = {
  readonly id: string;
  readonly label: string;
  readonly candidates: readonly SeatCandidate[];
};

export type ScannerResult = {
  readonly candidates: readonly SeatCandidate[];
  readonly rejectionReason?: "NO_SEAT_CANDIDATES";
};

type GrayImage = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
};

function componentAt(image: GrayImage, start: number, seen: Uint8Array, threshold: number): number[] {
  const pixels: number[] = [];
  const queue = [start];
  seen[start] = 1;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    pixels.push(index);
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < image.width ? index + 1 : -1,
      y > 0 ? index - image.width : -1,
      y + 1 < image.height ? index + image.width : -1,
    ];
    for (const neighbor of neighbors) {
      if (neighbor >= 0 && !seen[neighbor] && image.data[neighbor] <= threshold) {
        seen[neighbor] = 1;
        queue.push(neighbor);
      }
    }
  }
  return pixels;
}

export function detectSeatCandidates(image: GrayImage, options: ScannerOptions): ScannerResult {
  if (image.width * image.height !== image.data.length) throw new TypeError("INVALID_SCANNER_IMAGE");
  const seen = new Uint8Array(image.data.length);
  const candidates: SeatCandidate[] = [];
  for (let index = 0; index < image.data.length; index += 1) {
    if (seen[index] || image.data[index] > options.threshold) continue;
    const pixels = componentAt(image, index, seen, options.threshold);
    let minX = image.width;
    let maxX = 0;
    let minY = image.height;
    let maxY = 0;
    for (const pixel of pixels) {
      const x = pixel % image.width;
      const y = Math.floor(pixel / image.width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const diameter = (width + height) / 2;
    const aspect = Math.min(width, height) / Math.max(width, height);
    const fill = pixels.length / (width * height);
    const confidence = Math.max(0, Math.min(1, aspect * (1 - Math.abs(fill - Math.PI / 4))));
    if (diameter < options.minDiameter || diameter > options.maxDiameter || aspect < 0.65 || confidence < 0.7) continue;
    candidates.push({
      id: `candidate-${candidates.length + 1}`,
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      diameter,
      confidence,
    });
  }
  return candidates.length > 0 ? { candidates } : { candidates, rejectionReason: "NO_SEAT_CANDIDATES" };
}

function normalizedAngle(first: SeatCandidate, second: SeatCandidate): number {
  let angle = (Math.atan2(second.y - first.y, second.x - first.x) * 180) / Math.PI;
  while (angle < -45) angle += 90;
  while (angle >= 45) angle -= 90;
  return angle;
}

function estimateRowAngle(candidates: readonly SeatCandidate[]): number {
  const buckets = new Map<number, number>();
  for (let first = 0; first < candidates.length; first += 1) {
    for (let second = first + 1; second < candidates.length; second += 1) {
      const distance = Math.hypot(candidates[second].x - candidates[first].x, candidates[second].y - candidates[first].y);
      if (distance > candidates[first].diameter * 3.2) continue;
      const bucket = Math.round(normalizedAngle(candidates[first], candidates[second]));
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  }
  return [...buckets].sort((left, right) => right[1] - left[1] || Math.abs(left[0]) - Math.abs(right[0]))[0]?.[0] ?? 0;
}

function rowLabel(index: number): string {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

export function groupCandidatesIntoRows(candidates: readonly SeatCandidate[], tolerance: number): readonly ScannerRow[] {
  if (candidates.length === 0) return [];
  const angle = (estimateRowAngle(candidates) * Math.PI) / 180;
  const projected = candidates.map((candidate) => ({
    candidate,
    along: candidate.x * Math.cos(angle) + candidate.y * Math.sin(angle),
    across: -candidate.x * Math.sin(angle) + candidate.y * Math.cos(angle),
  })).sort((left, right) => left.across - right.across || left.along - right.along);
  const groups: Array<typeof projected> = [];
  for (const item of projected) {
    const group = groups.find((entry) => Math.abs(entry.reduce((sum, member) => sum + member.across, 0) / entry.length - item.across) <= tolerance);
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups.map((group, index) => ({
    id: `scanner-row-${index + 1}`,
    label: rowLabel(index),
    candidates: group.sort((left, right) => left.along - right.along).map(({ candidate }) => candidate),
  }));
}

export function acceptScannerRows(result: ScannerResult & { readonly rows: readonly ScannerRow[] }): readonly RowObject[] {
  return result.rows.map((row) => {
    const seats: SeatPlace[] = row.candidates.map((candidate, index) => ({
      id: `${row.id}-seat-${index + 1}`,
      label: String(index + 1),
      x: candidate.x,
      y: candidate.y,
    }));
    return {
      id: row.id,
      type: "row",
      label: row.label,
      layer: "interactive",
      start: { x: seats[0]?.x ?? 0, y: seats[0]?.y ?? 0 },
      end: { x: seats.at(-1)?.x ?? 0, y: seats.at(-1)?.y ?? 0 },
      seatCount: seats.length,
      seats,
    };
  });
}
