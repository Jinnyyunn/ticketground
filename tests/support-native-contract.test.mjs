import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function nativeCredential(baseUrl) {
  const login = await api(baseUrl, "/api/auth/google/native", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  return login.data.session.credential;
}

async function supportRequest(baseUrl, pathname, { credential, body, key, expectedStatus = 200 } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(payload));
  return payload;
}

test("public support contract exposes versioned FAQ notices and categories", async (t) => {
  const server = await startServer(t);
  const response = await supportRequest(server.baseUrl, "/api/support/v1/public");

  assert.equal(response.data.version, "1");
  assert.ok(response.data.faqs.length >= 4);
  assert.ok(response.data.notices.length >= 1);
  assert.deepEqual(response.data.categories.map((item) => item.id), [
    "GENERAL",
    "PAYMENT",
    "TICKET_QR",
    "URGENT"
  ]);
});

test("support threads require a bearer principal and never trust request actor fields", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const credential = await nativeCredential(server.baseUrl);

  const missing = await supportRequest(server.baseUrl, "/api/me/support/threads", { expectedStatus: 401 });
  assert.equal(missing.error.code, "NATIVE_SESSION_INVALID");

  const created = await supportRequest(server.baseUrl, "/api/me/support/threads", {
    credential,
    key: "support-create-owner",
    body: {
      userId: "user_fan_a",
      subject: "좌석 문의",
      category: "TICKET_QR",
      message: "제 좌석을 확인해주세요."
    }
  });
  assert.equal(created.data.userId, "google_user_test");

  const listed = await supportRequest(server.baseUrl, "/api/me/support/threads", { credential });
  assert.deepEqual(listed.data.map((thread) => thread.id), [created.data.id]);

  const detail = await supportRequest(
    server.baseUrl,
    `/api/me/support/threads/${encodeURIComponent(created.data.id)}`,
    { credential }
  );
  assert.equal(detail.data.id, created.data.id);

  const foreign = await api(server.baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    message: "다른 사용자의 문의"
  });
  const hidden = await supportRequest(
    server.baseUrl,
    `/api/me/support/threads/${encodeURIComponent(foreign.data.id)}`,
    { credential, expectedStatus: 404 }
  );
  assert.equal(hidden.error.code, "SUPPORT_THREAD_NOT_FOUND");
});

test("support create and reply are durable idempotent mutations", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-support-native-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const server = await startServer(t, { dbPath });
  const credential = await nativeCredential(server.baseUrl);
  const createBody = { subject: "입장 문의", category: "URGENT", message: "입장 시간을 확인해주세요." };

  const [created, replay] = await Promise.all([
    supportRequest(server.baseUrl, "/api/me/support/threads", {
      credential,
      key: "support-create-retry",
      body: createBody
    }),
    supportRequest(server.baseUrl, "/api/me/support/threads", {
      credential,
      key: "support-create-retry",
      body: createBody
    })
  ]);
  assert.equal(created.data.id, replay.data.id);

  const conflict = await supportRequest(server.baseUrl, "/api/me/support/threads", {
    credential,
    key: "support-create-retry",
    body: { ...createBody, message: "다른 내용" },
    expectedStatus: 409
  });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const replyBody = { actorId: "user_fan_a", message: "추가 문의입니다." };
  const firstReply = await supportRequest(
    server.baseUrl,
    `/api/me/support/threads/${encodeURIComponent(created.data.id)}/messages`,
    { credential, key: "support-reply-retry", body: replyBody }
  );
  const replyReplay = await supportRequest(
    server.baseUrl,
    `/api/me/support/threads/${encodeURIComponent(created.data.id)}/messages`,
    { credential, key: "support-reply-retry", body: replyBody }
  );
  assert.equal(firstReply.data.messages.length, 2);
  assert.equal(replyReplay.data.messages.length, 2);
  assert.equal(firstReply.data.messages.at(-1).actorId, "google_user_test");

  await server.stop();
  const restarted = await startServer(t, { dbPath });
  const persistedReplay = await supportRequest(restarted.baseUrl, "/api/me/support/threads", {
    credential,
    key: "support-create-retry",
    body: createBody
  });
  assert.equal(persistedReplay.data.id, created.data.id);
  assert.equal(persistedReplay.data.messages.length, 1);
});

test("already-shipped app builds can still reply via POST /api/me/support/messages with X-Idempotency-Key", async (t) => {
  // Regression coverage: LiveBackendModels.swift's .supportMessages and
  // AccountApi.kt both POST { threadId, message } to this flat path with an
  // X-Idempotency-Key header, not the newer /threads/:id/messages path with
  // Idempotency-Key that native code elsewhere in this suite exercises.
  // Installed builds can't be force-updated, so this path must keep working.
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const credential = await nativeCredential(server.baseUrl);
  const created = await supportRequest(server.baseUrl, "/api/me/support/threads", {
    credential,
    key: "shipped-app-thread",
    body: { subject: "입장 문의", category: "URGENT", message: "최초 문의입니다." }
  });

  const reply = await fetch(`${server.baseUrl}/api/me/support/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credential}`,
      "X-Idempotency-Key": "shipped-app-reply"
    },
    body: JSON.stringify({ threadId: created.data.id, message: "추가로 문의합니다." })
  });
  const payload = await reply.json();
  assert.equal(reply.status, 200, JSON.stringify(payload));
  assert.equal(payload.data.messages.length, 2);
  assert.equal(payload.data.messages.at(-1).actorId, "google_user_test");

  const missingKey = await fetch(`${server.baseUrl}/api/me/support/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` },
    body: JSON.stringify({ threadId: created.data.id, message: "키 없는 요청" })
  });
  assert.equal(missingKey.status, 400);
  assert.equal((await missingKey.json()).error.code, "IDEMPOTENCY_KEY_REQUIRED");
});
