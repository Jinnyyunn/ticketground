import type { ChartDocument, ChartObject, SeatPlace, Zone } from "../../types/seat-chart.ts";

type SeatPropertyPatch = Pick<SeatPlace, "accessible" | "companion" | "restrictedView">;

export function setSeatProperties(
  chart: ChartDocument,
  seatIds: readonly string[],
  patch: SeatPropertyPatch,
): ChartDocument {
  const selected = new Set(seatIds);
  const updateSeats = (seats: readonly SeatPlace[]) => seats.map((seat) => selected.has(seat.id) ? { ...seat, ...patch } : seat);
  const updateObject = (object: ChartObject): ChartObject => {
    if (object.type === "row" || object.type === "table") return { ...object, seats: updateSeats(object.seats) };
    if (object.type === "section" && object.nestedRows) {
      return { ...object, nestedRows: object.nestedRows.map((row) => ({ ...row, seats: updateSeats(row.seats) })) };
    }
    return object;
  };
  return { ...chart, objects: chart.objects.map(updateObject) };
}

export function addZone(chart: ChartDocument, zone: Zone): ChartDocument {
  if ((chart.zones ?? []).some((existing) => existing.id === zone.id)) throw new TypeError("DUPLICATE_ZONE_ID");
  return { ...chart, zones: [...(chart.zones ?? []), zone] };
}

export function renameZone(chart: ChartDocument, zoneId: string, name: string): ChartDocument {
  const trimmed = name.trim();
  if (!trimmed) return chart;
  return { ...chart, zones: (chart.zones ?? []).map((zone) => zone.id === zoneId ? { ...zone, name: trimmed } : zone) };
}

export function removeZone(chart: ChartDocument, zoneId: string): ChartDocument {
  return {
    ...chart,
    zones: (chart.zones ?? []).filter((zone) => zone.id !== zoneId),
    objects: chart.objects.map((object) => object.zoneId === zoneId ? { ...object, zoneId: undefined } : object),
  };
}
