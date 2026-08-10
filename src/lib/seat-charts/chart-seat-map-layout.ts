type SeatPoint = {
  readonly x: number;
  readonly y: number;
};

type ChartBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

function chebyshevDistance(a: SeatPoint, b: SeatPoint) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function closestDistance(pointsByX: readonly SeatPoint[]): number {
  if (pointsByX.length < 2) return Number.POSITIVE_INFINITY;
  if (pointsByX.length <= 3) {
    let closest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pointsByX.length; i += 1) {
      for (let j = i + 1; j < pointsByX.length; j += 1) {
        closest = Math.min(closest, chebyshevDistance(pointsByX[i], pointsByX[j]));
      }
    }
    return closest;
  }

  const middle = Math.floor(pointsByX.length / 2);
  const middleX = pointsByX[middle].x;
  const closest = Math.min(
    closestDistance(pointsByX.slice(0, middle)),
    closestDistance(pointsByX.slice(middle)),
  );
  if (closest === 0) return 0;

  const strip = pointsByX
    .filter((point) => Math.abs(point.x - middleX) < closest)
    .sort((a, b) => a.y - b.y);
  let stripClosest = closest;
  for (let i = 0; i < strip.length; i += 1) {
    for (let j = i + 1; j < strip.length && strip[j].y - strip[i].y < stripClosest; j += 1) {
      stripClosest = Math.min(stripClosest, chebyshevDistance(strip[i], strip[j]));
    }
  }
  return stripClosest;
}

export function minimumRenderedWidthForRelativePoints(
  points: readonly SeatPoint[],
  targetSize: number,
  defaultWidth: number,
) {
  const closest = closestDistance([...points].sort((a, b) => a.x - b.x || a.y - b.y));
  if (!Number.isFinite(closest) || closest <= 0) return defaultWidth;
  return Math.ceil(Math.max(defaultWidth, targetSize / closest));
}

export function chartMinimumRenderedWidth(
  seats: readonly SeatPoint[],
  bounds: ChartBounds,
  targetSize: number,
) {
  const pad = 24;
  const width = Math.max(bounds.maxX - bounds.minX, 40) + pad * 2;
  const height = Math.max(bounds.maxY - bounds.minY, 40) + pad * 2;
  const defaultWidth = Math.max(720, (320 * width) / height);
  return minimumRenderedWidthForRelativePoints(
    seats.map((seat) => ({ x: seat.x / width, y: seat.y / width })),
    targetSize,
    defaultWidth,
  );
}
