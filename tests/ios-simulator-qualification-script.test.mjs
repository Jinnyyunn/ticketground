import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = new URL("../scripts/qualify-ios-simulator-https.sh", import.meta.url);

test("qualification script requires explicit targets and refuses an unhealthy server", async () => {
  const missing = spawnSync("bash", [script.pathname], { encoding: "utf8" });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--port/);

  const unhealthy = spawnSync("bash", [script.pathname, "--port", "1", "--udid", "sim", "--bundle-id", "app", "--evidence-dir", "/tmp/tg-qualification-contract"], { encoding: "utf8" });
  assert.notEqual(unhealthy.status, 0);
  assert.match(unhealthy.stderr, /health check failed/);
});

test("qualification script owns cleanup and never embeds a tunnel URL or credential", async () => {
  const source = await readFile(script, "utf8");
  assert.match(source, /trap cleanup EXIT/);
  assert.match(source, /cloudflared tunnel --url/);
  assert.match(source, /https:\/\/.+trycloudflare/);
  assert.doesNotMatch(source, /Bearer [A-Za-z0-9._-]{12,}/);
  assert.match(source, /TIG_QUALIFICATION_BEARER/);
  assert.match(source, /simctl terminate/);
});
