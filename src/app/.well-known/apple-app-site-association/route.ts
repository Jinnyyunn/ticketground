import { NextResponse } from "next/server";

// Universal Links (iOS) - iOS Android 앱 UI 개선 계획서.md §4 Phase 3 / the
// Phase 2 follow-up round's item 2. This file must be served at the fixed
// path `/.well-known/apple-app-site-association` (no extension) on the
// domain declared in the iOS app's Associated Domains entitlement
// (`applinks:ticketground.co.kr` - see
// ios/TicketGroundApp/TicketGroundApp/TicketGroundApp.{debug,release}.entitlements),
// with an `application/json` content type. `public/` won't reliably set
// that content type for an extensionless file, so this is a route handler
// instead of a static asset.
//
// APPLE_TEAM_ID is a placeholder. The checked-in Xcode project
// (ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj) does not
// set `DEVELOPMENT_TEAM` for either build configuration (CODE_SIGN_STYLE is
// Automatic with no team recorded in source control), so the real
// 10-character Apple Developer Team ID isn't resolvable from this repo.
// Universal Links will NOT resolve to the app until an operator replaces
// this with the real Team ID (Apple Developer -> Membership) - see the PR
// description for this round.
const APPLE_TEAM_ID = "TEAM_ID_PLACEHOLDER";
const BUNDLE_ID = "kr.ticketground.app";
const APP_ID = `${APPLE_TEAM_ID}.${BUNDLE_ID}`;

// Admin, seller and console surfaces are explicitly out of scope for the
// native apps (AGENTS.md / iOS Android 앱 UI 개선 계획서.md header), so
// links into those areas should keep opening in the browser instead of
// bouncing into the app.
const AASA = {
  applinks: {
    apps: [] as string[],
    details: [
      {
        appID: APP_ID,
        appIDs: [APP_ID],
        paths: ["NOT /admin/*", "NOT /console/*", "NOT /seller/*", "NOT /api/*", "NOT /auth/*", "/*"],
      },
    ],
  },
};

export function GET() {
  return NextResponse.json(AASA, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
