#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/run-ios-sim-test.sh --runtime <runtime-id> --device-type <device-type-id> --evidence-dir <empty-dir> -- <command> [args...]

Creates a fresh simulator, replaces every xcodebuild destination selector with its device ID,
preflights result-bundle collisions, records xcodebuild.log and simulator.log, and deletes the
device in a cleanup trap even when the command fails.
USAGE
}

RUNTIME=""
DEVICE_TYPE=""
EVIDENCE_DIR=""
while (($# > 0)); do
  case "$1" in
    --runtime) RUNTIME="${2:?missing runtime value}"; shift 2 ;;
    --device-type) DEVICE_TYPE="${2:?missing device type value}"; shift 2 ;;
    --evidence-dir) EVIDENCE_DIR="${2:?missing evidence directory}"; shift 2 ;;
    --) shift; break ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$RUNTIME" || -z "$DEVICE_TYPE" || -z "$EVIDENCE_DIR" || $# -eq 0 ]]; then
  usage >&2
  exit 2
fi
mkdir -p "$EVIDENCE_DIR"
if find "$EVIDENCE_DIR" -mindepth 1 -print -quit | grep -q .; then
  echo "evidence directory must be empty: $EVIDENCE_DIR" >&2
  exit 2
fi

COMMAND=("$@")
RESULT_BUNDLES=()
for ((index = 0; index < ${#COMMAND[@]}; index += 1)); do
  if [[ "${COMMAND[$index]}" == "-resultBundlePath" ]]; then
    ((index += 1))
    [[ $index -lt ${#COMMAND[@]} ]] || { echo "-resultBundlePath needs a value" >&2; exit 2; }
    RESULT_BUNDLES+=("${COMMAND[$index]}")
  fi
done
if ((${#RESULT_BUNDLES[@]} > 0)); then
  for result_bundle in "${RESULT_BUNDLES[@]}"; do
    if [[ -e "$result_bundle" ]]; then
      echo "result bundle already exists: $result_bundle" >&2
      exit 2
    fi
  done
fi

DEVICE_ID=""
COMMAND_PID=""
APP_PATH=""
SIMULATOR_LOG="$EVIDENCE_DIR/simulator.log"
XCODEBUILD_LOG="$EVIDENCE_DIR/xcodebuild.log"
cleanup() {
  local exit_status=$?
  local cleanup_exit_status=$exit_status
  trap - EXIT INT TERM
  set +e
  if [[ -n "$COMMAND_PID" ]]; then
    wait "$COMMAND_PID" 2>/dev/null
  fi
  if [[ -n "$DEVICE_ID" ]]; then
    xcrun simctl terminate "$DEVICE_ID" kr.ticketground.app >/dev/null 2>&1
    xcrun simctl shutdown "$DEVICE_ID" >/dev/null 2>&1
    xcrun simctl delete "$DEVICE_ID" >/dev/null 2>&1
  fi
  if [[ -z "$APP_PATH" ]]; then
    APP_PATH=$(find "$EVIDENCE_DIR" -type d -name '*.app' -print -quit)
  fi
  local device_cleanup="incomplete"
  if [[ -n "$DEVICE_ID" ]] && ! xcrun simctl list devices | grep -q "$DEVICE_ID"; then
    device_cleanup="complete"
  else
    cleanup_exit_status=1
  fi
  {
    printf 'device-id=%s\n' "$DEVICE_ID"
    printf 'destination-id=%s\n' "$DEVICE_ID"
    printf 'app-path=%s\n' "$APP_PATH"
    printf 'device-cleanup=%s\n' "$device_cleanup"
  } > "$SIMULATOR_LOG"
  exit "$cleanup_exit_status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

DEVICE_ID=$(xcrun simctl create "TicketGround-iOS-${PPID}-$$" "$DEVICE_TYPE" "$RUNTIME")
xcrun simctl boot "$DEVICE_ID" >/dev/null
xcrun simctl bootstatus "$DEVICE_ID" -b >/dev/null

for ((index = 0; index < ${#COMMAND[@]}; index += 1)); do
  if [[ "${COMMAND[$index]}" == "-destination" && $((index + 1)) -lt ${#COMMAND[@]} ]]; then
    COMMAND[$((index + 1))]="id=$DEVICE_ID"
  fi
done

DERIVED_DATA="$EVIDENCE_DIR/DerivedData"
has_derived_data=0
for argument in "${COMMAND[@]}"; do
  [[ "$argument" == "-derivedDataPath" ]] && has_derived_data=1
done
if [[ "$has_derived_data" -eq 0 ]]; then
  COMMAND+=("-derivedDataPath" "$DERIVED_DATA")
fi

("${COMMAND[@]}" 2>&1 | tee "$XCODEBUILD_LOG") &
COMMAND_PID=$!
wait "$COMMAND_PID"
COMMAND_PID=""
APP_PATH=$(find "$DERIVED_DATA" -type d -name '*.app' -print -quit)
