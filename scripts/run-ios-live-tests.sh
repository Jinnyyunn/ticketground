#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

usage() {
  cat <<'USAGE'
Usage: scripts/run-ios-live-tests.sh --project <xcodeproj> --scheme <scheme> --destination <logical destination> --test-only <selector> --evidence-dir <empty-dir> [--backend-root <backend-root>] [--seed-db <db.json>] [--runtime <runtime-id>] [--device-type <device-type-id>] [--fail-after-server-start]

Runs one isolated backend integration XCTest selector. The host wrapper owns node
server.js, a temporary TIG_DB_PATH, fixed TIG_NOW, ephemeral public/admin ports,
health polling, /tmp/ticketground-ios-<pid>/api-environment.json, fresh simulator
ID substitution, xcodebuild/result/log capture, DB-hash verification, PID/port
postconditions, and trap cleanup. --fail-after-server-start is an intentional
negative probe that exits nonzero only after the server and fresh simulator exist.
USAGE
}

PROJECT=""
SCHEME=""
DESTINATION=""
TEST_ONLY=""
EVIDENCE_DIR=""
BACKEND_ROOT="${TICKETGROUND_IOS_BACKEND_ROOT:-$REPO_ROOT}"
SEED_DB="${TICKETGROUND_IOS_SEED_DB:-}"
RUNTIME="${TICKETGROUND_IOS_RUNTIME:-com.apple.CoreSimulator.SimRuntime.iOS-26-5}"
DEVICE_TYPE="${TICKETGROUND_IOS_DEVICE_TYPE:-com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro}"
READINESS_ATTEMPTS="${TICKETGROUND_IOS_READINESS_ATTEMPTS:-240}"
READINESS_DELAY_SECONDS="${TICKETGROUND_IOS_READINESS_DELAY_SECONDS:-0.1}"
FAIL_AFTER_SERVER_START=0
while (($# > 0)); do
  case "$1" in
    --project) PROJECT="${2:?missing project}"; shift 2 ;;
    --scheme) SCHEME="${2:?missing scheme}"; shift 2 ;;
    --destination) DESTINATION="${2:?missing destination}"; shift 2 ;;
    --test-only) TEST_ONLY="${2:?missing test selector}"; shift 2 ;;
    --evidence-dir) EVIDENCE_DIR="${2:?missing evidence directory}"; shift 2 ;;
    --backend-root) BACKEND_ROOT="${2:?missing backend root}"; shift 2 ;;
    --seed-db) SEED_DB="${2:?missing seed database}"; shift 2 ;;
    --runtime) RUNTIME="${2:?missing runtime}"; shift 2 ;;
    --device-type) DEVICE_TYPE="${2:?missing device type}"; shift 2 ;;
    --fail-after-server-start) FAIL_AFTER_SERVER_START=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$PROJECT" || -z "$SCHEME" || -z "$DESTINATION" || -z "$TEST_ONLY" || -z "$EVIDENCE_DIR" ]]; then
  usage >&2
  exit 2
fi
if [[ "$TEST_ONLY" == -only-testing:* ]]; then
  TEST_ONLY="${TEST_ONLY#-only-testing:}"
fi
if [[ ! -e "$PROJECT" ]]; then
  echo "project does not exist: $PROJECT" >&2
  exit 2
fi
if [[ ! -f "$BACKEND_ROOT/server.js" ]]; then
  echo "backend runtime is missing under $BACKEND_ROOT" >&2
  exit 2
fi
if [[ ! -d "$BACKEND_ROOT/node_modules" ]]; then
  echo "backend runtime dependencies are missing under $BACKEND_ROOT/node_modules" >&2
  exit 2
fi
if [[ -n "$SEED_DB" && ! -f "$SEED_DB" ]]; then
  echo "seed database is missing: $SEED_DB" >&2
  exit 2
fi
if [[ ! "$READINESS_ATTEMPTS" =~ ^[1-9][0-9]*$ ]]; then
  echo "readiness attempts must be a positive integer" >&2
  exit 2
