import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROVIDER_ENV_REQUIREMENTS } from "../scripts/check-social-login-config.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = "tests/protected-auth-manifest.json";

// 왜 이 파일이 존재하는가
// ----------------------
// 간편 로그인은 "다른 작업을 하다가 곁다리로 수정되어" 반복적으로 죽어왔다.
// 간편로그인-수정금지-지침.md 가 그 사고들을 기록하고 있고, .github 봇도
// PROTECTED_AUTH_PATTERNS 로 해당 파일들을 감지한다 — 그런데 봇은 라벨과 경고
// 코멘트만 달 뿐 **병합을 막지 않는다**. 경고는 무시되기 쉽고, 실제로 무시돼 왔다.
//
// 그래서 이 테스트가 실질적인 관문 역할을 한다: 보호 대상 파일이 바뀌면 CI 가
// 실패한다. 통과시키려면 매니페스트를 의도적으로 갱신해야 하고, 그 갱신 자체가
// "나는 지금 로그인 파일을 건드리고 있다"는 명시적 선언이 된다.
//
// 정당한 로그인 변경일 때 (= 사용자가 명시적으로 간편 로그인/소셜 로그인/OAuth
// 수정을 요청했을 때) 통과시키는 방법:
//   node --test tests/protected-auth-guard.test.mjs   ← 실패 메시지에 새 해시가 찍힌다
//   UPDATE_PROTECTED_AUTH_MANIFEST=1 node --test tests/protected-auth-guard.test.mjs
// 그리고 그 매니페스트 갱신을 같은 PR 에 포함시킨다.
//
// 사용자가 로그인 수정을 요청한 적이 없는데 이 테스트가 실패한다면, 그건 통과
// 시키라는 뜻이 아니라 **변경을 되돌리라는 뜻이다.**
const PROTECTED_FILES = [
  ".env",
  "backend/social-oauth.js",
  "backend/social-oauth-config.js",
  "src/app/auth/google-config/route.ts",
  "src/app/auth/social-config/route.ts",
  "src/components/ticketing/google-sign-in-card.tsx",
  "src/components/ticketing/login-panel.tsx",
  "src/components/ticketing/login-session-panel.tsx",
  "src/components/ticketing/social-login-buttons.tsx",
  "src/lib/auth-preview-host.ts",
];

async function hashOf(relativePath) {
  const contents = await readFile(path.join(repoRoot, relativePath));
  return crypto.createHash("sha256").update(contents).digest("hex");
}

async function currentHashes() {
  const entries = await Promise.all(
    PROTECTED_FILES.map(async (file) => [file, await hashOf(file)]),
  );
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}

test("간편 로그인 보호 파일은 명시적 승인 없이 바뀌지 않는다", async () => {
  const actual = await currentHashes();

  if (process.env.UPDATE_PROTECTED_AUTH_MANIFEST === "1") {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(repoRoot, MANIFEST), `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`[protected-auth-guard] ${MANIFEST} 를 갱신했습니다. 이 변경을 커밋하세요.`);
    return;
  }

  const expected = JSON.parse(await readFile(path.join(repoRoot, MANIFEST), "utf8"));
  const changed = PROTECTED_FILES.filter((file) => expected[file] !== actual[file]);

  assert.deepEqual(
    changed,
    [],
    [
      "",
      "간편 로그인 보호 파일이 변경되었습니다:",
      ...changed.map((file) => `  - ${file}`),
      "",
      "이 변경을 사용자가 명시적으로 요청했습니까?",
      "  아니오 → 되돌리세요. 다른 작업의 곁다리로 로그인을 고치면 안 됩니다.",
      "           (간편로그인-수정금지-지침.md 참고 — 이 방식으로 반복해서 로그인이 죽었습니다)",
      "  예     → 아래를 실행하고 매니페스트 변경을 같은 PR 에 포함시키세요:",
      `           UPDATE_PROTECTED_AUTH_MANIFEST=1 node --test ${"tests/protected-auth-guard.test.mjs"}`,
      "",
    ].join("\n"),
  );
});

test("사전점검 스크립트의 provider 표가 실제 백엔드 설정과 어긋나지 않는다", async () => {
  // scripts/check-social-login-config.mjs 는 보호 파일을 수정하지 않으려고 provider
  // 요구사항을 자기 쪽에 따로 적어두고 있다. 그 사본이 낡으면 점검이 조용히 틀린
  // 답을 내므로, 원본(backend/social-oauth-config.js)과 대조해서 드리프트를 막는다.
  const source = await readFile(path.join(repoRoot, "backend/social-oauth-config.js"), "utf8");

  for (const entry of PROVIDER_ENV_REQUIREMENTS) {
    if (entry.provider === "google") continue; // Google 은 GIS 기반이라 이 파일에 없다.

    for (const envName of [...entry.startEnv, ...entry.callbackEnv]) {
      assert.ok(
        source.includes(envName),
        `${entry.provider}: 사전점검이 참조하는 ${envName} 가 backend/social-oauth-config.js 에 없습니다 — 둘 중 하나가 낡았습니다`,
      );
    }

    // 시크릿을 요구하는 provider 인데 사전점검이 callbackEnv 를 비워뒀다면, 시크릿
    // 누락을 못 잡는다 — 이번에 실제로 로그인이 죽은 원인이 바로 그 조합이다.
    const block = source.slice(source.indexOf(`${entry.provider}: {`));
    const requiresSecret = /requiresClientSecret:\s*true/.test(block.slice(0, block.indexOf("}")));
    if (requiresSecret) {
      assert.ok(
        entry.callbackEnv.length > 0,
        `${entry.provider}: requiresClientSecret 인데 사전점검에 callbackEnv 가 없습니다`,
      );
    }
  }
});
