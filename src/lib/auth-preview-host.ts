export function hostnameFromHostHeader(hostHeader: string | null, fallbackUrl: string) {
  const rawHost = (hostHeader || new URL(fallbackUrl).host).split(",")[0]?.trim().toLowerCase() ?? "";
  if (!rawHost) return "";
  if (rawHost.startsWith("[")) {
    const closingBracket = rawHost.indexOf("]");
    return closingBracket > 0 ? rawHost.slice(1, closingBracket) : rawHost;
  }

  try {
    return new URL(`http://${rawHost}`).hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  } catch {
    if (rawHost === "::1") return rawHost;
    if (rawHost.includes(":") && !rawHost.includes(".")) return rawHost;
    return rawHost.split(":")[0] ?? rawHost;
  }
}

export function isPrivatePreviewHostname(hostname: string) {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (octets[0] === 10) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  return octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

export function requestHostIsPrivatePreview(request: Request) {
  return isPrivatePreviewHostname(hostnameFromHostHeader(request.headers.get("host"), request.url));
}
