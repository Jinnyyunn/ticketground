import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("custom server wires admin and public HMR upgrades to Next in development", async () => {
  // Given: the custom server owns separate public and admin HTTP servers.
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");

  // When: Next is initialized and the public server receives websocket upgrades.
  const nextInit = /next\(\{\s*dev:\s*isDev,\s*hostname:\s*adminHostname,\s*port:\s*adminPort,\s*httpServer:\s*adminServer\s*\}\)/s;
  const publicUpgrade = /if\s*\(\s*isDev\s*\)\s*\{\s*publicServer\.on\("upgrade",\s*\(req,\s*socket,\s*head\)\s*=>\s*\{\s*nextApp\.upgradeHandler\(req,\s*socket,\s*head\);/s;

  // Then: admin HMR uses Next's supported httpServer option, and public HMR is forwarded too.
  assert.match(source, nextInit);
  assert.match(source, publicUpgrade);
});
