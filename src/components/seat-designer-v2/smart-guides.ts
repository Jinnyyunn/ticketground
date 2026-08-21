import type { Point } from "@/types/seat-chart";

export type SmartGuide = {
  readonly kind: "center" | "projection" | "axis";
  readonly color: "red" | "blue" | "green";
  readonly axis: "x" | "y";
  readonly value: number;
};

type SmartGuideAnchors = {
  readonly origin?: Point;
  readonly centers: readonly Point[];
  readonly projections: readonly Point[];
};

type Candidate = SmartGuide & { readonly distance: number };

function candidates(
  point: Point,
  anchor: Point,
  kind: SmartGuide["kind"],
  color: SmartGuide["color"],
  tolerance: number,
): Candidate[] {
  const result: Candidate[] = [];
  const dx = Math.abs(point.x - anchor.x);
  const dy = Math.abs(point.y - anchor.y);
  if (dx <= tolerance) result.push({ kind, color, axis: "x", value: anchor.x, distance: dx });
  if (dy <= tolerance) result.push({ kind, color, axis: "y", value: anchor.y, distance: dy });
  return result;
}

export function deriveSmartGuides(
  point: Point,
  anchors: SmartGuideAnchors,
  tolerance = 4,
): { readonly point: Point; readonly guides: readonly SmartGuide[] } {
  const all = [
    ...anchors.centers.flatMap((anchor) => candidates(point, anchor, "center", "red", tolerance)),
    ...anchors.projections.flatMap((anchor) => candidates(point, anchor, "projection", "blue", tolerance)),
    ...(anchors.origin ? candidates(point, anchors.origin, "axis", "green", tolerance) : []),
  ];
  const nearest = (axis: SmartGuide["axis"]) => all
    .filter((guide) => guide.axis === axis)
    .toSorted((left, right) => left.distance - right.distance)[0];
  return {
    point: {
      x: nearest("x")?.value ?? point.x,
      y: nearest("y")?.value ?? point.y,
    },
    guides: all.map(({ kind, color, axis, value }) => ({ kind, color, axis, value })),
  };
}
