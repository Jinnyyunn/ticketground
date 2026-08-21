import type { ChartDocument, ChartObject, SeatPlace } from "@/types/seat-chart";
import { objectCenter } from "../seat-designer/chart-ops.ts";
import { pointInPolygon, rotateAround } from "../seat-designer/geometry.ts";

export type SellableTier = "VIP" | "R" | "S" | "A";

export type SellableSeat = {
  readonly id: string;
  readonly label: string;
  readonly displayLabel: string;
  readonly tier: SellableTier;
  readonly price: number;
  readonly sold: boolean;
  readonly x: number;
  readonly y: number;
  readonly categoryKey?: string;
  readonly categoryLabel?: string;
  readonly objectId: string;
  readonly objectType: ChartObject["type"];
  readonly bookingMode?: "whole" | "variable";
  readonly minOccupancy?: number;
  readonly maxOccupancy?: number;
  readonly memberLabels?: readonly string[];
  readonly memberSeats?: readonly { readonly label: string; readonly price: number }[];
  readonly backendTicketIds?: readonly string[];
  readonly availableTicketIds?: readonly string[];
};

export type InventoryResult = {
  readonly seats: readonly SellableSeat[];
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

function tierFromCategory(
  chart: ChartDocument,
  categoryKey?: string,
): { tier: SellableTier; label?: string; color?: string } {
  const cat = chart.categories.find((c) => c.key === categoryKey);
  const name = (cat?.label ?? "").toLowerCase();
  if (/vip|프리미엄|premium|golden|골든/.test(name)) return { tier: "VIP", label: cat?.label, color: cat?.color };
  if (/r\b|오케스트라|orchestra|스톨|stalls|table|테이블/.test(name))
    return { tier: "R", label: cat?.label, color: cat?.color };
  if (/s\b|서클|circle|발코니|balcony|부스 a|booth a/.test(name))
    return { tier: "S", label: cat?.label, color: cat?.color };
  if (/a\b|choir|합창|기타|ga|입석|부스/.test(name)) return { tier: "A", label: cat?.label, color: cat?.color };
  // fallback by category key order
  const idx = chart.categories.findIndex((c) => c.key === categoryKey);
  const order: SellableTier[] = ["VIP", "R", "S", "A"];
  return { tier: order[Math.max(0, idx)] ?? "A", label: cat?.label, color: cat?.color };
}

function expandBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
) {
  b.minX = Math.min(b.minX, x);
  b.minY = Math.min(b.minY, y);
  b.maxX = Math.max(b.maxX, x);
  b.maxY = Math.max(b.maxY, y);
}

/**
 * Flatten a designer chart into sellable inventory for booking.
 * Only interactive places on the active floor (or all if no floor).
 */
