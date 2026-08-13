import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogBackend } from "../backend/catalog.js";

function catalogBackend() {
  const ledger = [];
  const backend = createCatalogBackend({
    appendLedger: (db, actorId, action, payload) => {
      ledger.push({ actorId, action, payload });
      db.ledger.push({ actorId, action, payload });
    },
    clone: (value) => structuredClone(value),
    ensureAdmissionCredential: () => {},
    httpError: (status, code, message, detail) => Object.assign(new Error(message), { status, code, detail }),
    now: () => "2026-09-19T00:00:00.000Z",
    stableId: (prefix, ...parts) => `${prefix}_${parts.join("_")}`
  });
  return { backend, ledger };
}

test("catalog normalization fills missing ticket issue time and legacy event dates without reference errors", () => {
  // Given: persisted legacy records that exercise both helper paths in catalog persistence.
  const { backend } = catalogBackend();
  const db = {
    users: [],
    venues: [],
    events: [
      {
        id: "event_kpop_001",
        category: "concert",
        title: "TIG Live: Neon Stage",
        venueId: "venue_jamsil_olympic",
        venue: "잠실 올림픽 주 경기장",
        date: "2026-09-19T19:00:00+09:00",
        saleState: "ON_SALE",
        zones: [
          { id: "zone_vip", name: "VIP", faceValue: 154000, resaleFeeRate: 0.08, maxTransferCount: 1 }
        ]
      }
    ],
    tickets: [
      {
        id: "ticket_missing_issued_at",
        eventId: "event_kpop_001",
        performanceDateId: "perf_kpop_20260919_1900",
        zoneId: "zone_vip",
        seatLabel: "VIP-A1",
        ownerId: null,
        status: "ON_SALE",
        faceValue: 154000
      }
    ],
    ledger: []
  };

  // When: persisted data is normalized on load.
  const changed = backend.normalizeDb(db);

  // Then: date and issuedAt fallbacks are populated without crashing.
  assert.equal(changed, true);
  assert.ok(db.events.find((event) => event.id === "event_kpop_001").dates.length > 0);
  assert.equal(db.tickets.find((ticket) => ticket.id === "ticket_missing_issued_at").issuedAt, "2026-09-19T00:00:00.000Z");
});

test("catalog normalization migrates stale 'Tig 공식 양도 티켓' notice wording to the CLEAN 티켓 branding on already-persisted events", () => {
  // Given: an already-persisted event whose notices still carry the pre-rename
  // wording (a fresh checkout never sees this - only db.json files saved before
  // the CLEAN/Tig split do, since legacy-show-seed-data.js only seeds on first
  // creation and normalizeDb otherwise only backfills missing fields).
  const { backend } = catalogBackend();
  const db = {
    users: [],
    venues: [],
    events: [
      {
        id: "event_legacy_001",
        category: "concert",
        title: "Legacy Show",
        venueId: "venue_jamsil_olympic",
        venue: "잠실 올림픽 주 경기장",
        date: "2026-09-19T19:00:00+09:00",
        saleState: "ON_SALE",
        zones: [{ id: "zone_vip", name: "VIP", faceValue: 154000, resaleFeeRate: 0.08, maxTransferCount: 1 }],
        notices: [
          "Tig 공식 양도 티켓 정책은 공연별 공지에 따라 제한될 수 있습니다.",
          "공식 양도와 취소 정책은 클린티켓 기준을 따릅니다.",
          "Tig 공식 양도 티켓은 정가 범위 안에서만 등록할 수 있습니다.",
          "이 문구는 그대로 유지되어야 합니다."
        ]
      }
    ],
    tickets: [],
    ledger: []
  };

  // When: persisted data is normalized on load.
  backend.normalizeDb(db);

  // Then: only the known stale sentences are rewritten; anything else is untouched.
  assert.deepEqual(db.events[0].notices, [
    "CLEAN 티켓 공식 양도 정책은 공연별 공지에 따라 제한될 수 있습니다.",
    "공식 양도와 취소 정책은 CLEAN 티켓 기준을 따릅니다.",
    "CLEAN 티켓 공식 양도는 정가 범위 안에서만 등록할 수 있습니다.",
    "이 문구는 그대로 유지되어야 합니다."
  ]);
});
