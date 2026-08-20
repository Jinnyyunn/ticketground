import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { consumeServiceCredentialRateLimit, issueServiceCredential, revokeServiceCredential, verifyServiceCredential } from "../src/lib/seat-charts/service-credentials.ts";

test("service keys are shown once, stored as a digest, scoped, expiring, and revocable", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-service-key-"));
  const issued = await issueServiceCredential({ rootDir, label: "venue sync", scopes: ["seat-chart:read"], expiresAt: "2026-09-21T00:00:00.000Z", now: new Date("2026-08-21T00:00:00.000Z") });
  assert.match(issued.credential, /^tig_sc_/);
  const stored = await readFile(path.join(rootDir, `${issued.record.id}.json`), "utf8");
  assert.doesNotMatch(stored, new RegExp(issued.credential));
  assert.equal((await verifyServiceCredential({ rootDir, authorization: `Bearer ${issued.credential}`, scope: "seat-chart:read", now: new Date("2026-08-22T00:00:00.000Z") }))?.id, issued.record.id);
  assert.equal(await verifyServiceCredential({ rootDir, authorization: `Bearer ${issued.credential}`, scope: "seat-chart:write", now: new Date("2026-08-22T00:00:00.000Z") }), null);
  await revokeServiceCredential(rootDir, issued.record.id, new Date("2026-08-23T00:00:00.000Z"));
  assert.equal(await verifyServiceCredential({ rootDir, authorization: `Bearer ${issued.credential}`, scope: "seat-chart:read", now: new Date("2026-08-24T00:00:00.000Z") }), null);
});

test("service keys have a per-minute request budget", () => {
  const now = new Date("2026-08-21T00:00:00.000Z");
  assert.equal(consumeServiceCredentialRateLimit("sck_budget", now, 2), true);
  assert.equal(consumeServiceCredentialRateLimit("sck_budget", now, 2), true);
  assert.equal(consumeServiceCredentialRateLimit("sck_budget", now, 2), false);
  assert.equal(consumeServiceCredentialRateLimit("sck_budget", new Date("2026-08-21T00:01:01.000Z"), 2), true);
});

test("service keys reject query-string transport and expired credentials", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-service-key-"));
  const issued = await issueServiceCredential({ rootDir, label: "short", scopes: ["seat-chart:read"], expiresAt: "2026-08-22T00:00:00.000Z", now: new Date("2026-08-21T00:00:00.000Z") });
  assert.equal(await verifyServiceCredential({ rootDir, authorization: null, queryCredential: issued.credential, scope: "seat-chart:read", now: new Date("2026-08-21T12:00:00.000Z") }), null);
  assert.equal(await verifyServiceCredential({ rootDir, authorization: `Bearer ${issued.credential}`, scope: "seat-chart:read", now: new Date("2026-08-23T00:00:00.000Z") }), null);
});
