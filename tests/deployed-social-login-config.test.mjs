import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const DEV_ORIGIN = "https://dev.ticketground.co.kr";

async function committedEnvValue(name) {
  const envFile = await readFile(new URL("../.env", import.meta.url), "utf8");
  const assignment = envFile
    .split(/\r?\n/u)
    .find((line) => line.startsWith(`${name}=`));
  return assignment?.slice(name.length + 1).trim() ?? "";
}

test("committed Google configuration authorizes the deployed user origin", async () => {
  const allowedOrigins = (await committedEnvValue("NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS"))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  assert.ok(
    allowedOrigins.includes(DEV_ORIGIN),
    `${DEV_ORIGIN} must be included in NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS`,
  );
});
