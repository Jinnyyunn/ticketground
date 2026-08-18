import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";

/**
 * Digital Asset Links statement list for Android App Links, served at
 * `/.well-known/assetlinks.json`. The Android app declares matching `autoVerify="true"` intent
 * filters for this domain (see android/TicketGroundApp/app/src/prodCustomer/AndroidManifest.xml
 * and .../devCustomer/AndroidManifest.xml) -- the OS fetches this file over HTTPS the first time
 * a matching app is installed/updated and only wires up App Links if a statement here matches
 * both the app's package name AND its signing certificate's SHA-256 fingerprint.
 *
 * IMPORTANT -- OPERATOR ACTION REQUIRED: the fingerprints below are placeholders and MUST be
 * replaced with the real signing certificate fingerprints before App Links will verify in
 * production. Do not ship a fabricated value; verification silently fails (falls back to an
 * ordinary disambiguation chooser) if the fingerprint doesn't match, it does not error loudly.
 *
 * To get the real value:
 *   - Play Console App Signing: Release > Setup > App integrity > App signing key certificate
 *     > "SHA-256 certificate fingerprint", OR
 *   - Locally: `keytool -list -v -keystore <release-keystore.jks> -alias <key-alias>` and read
 *     the "SHA256:" line under Certificate fingerprints.
 * Format as an uppercase, colon-separated hex string, e.g.
 *   "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5"
 */
const PROD_RELEASE_SHA256_FINGERPRINT_PLACEHOLDER =
  "REPLACE_ME_WITH_RELEASE_KEYSTORE_SHA256_FINGERPRINT";
const DEV_SIGNING_SHA256_FINGERPRINT_PLACEHOLDER =
  "REPLACE_ME_WITH_DEV_SIGNING_SHA256_FINGERPRINT";

export async function GET() {
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "kr.ticketground.app",
        sha256_cert_fingerprints: [PROD_RELEASE_SHA256_FINGERPRINT_PLACEHOLDER],
      },
    },
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "kr.ticketground.app.dev",
        sha256_cert_fingerprints: [DEV_SIGNING_SHA256_FINGERPRINT_PLACEHOLDER],
      },
    },
  ]);
}
