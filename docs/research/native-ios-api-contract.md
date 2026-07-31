# Native iOS API contract: virtual fixture mode

Status: `virtual` / `fixture-only` / `non-live`

This manifest is a user-authorized substitute for live backend characterization because no separate backend is available in the iOS worktree. Its values are deterministic virtual values for Todo 3 model and decoding work. They are not observed backend responses, do not establish native authentication, and must never be presented as live availability or account state.

## Authorization and gates

- Authorization: explicit user override for fixture-only implementation on 2026-07-14.
- Owner sign-off: not provided. This document is not an owner-signoff receipt.
- Live characterization: blocked; the prior production/dev runtime receipts remain preserved under `.omo/evidence/native-ios/w0/2/blocked/`.
- Authentication: disabled in fixture mode. The `fixture-scenario` selector is the only transport switch.
- Persistence: bundled fixtures only. No request mutates a backend or shared database.
- Determinism: fixed clock `2026-07-13T00:00:00Z`, fixed seed label, and no randomness.

## Endpoint surface

| Method | Path | Fixture | Success shape | Auth |
| --- | --- | --- | --- | --- |
| GET | `/api/state` | `state.json` | raw object with events, venues, users, tickets, resalePools, summary, ledger | none |
| GET | `/api/events/{eventId}/seat-map` | `seat-map.json` | raw event/map/zones object | none |
| GET | `/api/users/{userId}/session` | `session.json` | raw user/authenticated/source object | none |
| GET | `/api/users/{userId}/tickets` | `tickets.json` | raw ticket array | none |
| POST | `/api/tickets/buy` | `purchase.json` | raw ticket/event/date/payment/admission object | none |
| POST | `/api/tickets/virtual-qr` | `virtual-qr.json` | raw virtual QR object | none |

`/api/state` intentionally includes `venues`, `users`, and ticket `virtualQr` as modeled fields. Nullable fields are explicit in the JSON manifest; additive fields are rejected unless an endpoint allowlist names them. The fixture manifest is the only source for Todo 3 fixture decoding in this mode.

## Negative probes

`negative-probes.json` records deterministic, non-live expectations for malformed JSON, unallowlisted keys, null required fields, empty responses, and unauthorized access. These are validation inputs, not claims that the virtual transport has contacted or characterized the backend.

## Consumption rule

Todo 3 may consume these fixtures only behind an explicit fixture-mode/data-source marker. A future live adapter requires a new authoritative characterization and real owner sign-off before it can be enabled.

## 별도 공개 탐색 계약

지역별 공연, 아티스트 공연, 티켓오픈 캘린더는 위 가상 fixture 계약에 포함하지 않는다. 이 세 화면은 실제 공개 카탈로그를 소비하는 버전 `1` 계약이며, 상세 정의는 `native-ios-discovery-api-v1.json`에 고정한다.

| Method | Path | 응답 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/discovery/v1/regions` | `version`, 지역별 공개 공연 그룹 | 없음 |
| GET | `/api/discovery/v1/artists/{slug}` | `version`, 아티스트 식별 정보와 공개 공연 | 없음 |
| GET | `/api/discovery/v1/open-calendar` | `version`, 공개 티켓오픈 일정 | 없음 |

저장된 공개 카탈로그가 유일한 공연 원본이다. iOS 클라이언트는 응답 버전이 `1`이 아니면 계약 오류로 처리하며, 로딩·빈 결과·아티스트 404·서버 오류·재시도 상태를 구분한다. 저장소 테스트와 `ios-native` CI는 내부 구현을 검증하지만 실제 공개 서버의 배포 및 TLS qualification은 별도 운영 증거가 필요하다.

기존 설치 앱과의 호환성을 유지하기 위해 `/api/health`의 호환성 버전은 `78b3c7c`를 유지한다. 신규 지역·아티스트·티켓오픈 탐색 경로는 `GET /api/discovery/v1/contract`가 버전 `1`과 `regions`, `artists`, `open-calendar`를 모두 광고한 경우에만 별도로 활성화한다. 이 경로가 없는 이전 서버에서도 기존 공연 목록은 계속 사용할 수 있고 신규 탐색 메뉴만 비활성 상태로 남는다.