fi
mkdir -p "$EVIDENCE_DIR"
if find "$EVIDENCE_DIR" -mindepth 1 -print -quit | grep -q .; then
  echo "evidence directory must be empty: $EVIDENCE_DIR" >&2
  exit 2
fi
for artifact in TicketGroundApp.xcresult xcodebuild.log simulator.log api-environment.json; do
  if [[ -e "$EVIDENCE_DIR/$artifact" ]]; then
    echo "evidence artifact already exists: $EVIDENCE_DIR/$artifact" >&2
    exit 2
  fi
done

if [[ "$DESTINATION" != *iPhone* || "$DESTINATION" != *iOS* ]]; then
  echo "unsupported destination; expected an iPhone iOS simulator selector: $DESTINATION" >&2
  exit 2
fi

free_port() {
  node -e 'const net=require("node:net"); const server=net.createServer(); server.unref(); server.listen(0,"127.0.0.1",()=>{const address=server.address(); server.close(()=>process.stdout.write(String(address.port)));});'
}

sha256_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

wait_for_http() {
  local url="$1"
  shift
  local curl_args=()
  if (($# > 0)); then
    curl_args=("$@")
  fi
  for attempt in $(seq 1 "$READINESS_ATTEMPTS"); do
    if ((${#curl_args[@]} > 0)); then
      if curl --silent --show-error --fail --max-time 1 "${curl_args[@]}" "$url" >/dev/null; then
        return 0
      fi
    elif curl --silent --show-error --fail --max-time 1 "$url" >/dev/null; then
      return 0
    fi
    if ((attempt < READINESS_ATTEMPTS)); then
      sleep "$READINESS_DELAY_SECONDS"
    fi
  done
  return 1
}

RUN_DIR="/tmp/ticketground-ios-$$"
if [[ -e "$RUN_DIR" ]]; then
  echo "stale run directory exists: $RUN_DIR" >&2
  exit 2
fi
mkdir "$RUN_DIR"
TEMP_DB_DIR="$RUN_DIR/db"
mkdir "$TEMP_DB_DIR"
TEMP_DB="$TEMP_DB_DIR/db.json"
PUBLIC_PORT=$(free_port)
ADMIN_PORT=$(free_port)
if [[ "$PUBLIC_PORT" == "$ADMIN_PORT" ]]; then
  echo "ephemeral port collision" >&2
  exit 2
fi
FIXED_NOW="2026-07-13T00:00:00Z"
RUN_ID="todo5-$$"
PUBLIC_URL="http://127.0.0.1:$PUBLIC_PORT"
ADMIN_URL="http://127.0.0.1:$ADMIN_PORT"
ADMIN_TOKEN="todo5-admin-token-$$"
SERVER_LOG="$RUN_DIR/server.log"
ENV_FILE="$RUN_DIR/api-environment.json"
SHARED_DB="$SEED_DB"
SHARED_DB_HASH_BEFORE=""
if [[ -n "$SHARED_DB" ]]; then
  SHARED_DB_HASH_BEFORE=$(sha256_file "$SHARED_DB")
fi
DEVICE_ID=""
SERVER_PID=""
TEST_STATUS=0
SIM_LOG="$EVIDENCE_DIR/simulator.log"
XCODEBUILD_LOG="$EVIDENCE_DIR/xcodebuild.log"

cleanup() {
  local exit_status=$?
  set +e
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill -TERM "$SERVER_PID" 2>/dev/null
    for _ in $(seq 1 100); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
    done
    kill -KILL "$SERVER_PID" 2>/dev/null
  fi
  if [[ -n "$DEVICE_ID" ]]; then
    xcrun simctl terminate "$DEVICE_ID" kr.ticketground.app >/dev/null 2>&1
    xcrun simctl shutdown "$DEVICE_ID" >/dev/null 2>&1
    xcrun simctl delete "$DEVICE_ID" >/dev/null 2>&1
  fi
  if [[ -f "$SERVER_LOG" ]]; then
    cp "$SERVER_LOG" "$EVIDENCE_DIR/backend.log"
  fi
  if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "$EVIDENCE_DIR/api-environment.json"
  fi
  local hash_marker="not-provided"
  if [[ -n "$SHARED_DB" ]]; then
    local shared_db_hash_after
    shared_db_hash_after=$(sha256_file "$SHARED_DB")
    hash_marker="changed"
    [[ "$SHARED_DB_HASH_BEFORE" == "$shared_db_hash_after" ]] && hash_marker="unchanged"
  fi
  local device_marker="incomplete"
  [[ -n "$DEVICE_ID" ]] && ! xcrun simctl list devices | grep -q "$DEVICE_ID" && device_marker="complete"
  local port_marker="complete"
  for port in "$PUBLIC_PORT" "$ADMIN_PORT"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | grep -q LISTEN; then
      port_marker="incomplete"
    fi
  done
  {
    printf 'backend-root=%s\n' "$BACKEND_ROOT"
    printf 'seed-db=%s\n' "$SHARED_DB"
    printf 'device-id=%s\n' "$DEVICE_ID"
    printf 'destination-id=%s\n' "$DEVICE_ID"
    printf 'child-pid=%s\n' "$SERVER_PID"
    printf 'public-port=%s\n' "$PUBLIC_PORT"
    printf 'admin-port=%s\n' "$ADMIN_PORT"
    printf 'temp-db=%s\n' "$TEMP_DB"
    printf 'shared-db-hash=%s\n' "$hash_marker"
    printf 'device-cleanup=%s\n' "$device_marker"
    printf 'port-cleanup=%s\n' "$port_marker"
    printf 'cleanup=complete\n'
  } | tee -a "$SIM_LOG"
  rm -rf "$RUN_DIR"
  return "$exit_status"
}
trap cleanup EXIT INT TERM

if [[ -n "$SHARED_DB" ]]; then
  cp "$SHARED_DB" "$TEMP_DB"
fi
printf 'backend-root=%s\nseed-db=%s\n' "$BACKEND_ROOT" "${SHARED_DB:-generated-isolated}" | tee -a "$SIM_LOG"

(cd "$BACKEND_ROOT" && TIG_NEXT_DEV=1 HOSTNAME=127.0.0.1 ADMIN_HOSTNAME=127.0.0.1 PORT="$PUBLIC_PORT" ADMIN_PORT="$ADMIN_PORT" \
  TIG_ADMIN_TOKEN="$ADMIN_TOKEN" TIG_DB_PATH="$TEMP_DB" TIG_NOW="$FIXED_NOW" \
  TIG_SECRET="todo5-secret-$$" TIG_PORTONE_IDENTITY_TEST_MODE=1 \
  exec node server.js) >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
printf 'child-pid=%s\npublic-port=%s\nadmin-port=%s\ntemp-db=%s\n' "$SERVER_PID" "$PUBLIC_PORT" "$ADMIN_PORT" "$TEMP_DB" | tee "$SIM_LOG"
wait_for_http "$PUBLIC_URL/api/state"
wait_for_http "$ADMIN_URL/api/state" -H "x-tig-admin-token: $ADMIN_TOKEN"

RUN_ID="$RUN_ID" PUBLIC_URL="$PUBLIC_URL" ADMIN_URL="$ADMIN_URL" FIXED_NOW="$FIXED_NOW" \
  PUBLIC_PORT="$PUBLIC_PORT" ADMIN_PORT="$ADMIN_PORT" TEMP_DB="$TEMP_DB" ENV_FILE="$ENV_FILE" \
  node -e 'const fs=require("node:fs"); const e={runID:process.env.RUN_ID,publicBaseURL:process.env.PUBLIC_URL,adminBaseURL:process.env.ADMIN_URL,fixedClock:process.env.FIXED_NOW,publicPort:Number(process.env.PUBLIC_PORT),adminPort:Number(process.env.ADMIN_PORT),tempDatabase:process.env.TEMP_DB}; fs.writeFileSync(process.env.ENV_FILE,JSON.stringify(e,null,2)+"\n");'

DEVICE_ID=$(xcrun simctl create "TicketGround-Todo5-$$" "$DEVICE_TYPE" "$RUNTIME")
xcrun simctl boot "$DEVICE_ID" >/dev/null
xcrun simctl bootstatus "$DEVICE_ID" -b >/dev/null
printf 'device-id=%s\ndestination-id=%s\n' "$DEVICE_ID" "$DEVICE_ID" | tee -a "$SIM_LOG"

if ((FAIL_AFTER_SERVER_START)); then
  printf 'expected-failure=post-server-start\n' | tee -a "$SIM_LOG"
  exit 1
fi

RESULT_BUNDLE="$EVIDENCE_DIR/TicketGroundApp.xcresult"
inject_test_environment() {
  local xctestrun="$1"
  local environment_json
  local target_name
  local target_count=0
  local environment_path
  environment_json=$(cat "$ENV_FILE")

  local target_names
  target_names=$(plutil -convert json -o - "$xctestrun" | node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const plist = JSON.parse(input);
      for (const [key, value] of Object.entries(plist)) {
        if (key !== "__xctestrun_metadata__" && value && typeof value.BlueprintName === "string") {
          process.stdout.write(`${key}\n`);
        }
      }
    });
  ')

  while IFS= read -r target_name; do
    [[ -z "$target_name" ]] && continue
    target_count=$((target_count + 1))
    environment_path="${target_name}.EnvironmentVariables"
    if ! plutil -type "$environment_path" "$xctestrun" >/dev/null 2>&1; then
      plutil -insert "$environment_path" -dictionary "$xctestrun"
    fi
    if ! plutil -replace "${environment_path}.TICKETGROUND_API_ENVIRONMENT_FILE" -string "$ENV_FILE" "$xctestrun" >/dev/null 2>&1; then
      plutil -insert "${environment_path}.TICKETGROUND_API_ENVIRONMENT_FILE" -string "$ENV_FILE" "$xctestrun"
    fi
    if ! plutil -replace "${environment_path}.TICKETGROUND_API_ENVIRONMENT_JSON" -string "$environment_json" "$xctestrun" >/dev/null 2>&1; then
      plutil -insert "${environment_path}.TICKETGROUND_API_ENVIRONMENT_JSON" -string "$environment_json" "$xctestrun"
    fi
  done <<EOF
$target_names
EOF

  if ((target_count == 0)); then
    echo "xctestrun has no test targets: $xctestrun" >&2
    return 1
  fi
}

set +e
xcodebuild -project "$PROJECT" -scheme "$SCHEME" -sdk iphonesimulator \
  -destination "id=$DEVICE_ID" build-for-testing \
  -derivedDataPath "$EVIDENCE_DIR/DerivedData" 2>&1 | tee "$XCODEBUILD_LOG"
BUILD_STATUS=${PIPESTATUS[0]}
set -e
if ((BUILD_STATUS != 0)); then
  exit "$BUILD_STATUS"
fi

XCTESTRUN=$(find "$EVIDENCE_DIR/DerivedData/Build/Products" -maxdepth 1 -name '*.xctestrun' -print -quit)
if [[ -z "$XCTESTRUN" ]]; then
  echo "xctestrun file was not generated under $EVIDENCE_DIR/DerivedData/Build/Products" >&2
  exit 1
fi
inject_test_environment "$XCTESTRUN"

set +e
xcodebuild -xctestrun "$XCTESTRUN" -sdk iphonesimulator \
  -destination "id=$DEVICE_ID" test-without-building -only-testing:"$TEST_ONLY" \
  -resultBundlePath "$RESULT_BUNDLE" -derivedDataPath "$EVIDENCE_DIR/DerivedData" 2>&1 | tee -a "$XCODEBUILD_LOG"
TEST_STATUS=${PIPESTATUS[0]}
set -e
exit "$TEST_STATUS"
