import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function nativeLogin(server) {
  const login = await api(server.baseUrl, "/api/auth/google/native", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  return {
    authorization: `Bearer ${login.data.session.credential}`,
    user: login.data.user
  };
}

async function request(server, pathName, {
  authorization,
  body,
  idempotencyKey,
  method = "GET",
  status = 200
} = {}) {
  const response = await fetch(`${server.baseUrl}${pathName}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${pathName}: ${JSON.stringify(json)}`);
  return json;
}

test("public support contract is readable without a session", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);

  const support = await request(server, "/api/support/public");
  assert.equal(support.data.version, "1");
  assert.ok(support.data.faqs.length > 0);
  assert.ok(support.data.notices.length > 0);
});

test("native support routes bind ownership to bearer and redact internal user ids", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server);

  const missing = await request(server, "/api/me/support/threads", { status: 401 });
  assert.equal(missing.error.code, "NATIVE_SESSION_INVALID");

  const created = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-create-1",
    body: {
      subject: "결제 문의",
      message: "결제 상태를 확인해주세요.",
      userId: "user_fan_a"
    }
  });
  assert.equal(created.data.subject, "결제 문의");
  assert.equal(created.data.userId, undefined);
  assert.equal(created.data.messages[0].actorId, undefined);

  const threads = await request(server, "/api/me/support/threads?userId=user_fan_a", {
    authorization: login.authorization
  });
  assert.deepEqual(threads.data.map((thread) => thread.id), [created.data.id]);
});

test("native support mutations are idempotent and reject cross-account replies", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server);

  const body = { subject: "티켓 문의", message: "티켓을 확인해주세요." };
  const first = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-create-retry",
    body
  });
  const retry = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-create-retry",
    body
  });
  assert.equal(retry.data.id, first.data.id);

  const conflict = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-create-retry",
    body: { ...body, message: "다른 요청" },
    status: 409
  });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const replied = await request(server, "/api/me/support/messages", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-message-retry",
    body: { threadId: first.data.id, message: "추가 문의입니다.", actorId: "user_fan_a" }
  });
  const replyRetry = await request(server, "/api/me/support/messages", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-message-retry",
    body: { threadId: first.data.id, message: "추가 문의입니다.", actorId: "user_fan_a" }
  });
  assert.equal(replied.data.messages.length, 2);
  assert.equal(replyRetry.data.messages.length, 2);

  const foreign = await api(server.baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    subject: "다른 사용자 문의",
    message: "소유권 검증"
  });
  const forbidden = await request(server, "/api/me/support/messages", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-message-foreign",
    body: { threadId: foreign.data.id, message: "침범 시도" },
    status: 403
  });
  assert.equal(forbidden.error.code, "SUPPORT_FORBIDDEN");
});

test("native support idempotency survives runtime secret rotation", async (t) => {
  configureGoogleEnv(t, true);
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-support-rotation-"));
  const dbPath = path.join(tempDir, "db.json");
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const firstServer = await startServer(t, {
    dbPath,
    env: { TIG_SECRET: "support-runtime-secret-before-rotation" }
  });
  const login = await nativeLogin(firstServer);
  const body = { subject: "재시작 문의", message: "같은 요청입니다." };
  const first = await request(firstServer, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-create-across-rotation",
    body
  });
  await firstServer.stop();

  const secondServer = await startServer(t, {
    dbPath,
    env: { TIG_SECRET: "support-runtime-secret-after-rotation" }
  });
  const retry = await request(secondServer, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-create-across-rotation",
    body
  });
  const threads = await request(secondServer, "/api/me/support/threads", {
    authorization: login.authorization
  });

  assert.equal(retry.data.id, first.data.id);
  assert.equal(threads.data.length, 1);
});

test("native support rejects oversized fields instead of truncating them", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server);

  const longSubject = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-long-subject",
    body: { subject: "가".repeat(81), message: "문의" },
    status: 422
  });
  assert.equal(longSubject.error.code, "SUPPORT_SUBJECT_TOO_LONG");

  const longEmojiSubject = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-long-emoji-subject",
    body: { subject: "😀".repeat(41), message: "문의" },
    status: 422
  });
  assert.equal(longEmojiSubject.error.code, "SUPPORT_SUBJECT_TOO_LONG");

  const longMessage = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-long-message",
    body: { subject: "문의", message: "가".repeat(1001) },
    status: 422
  });
  assert.equal(longMessage.error.code, "SUPPORT_MESSAGE_TOO_LONG");

  const valid = await request(server, "/api/me/support/threads", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-valid-before-long-reply",
    body: { subject: "문의", message: "정상 본문" }
  });
  const longReply = await request(server, "/api/me/support/messages", {
    authorization: login.authorization,
    method: "POST",
    idempotencyKey: "support-long-reply",
    body: { threadId: valid.data.id, message: "가".repeat(1001) },
    status: 422
  });
  assert.equal(longReply.error.code, "SUPPORT_MESSAGE_TOO_LONG");

  const threads = await request(server, "/api/me/support/threads", {
    authorization: login.authorization
  });
  assert.equal(threads.data.length, 1);
  assert.equal(threads.data[0].messages.length, 1);
});

test("production disables legacy caller-selected support routes", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t, { env: { TIG_DEMO_SUPPORT_API: "" } });

  const get = await request(server, "/api/support/threads?userId=user_fan_a", { status: 404 });
  assert.equal(get.error.code, "NOT_FOUND");
  for (const [pathName, body] of [
    ["/api/support/threads", { userId: "user_fan_a", message: "우회" }],
    ["/api/support/messages", { actorId: "user_fan_a", threadId: "thread", message: "우회" }]
  ]) {
    const response = await request(server, pathName, { method: "POST", body, status: 404 });
    assert.equal(response.error.code, "NOT_FOUND");
  }
});
