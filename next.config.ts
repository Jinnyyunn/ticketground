import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredDevOrigins = (process.env.TIG_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin): origin is string => origin.length > 0);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost", ...configuredDevOrigins],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
