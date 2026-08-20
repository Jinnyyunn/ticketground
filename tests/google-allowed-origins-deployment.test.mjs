import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// google-sign-in-card.tsx gates the Google button on an EXACT string match of
// window.location.origin against this list
// (currentOriginCanLoadGoogleIdentityServices: `new Set(allowedOrigins).has(window.location.origin)`).
// An origin missing from the list makes the button silently do nothing - no
// error, no console warning, just a dead button. That exact failure has now
// happened twice: once when the list was empty entirely (간편로그인-수정금지-지침.md
// §4, commit f7e58b2), and again when the app was deployed to
// dev.ticketground.co.kr while the list still only had the local dev origins,
// so the operator's real browser test hit a dead Google button.
//
// This test pins the origins the app is ACTUALLY served from so trimming the
// list back to localhost-only fails loudly here instead of silently in
// production. Adding a new deployment host means adding it here too - and, per
// the same guideline doc, registering it as an "승인된 자바스크립트 원본" in Google
// Cloud Console, which this test cannot verify (only Google can).
const DEPLOYMENT_ORIGINS = [
  "https://dev.ticketground.co.kr",
  "https://ticketground.co.kr",
];

const LOCAL_DEV_ORIGINS = [
  "http://localhost:5501",
  "http://127.0.0.1:5501",
];

async function committedAllowedOrigins() {
  const env = await readFile(path.join(repoRoot, ".env"), "utf8");
  const line = env
    .split("\n")
    .find((entry) => entry.startsWith("NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS="));
  assert.ok(line, ".env must declare NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS");
  return line
    .slice("NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS=".length)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

test("committed Google allowed origins cover every host the app is served from", async () => {
  const origins = await committedAllowedOrigins();

  for (const origin of DEPLOYMENT_ORIGINS) {
    assert.ok(
      origins.includes(origin),
      `${origin} is missing from NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS - the Google login button is silently dead on that host`,
    );
  }

  // The operator tests locally too (see 간편로그인-수정금지-지침.md's account of
  // localhost:5501 being their real test environment), so these must survive
  // any future cleanup of this list as well.
  for (const origin of LOCAL_DEV_ORIGINS) {
    assert.ok(
      origins.includes(origin),
      `${origin} is missing from NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS - local Google login testing would break`,
    );
  }
});

test("allowed origins are full scheme+host origins, not bare hostnames", async () => {
  const origins = await committedAllowedOrigins();

  // window.location.origin always includes the scheme, so a bare hostname
  // ("dev.ticketground.co.kr") can never match and would be a silent no-op
  // entry that looks correct at a glance.
  for (const origin of origins) {
    assert.match(
      origin,
      /^https?:\/\/[^/]+$/,
      `"${origin}" is not a scheme-qualified origin and can never match window.location.origin`,
    );
  }
});
