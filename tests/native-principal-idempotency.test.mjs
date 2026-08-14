import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { createNativeSessionBackend } from "../backend/native-session.js";

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function nativeBackend(now = "2026-08-02T10:00:00.000Z") {
  let sequence = 0;
  return createNativeSessionBackend({
    currentTimeMs: () => Date.parse(now),
    findUser: (db, userId) => db.users.find((user) => user.id === userId),
    hash,
    httpError,
    now: () => now,
    randomHex: () => `credential_${++sequence}`
  });
}

test("native principal comes only from a valid unrevoked bearer session", () => {
  const db = {
    users: [{ id: "user-owner", name: "Owner" }, { id: "user-spoofed", name: "Spoofed" }],
    nativeSessions: []
  };
  const backend = nativeBackend();
  const issued = backend.issueNativeSession(db, "user-owner");
  const request = {
    headers: { authorization: `Bearer ${issued.credential}` },
    body: { userId: "user-spoofed" }
  };

  assert.deepEqual(backend.nativeSessionPrincipal(db, request), { userId: "user-owner" });
  assert.throws(
    () => backend.nativeSessionPrincipal(db, { headers: {} }),
    (error) => error.status === 401 && error.code === "NATIVE_SESSION_INVALID"
  );
  assert.throws(
    () => backend.nativeSessionPrincipal(db, { headers: { authorization: "Bearer invalid" } }),
    (error) => error.status === 401 && error.code === "NATIVE_SESSION_INVALID"
  );

  backend.nativeLogout(db, request);
  assert.throws(
    () => backend.nativeSessionPrincipal(db, request),
    (error) => error.status === 401 && error.code === "NATIVE_SESSION_INVALID"
  );
});

test("idempotent mutations replay one durable response and reject payload conflicts", async () => {
  const { createIdempotencyBackend } = await import("../backend/idempotency.js");
  const backend = createIdempotencyBackend({
    hash,
    httpError,
    now: () => "2026-08-02T10:00:00.000Z"
  });
  const db = { idempotencyRecords: [] };
  let mutations = 0;
  const input = {
    actorId: "user-owner",
    operation: "SUPPORT_THREAD_CREATE",
    key: "request-key",
    payload: { message: "문의합니다" }
  };

  const [first, replay] = await Promise.all([
    Promise.resolve().then(() => backend.executeIdempotent(db, input, () => ({ id: `thread-${++mutations}` }))),
    Promise.resolve().then(() => backend.executeIdempotent(db, input, () => ({ id: `thread-${++mutations}` })))
  ]);

  assert.deepEqual(first, { id: "thread-1" });
  assert.deepEqual(replay, first);
  assert.equal(mutations, 1);
  assert.equal(db.idempotencyRecords.length, 1);
  assert.equal(db.idempotencyRecords[0].key, undefined);
  assert.equal(db.idempotencyRecords[0].keyHash, hash("request-key"));

  const restarted = createIdempotencyBackend({
    hash,
    httpError,
    now: () => "2026-08-02T10:05:00.000Z"
  });
  assert.deepEqual(
    restarted.executeIdempotent(db, input, () => ({ id: `thread-${++mutations}` })),
    first
  );
  assert.equal(mutations, 1);

  assert.throws(
    () => restarted.executeIdempotent(
      db,
      { ...input, payload: { message: "다른 문의" } },
      () => ({ id: `thread-${++mutations}` })
    ),
    (error) => error.status === 409 && error.code === "IDEMPOTENCY_CONFLICT"
  );
  assert.equal(mutations, 1);
});

test("request principal requires a bounded idempotency key", async () => {
  const { createRequestPrincipal } = await import("../backend/request-principal.js");
  const principal = createRequestPrincipal({
    httpError,
    nativeSessionPrincipal: () => ({ userId: "user-owner" })
  });

  assert.deepEqual(principal.requireNativePrincipal({}, { headers: {} }), { userId: "user-owner" });
  assert.equal(
    principal.requireIdempotencyKey({ headers: { "idempotency-key": "support-request-1" } }),
    "support-request-1"
  );
  assert.throws(
    () => principal.requireIdempotencyKey({ headers: {} }),
    (error) => error.status === 400 && error.code === "IDEMPOTENCY_KEY_REQUIRED"
  );
  assert.throws(
    () => principal.requireIdempotencyKey({ headers: { "idempotency-key": "x".repeat(129) } }),
    (error) => error.status === 422 && error.code === "IDEMPOTENCY_KEY_INVALID"
  );
});
