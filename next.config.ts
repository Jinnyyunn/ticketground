import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredDevOrigins = (process.env.TIG_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin): origin is string => origin.length > 0);

function localTailscaleDevOrigins(): string[] {
  const origins = new Set<string>();
  for (const items of Object.values(networkInterfaces())) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal && isTailscaleIpv4(item.address)) origins.add(item.address);
    }
  }
  return Array.from(origins);
}

function isTailscaleIpv4(address: string): boolean {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const first = octets[0];
  const second = octets[1];
  return first === 100 && second >= 64 && second <= 127;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", ...localTailscaleDevOrigins(), ...configuredDevOrigins],
  devIndicators: false,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
