import assert from "node:assert/strict";
import test from "node:test";

import { startServer } from "./backend-test-utils.mjs";

const webhookBody = {
  event: "added",
  id: "user-1",
  id_type: "app_user_id",
  channel_public_id: "_xmTniX",
  channel_uuid: "@ticketground",
  updated_at: "2026-08-13T12:00:00Z"
};

test("Kakao Talk Channel webhook accepts a valid callback", async (t) => {
  const server = await startServer(t, { env: { TIG_KAKAO_CHANNEL_WEBHOOK_ADMIN_KEY: "test-admin-key" } });
  const response = await fetch(`${server.baseUrl}/api/kakao/channel/webhook`, {
    method: "POST",
    headers: {
      Authorization: "KakaoAK test-admin-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webhookBody)
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { received: true });
});

test("Kakao Talk Channel webhook rejects an invalid admin key", async (t) => {
  const server = await startServer(t, { env: { TIG_KAKAO_CHANNEL_WEBHOOK_ADMIN_KEY: "test-admin-key" } });
  const response = await fetch(`${server.baseUrl}/api/kakao/channel/webhook`, {
    method: "POST",
    headers: {
      Authorization: "KakaoAK wrong-key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(webhookBody)
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "KAKAO_WEBHOOK_UNAUTHORIZED");
});
