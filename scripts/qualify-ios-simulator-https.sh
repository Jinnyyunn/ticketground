#!/usr/bin/env bash
set -euo pipefail

port=""
udid=""
bundle_id=""
evidence_dir=""
app_path=""

while (($#)); do
  case "$1" in
    --port) port="${2:-}"; shift 2 ;;
    --udid) udid="${2:-}"; shift 2 ;;
    --bundle-id) bundle_id="${2:-}"; shift 2 ;;
    --evidence-dir) evidence_dir="${2:-}"; shift 2 ;;
    --app-path) app_path="${2:-}"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$port" || -z "$udid" || -z "$bundle_id" || -z "$evidence_dir" ]]; then
  echo "required: --port --udid --bundle-id --evidence-dir [--app-path]" >&2
  exit 2
fi

if ! curl --fail --silent --show-error "http://127.0.0.1:${port}/api/health" >/dev/null; then
  echo "local server health check failed" >&2
  exit 1
fi

mkdir -p "$evidence_dir"
runtime_dir="$(mktemp -d)"
tunnel_pid=""

cleanup() {
  xcrun simctl terminate "$udid" "$bundle_id" >/dev/null 2>&1 || true
  if [[ -n "$tunnel_pid" ]]; then kill "$tunnel_pid" >/dev/null 2>&1 || true; fi
  rm -rf "$runtime_dir"
}
trap cleanup EXIT

cloudflared tunnel --url "http://127.0.0.1:${port}" --no-autoupdate >"${runtime_dir}/tunnel.log" 2>&1 &
tunnel_pid=$!
tunnel_url=""
for _ in {1..60}; do
  tunnel_url="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "${runtime_dir}/tunnel.log" | head -1 || true)"
  [[ -n "$tunnel_url" ]] && break
  kill -0 "$tunnel_pid" >/dev/null 2>&1 || { echo "Cloudflare tunnel exited early" >&2; exit 1; }
  sleep 0.5
done
[[ -n "$tunnel_url" ]] || { echo "Cloudflare HTTPS origin was not issued" >&2; exit 1; }
tunnel_host="${tunnel_url#https://}"
edge_ip=""
for _ in {1..30}; do
  edge_ip="$(curl --fail --silent --show-error "https://cloudflare-dns.com/dns-query?name=${tunnel_host}&type=A" -H 'accept: application/dns-json' 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s).Answer?.find(x=>x.type===1)?.data||"";process.stdout.write(a)}catch{}})' || true)"
  [[ -n "$edge_ip" ]] && break
  sleep 1
done
curl_resolve=()
if [[ -n "$edge_ip" ]]; then curl_resolve=(--resolve "${tunnel_host}:443:${edge_ip}"); fi

curl "${curl_resolve[@]}" --retry 20 --retry-all-errors --retry-delay 1 --fail --silent --show-error "${tunnel_url}/api/health" >"${evidence_dir}/health.json"
curl "${curl_resolve[@]}" --retry 5 --retry-all-errors --retry-delay 1 --fail --silent --show-error "${tunnel_url}/api/native/v1/contract" >"${evidence_dir}/native-contract.json"

if [[ -n "${TIG_QUALIFICATION_BEARER:-}" ]]; then
  status="$(curl "${curl_resolve[@]}" --retry 5 --retry-all-errors --retry-delay 1 --silent --output /dev/null --write-out '%{http_code}' -H "Authorization: Bearer ${TIG_QUALIFICATION_BEARER}" "${tunnel_url}/api/me/profile")"
  printf '{"endpoint":"/api/me/profile","authenticated":true,"status":%s}\n' "$status" >"${evidence_dir}/authenticated-profile-receipt.json"
fi

if [[ -n "$app_path" ]]; then
  xcrun simctl install "$udid" "$app_path"
  SIMCTL_CHILD_TICKETGROUND_API_BASE_URL="$tunnel_url" SIMCTL_CHILD_TICKETGROUND_ASSET_BASE_URL="$tunnel_url" xcrun simctl launch --terminate-running-process "$udid" "$bundle_id" >/dev/null
  sleep 2
  xcrun simctl io "$udid" screenshot "${evidence_dir}/simulator-https.png" >/dev/null
fi

printf '{"https":true,"health":200,"nativeContract":200,"urlPersisted":false}\n' >"${evidence_dir}/qualification-receipt.json"
