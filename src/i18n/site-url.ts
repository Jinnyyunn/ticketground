// Production/staging base URL is an operational decision (issue #108:
// TG_PRODUCTION_BASE_URL / TG_STAGING_BASE_URL are not yet provisioned),
// so this only fixes local dev/CI to the documented public-site port
// (PORTS.md: main -> PORT=5501) and otherwise defers to whatever ops
// sets via NEXT_PUBLIC_SITE_URL. Never hardcode a production domain here.
export function siteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5501");
}
