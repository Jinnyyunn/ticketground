#!/usr/bin/env node
// 간편 로그인 배포 사전점검 (preflight). 런타임 동작은 전혀 바꾸지 않는 읽기 전용 점검이다.
//
// 왜 필요한가
// -----------
// /auth/social-config 의 `kakaoConfigured`/`naverConfigured` 는 **client ID 만** 보고
// 판정한다. 그런데 로그인을 실제로 "완료"하려면 backend/social-oauth-config.js 의
// providerConfig(..., "callback") 이 통과해야 하고, 그건 requiresClientSecret 인
// provider 에 대해 CLIENT SECRET 을 요구한다.
//
// 그래서 시크릿이 없으면 이렇게 된다:
//   버튼은 "준비됨"으로 보인다 → 누른다 → 카카오/네이버 로그인까지 정상 진행된다 →
//   우리 콜백으로 돌아온다 → `*_not_configured` 로 실패한다 → /login 으로 되돌아온다.
//   사용자 눈에는 "눌러도 아무 일도 안 일어난다".
//
// 이 실패는 조용하다. 화면 경고도 없다. 게다가 CLIENT SECRET 은 git 에 없는
// .env.local 에만 있으므로 **배포 체크아웃이 새로 생길 때마다 사라진다**
// (간편로그인-수정금지-지침.md 가 "비밀 값의 당연한 성질"이라고 적어둔 그것).
// 즉 코드를 한 줄도 안 고쳐도 재배포만으로 로그인이 죽을 수 있다 — 실제로 그렇게
// 반복해서 죽어왔다. 이 스크립트는 그 조용한 실패를 배포 시점에 시끄럽게 만든다.
//
// 사용법
//   node scripts/check-social-login-config.mjs            # 리포트만
//   node scripts/check-social-login-config.mjs --strict   # 미완성이면 exit 1 (배포 절차용)

import process from "node:process";

// 아래 표는 backend/social-oauth-config.js 의 PROVIDERS 를 그대로 반영한 것이다.
// 그 파일은 "간편 로그인 보호 파일"이라 이 점검을 위해 export 한 줄 추가하는 것조차
// 하지 않는다 (건드리지 않는 것 자체가 목적이므로). 대신 두 곳이 어긋나면
// tests/protected-auth-guard.test.mjs 가 실패시켜서 침묵하는 드리프트를 막는다.
export const PROVIDER_ENV_REQUIREMENTS = [
  {
    provider: "kakao",
    label: "카카오",
    // clientIdEnv 또는 legacyClientIdEnv 중 하나만 있으면 시작은 된다.
    startEnv: ["TIG_KAKAO_REST_API_KEY", "TIG_KAKAO_CLIENT_ID"],
    // requiresClientSecret: true — 단, TIG_KAKAO_CLIENT_SECRET_REQUIRED 를
    // 0/false/off 로 두면 면제된다 (카카오 콘솔에서 시크릿 기능을 끈 경우).
    callbackEnv: ["TIG_KAKAO_CLIENT_SECRET"],
    callbackExemptEnv: "TIG_KAKAO_CLIENT_SECRET_REQUIRED",
  },
  {
    provider: "naver",
    label: "네이버",
    startEnv: ["TIG_NAVER_CLIENT_ID"],
    // requiresClientSecret: true, 면제 스위치 없음.
    callbackEnv: ["TIG_NAVER_CLIENT_SECRET"],
    callbackExemptEnv: null,
  },
  {
    provider: "google",
    label: "구글",
    // Google 은 GIS(브라우저) 기반이라 OAuth client secret 을 쓰지 않는다. 대신
    // 브라우저 origin 허용목록이 관문이고, 여기 없으면 버튼이 에러 없이 조용히
    // 죽는다 (간편로그인-수정금지-지침.md §4 에 기록된 실제 사고).
    startEnv: ["TIG_GOOGLE_CLIENT_ID", "NEXT_PUBLIC_GOOGLE_CLIENT_ID"],
    callbackEnv: [],
    callbackExemptEnv: null,
    alsoRequired: ["NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS"],
  },
];

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function exempted(name) {
  if (!name) return false;
  const value = process.env[name]?.trim().toLowerCase();
  return value === "0" || value === "false" || value === "off";
}

export function evaluateProvider(entry) {
  const startOk = entry.startEnv.some(present) && (entry.alsoRequired ?? []).every(present);
  const callbackOk =
    entry.callbackEnv.length === 0 || exempted(entry.callbackExemptEnv) || entry.callbackEnv.some(present);

  const missing = [];
  if (!entry.startEnv.some(present)) missing.push(entry.startEnv.join(" 또는 "));
  for (const name of entry.alsoRequired ?? []) if (!present(name)) missing.push(name);
  if (!callbackOk) missing.push(entry.callbackEnv.join(" 또는 "));

  return { ...entry, startOk, callbackOk, missing };
}

function main() {
  const results = PROVIDER_ENV_REQUIREMENTS.map(evaluateProvider);
  const broken = results.filter((r) => !r.startOk || !r.callbackOk);

  console.log("간편 로그인 설정 점검\n");
  for (const r of results) {
    console.log(`  [${r.startOk && r.callbackOk ? "OK  " : "FAIL"}] ${r.label}`);
    if (!r.startOk) {
      console.log(`         · 로그인을 시작할 수 없음 — 없는 값: ${r.missing.join(", ")}`);
    } else if (!r.callbackOk) {
      // 가장 위험한 상태: 버튼은 멀쩡해 보이는데 돌아올 때 조용히 실패한다.
      console.log("         · 버튼은 동작하지만 로그인이 완료되지 않음 (콜백에서 *_not_configured)");
      console.log(`         · 없는 값: ${r.missing.join(", ")}`);
    }
  }

  if (broken.length === 0) {
    console.log("\n모든 provider 가 시작·완료 양쪽 모두 설정되어 있습니다.");
    return 0;
  }

  console.log(`\n${broken.length}개 provider 가 완전하지 않습니다.`);
  console.log("비밀 값은 .env.local 에 넣습니다 (git 미커밋 — .env.local.example 참고).");
  console.log("어떤 값을 어디에 넣는지는 간편로그인-수정금지-지침.md 의 '키 값 위치' 절 참고.");
  return process.argv.includes("--strict") ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
