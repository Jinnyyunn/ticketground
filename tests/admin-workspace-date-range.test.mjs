import test from "node:test";
import assert from "node:assert/strict";
import { createAdminBackend } from "../backend/admin.js";

function adminBackend() {
  return createAdminBackend({
    adminTicket: (ticket) => ticket,
    appendLedger: () => {},
    clone: (value) => structuredClone(value),
    ensureTicketsForEvent: () => {},
    httpError: (status, code, message, detail) => Object.assign(new Error(message), { status, code, detail }),
    id: (prefix) => `${prefix}_test`,
    mediaDir: null,
    money: (value) => Number(value),
    now: () => "2026-09-19T17:00:00+09:00",
    seatLayoutForVenue: () => ({ sections: [] }),
    stableId: (prefix, value) => `${prefix}_${value}`,
    verifyLedger: () => ({ ok: true })
  });
}

function workspaceDb() {
  return {
    events: [],
    tickets: [],
    paymentTransactions: [
      {
        id: "pay_missing_date",
        ticketId: "missing_ticket",
        userId: "user_fan_a",
        type: "PRIMARY",
        amount: 50000,
        method: "CREDIT_CARD",
        status: "PAID"
      }
    ],
    ledger: [
      {
        index: 1,
        actorId: "SYSTEM",
        action: "BOOTSTRAP",
        payload: { message: "missing date entry" }
      }
    ]
  };
}

test("admin finance and audit workspaces include missing dates when no date filter is requested", () => {
  // Given: workspace records that have no createdAt/at timestamp.
  const { adminWorkspace } = adminBackend();
  const db = workspaceDb();

  // When: finance and audit are requested without from/to filters.
  const finance = adminWorkspace(db, "finance", "ADMIN", {});
  const audit = adminWorkspace(db, "audit", "ADMIN", {});

  // Then: no date filter means the missing-date records still appear.
  assert.equal(finance.transactions.length, 1);
  assert.equal(finance.transactions[0].id, "pay_missing_date");
  assert.equal(finance.summary.count, 1);
  assert.equal(audit.ledger.length, 1);
  assert.equal(audit.ledger[0].action, "BOOTSTRAP");
});