export function chartToSellableSeats(
  chart: ChartDocument,
  prices: Record<SellableTier, number>,
  soldIds: ReadonlySet<string> = new Set(),
): InventoryResult {
  const seats: SellableSeat[] = [];
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  const pushSeat = (
    place: SeatPlace,
    object: ChartObject,
    objectType: ChartObject["type"],
    fallbackCategory?: string,
    booking?: Pick<SellableSeat, "bookingMode" | "minOccupancy" | "maxOccupancy" | "memberLabels" | "memberSeats" | "price">,
  ) => {
    const position = object.rotation
      ? rotateAround(place, objectCenter(object), object.rotation)
      : place;
    const catKey = place.categoryKey ?? fallbackCategory;
    const { tier, label: categoryLabel } = tierFromCategory(chart, catKey);
    expandBounds(b, position.x, position.y);
    seats.push({
      id: place.id,
      label: place.label,
      displayLabel: place.displayedLabel || place.label,
      tier,
      price: prices[tier],
      sold: soldIds.has(place.id),
      x: position.x,
      y: position.y,
      categoryKey: catKey,
      categoryLabel,
      objectId: object.id,
      objectType,
      ...booking,
    });
  };

  const walk = (obj: ChartObject) => {
    if (obj.layer !== "interactive") return;
    if (obj.floorId && chart.activeFloorId && obj.floorId !== chart.activeFloorId) {
      // include all floors for inventory by default when selling
      // skip only if we later add floor-specific events
    }

    if (obj.type === "row") {
      for (const s of obj.seats) pushSeat(s, obj, "row", obj.categoryKey);
      return;
    }
    if (obj.type === "table") {
      if (obj.bookAsWhole || obj.variableOccupancy) {
        const memberSeats = obj.seats.map((seat) => {
          const memberTier = tierFromCategory(chart, seat.categoryKey ?? obj.categoryKey).tier;
          return { label: seat.label, price: prices[memberTier] };
        });
        const bookingPrice = memberSeats
          .slice(0, obj.variableOccupancy ? Math.max(1, obj.minOccupancy ?? 1) : memberSeats.length)
          .reduce((sum, member) => sum + member.price, 0);
        pushSeat(
          {
            id: `${obj.id}__whole`,
            label: obj.displayedLabel || obj.label,
            x: obj.center.x,
            y: obj.center.y,
            categoryKey: obj.categoryKey,
            displayedLabel: obj.displayedLabel,
          },
          obj,
          "table",
          obj.categoryKey,
          obj.variableOccupancy
            ? { bookingMode: "variable", minOccupancy: obj.minOccupancy ?? 1, maxOccupancy: obj.maxOccupancy ?? obj.seatCount, memberLabels: obj.seats.map((seat) => seat.label), memberSeats, price: bookingPrice }
            : { bookingMode: "whole", memberLabels: obj.seats.map((seat) => seat.label), memberSeats, price: bookingPrice },
        );
      } else {
        for (const s of obj.seats) pushSeat(s, obj, "table", obj.categoryKey);
      }
      return;
    }
    if (obj.type === "booth") {
      pushSeat(
        {
          id: `${obj.id}__booth`,
          label: obj.displayedLabel || obj.label,
          x: obj.x + obj.width / 2,
          y: obj.y + obj.height / 2,
          categoryKey: obj.categoryKey,
        },
        obj,
        "booth",
        obj.categoryKey,
      );
      return;
    }
    if (obj.type === "area") {
      // GA: one selectable unit per capacity slot, placed in a grid inside bounds
      const xs = obj.points.map((p) => p.x);
      const ys = obj.points.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const n = Math.max(1, obj.capacity);
      if (obj.shape === "ellipse") {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const radiusX = (maxX - minX) / 2;
        const radiusY = (maxY - minY) / 2;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < n; i += 1) {
          const radial = Math.sqrt((i + 0.5) / n) * 0.92;
          pushSeat(
            {
              id: `${obj.id}__ga_${i + 1}`,
              label: `${obj.label}-${i + 1}`,
              x: centerX + Math.cos(i * goldenAngle) * radiusX * radial,
              y: centerY + Math.sin(i * goldenAngle) * radiusY * radial,
              categoryKey: obj.categoryKey,
            },
            obj,
            "area",
            obj.categoryKey,
          );
        }
        return;
      }
      let density = Math.max(4, Math.ceil(Math.sqrt(n * 2)));
      let candidates: { x: number; y: number }[] = [];
      while (candidates.length < n && density <= 2048) {
        candidates = [];
        for (let row = 0; row < density; row += 1) {
          for (let col = 0; col < density; col += 1) {
            const point = {
              x: minX + ((col + 0.5) / density) * (maxX - minX || 40),
              y: minY + ((row + 0.5) / density) * (maxY - minY || 40),
            };
            if (pointInPolygon(point, obj.points)) candidates.push(point);
          }
        }
        density *= 2;
      }
      if (candidates.length === 0) candidates = [...obj.points];
      for (let i = 0; i < n; i += 1) {
        const point = candidates[Math.floor(i * candidates.length / n) % candidates.length];
        pushSeat(
          {
            id: `${obj.id}__ga_${i + 1}`,
            label: `${obj.label}-${i + 1}`,
            x: point.x,
            y: point.y,
            categoryKey: obj.categoryKey,
          },
          obj,
          "area",
          obj.categoryKey,
        );
      }
      return;
    }
    if (obj.type === "section" && obj.nestedRows) {
      for (const row of obj.nestedRows) {
        for (const s of row.seats) pushSeat(s, obj, "section", obj.categoryKey ?? row.categoryKey);
      }
    }
  };

  for (const obj of chart.objects) walk(obj);

  if (!Number.isFinite(b.minX)) {
    b.minX = 0;
    b.minY = 0;
    b.maxX = 100;
    b.maxY = 100;
  }

  return { seats, bounds: b };
}
