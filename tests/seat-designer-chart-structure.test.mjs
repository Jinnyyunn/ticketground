import assert from "node:assert/strict";
import test from "node:test";
import {
  addZone,
  removeZone,
  renameZone,
  setSeatProperties,
} from "../src/lib/seat-designer/chart-structure.ts";

function chart() {
  return {
    id: "chart-test",
    name: "테스트",
    activeFloorId: "floor-1",
    floors: [{ id: "floor-1", name: "1층", index: 1 }],
    zones: [{ id: "zone-a", name: "A존" }],
    categories: [{ key: "vip", label: "VIP", color: "#111111" }],
    objects: [{
      id: "row-a",
      type: "row",
      label: "A",
      layer: "interactive",
      zoneId: "zone-a",
      start: { x: 0, y: 0 },
      end: { x: 20, y: 0 },
      seatCount: 2,
      seats: [{ id: "a-1", label: "1", x: 0, y: 0 }, { id: "a-2", label: "2", x: 20, y: 0 }],
    }],
  };
}

test("seat accessibility properties update selected seats only", () => {
  const source = chart();
  const changed = setSeatProperties(source, ["a-2"], { accessible: true, companion: true, restrictedView: false });
  assert.equal(changed.objects[0].seats[0].accessible, undefined);
  assert.deepEqual(changed.objects[0].seats[1], { ...source.objects[0].seats[1], accessible: true, companion: true, restrictedView: false });
  assert.equal(source.objects[0].seats[1].accessible, undefined);
});

test("zones can be added, renamed, and removed while object assignments fail closed", () => {
  const added = addZone(chart(), { id: "zone-b", name: "B존" });
  assert.deepEqual(added.zones.map((zone) => zone.name), ["A존", "B존"]);
  const renamed = renameZone(added, "zone-b", "스탠딩");
  assert.equal(renamed.zones[1].name, "스탠딩");
  const removed = removeZone(renamed, "zone-a");
  assert.equal(removed.zones.length, 1);
  assert.equal(removed.objects[0].zoneId, undefined);
});
