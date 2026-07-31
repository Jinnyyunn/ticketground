#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/wait-for-ios-ready.sh --device-id <uuid> --accessibility-id <identifier> --timeout <seconds> -- <semantic-probe> [args...]

Polls a semantic UI probe until the named accessibility identifier is ready or the
bounded timeout expires. The probe receives TICKETGROUND_ACCESSIBILITY_ID and must
return zero only when that identifier is present. No fixed sleep is used.
USAGE
}

DEVICE_ID=""
ACCESSIBILITY_ID=""
TIMEOUT=""
while (($# > 0)); do
  case "$1" in
    --device-id) DEVICE_ID="${2:?missing device id}"; shift 2 ;;
    --accessibility-id) ACCESSIBILITY_ID="${2:?missing accessibility identifier}"; shift 2 ;;
    --timeout) TIMEOUT="${2:?missing timeout}"; shift 2 ;;
    --) shift; break ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$DEVICE_ID" || -z "$ACCESSIBILITY_ID" || ! "$TIMEOUT" =~ ^[1-9][0-9]*$ || $# -eq 0 ]]; then
  usage >&2
  exit 2
fi

PROBE=("$@")
DEADLINE=$((SECONDS + TIMEOUT))
run_probe() {
  local probe_pid
  set -m
  TICKETGROUND_DEVICE_ID="$DEVICE_ID" TICKETGROUND_ACCESSIBILITY_ID="$ACCESSIBILITY_ID" "${PROBE[@]}" &
  probe_pid=$!
  set +m
  while kill -0 "$probe_pid" 2>/dev/null; do
    if ((SECONDS >= DEADLINE)); then
      kill -TERM -- "-$probe_pid" 2>/dev/null || kill -TERM "$probe_pid" 2>/dev/null
      for _ in $(seq 1 10); do
        kill -0 "$probe_pid" 2>/dev/null || break
        sleep 0.1
      done
      if kill -0 "$probe_pid" 2>/dev/null; then
        kill -KILL -- "-$probe_pid" 2>/dev/null || kill -KILL "$probe_pid" 2>/dev/null
      fi
      wait "$probe_pid" 2>/dev/null
      return 124
    fi
    sleep 0.1
  done
  wait "$probe_pid"
}

while :; do
  if run_probe; then
    printf 'ready-device=%s\nready-accessibility-id=%s\n' "$DEVICE_ID" "$ACCESSIBILITY_ID"
    exit 0
  fi
  if ((SECONDS >= DEADLINE)); then
    printf 'timed-out-device=%s\ntimed-out-accessibility-id=%s\n' "$DEVICE_ID" "$ACCESSIBILITY_ID" >&2
    exit 1
  fi
done
