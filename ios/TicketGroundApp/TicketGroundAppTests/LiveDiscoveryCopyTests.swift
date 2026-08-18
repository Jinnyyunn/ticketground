import XCTest
@testable import TicketGroundApp

/// Regression coverage for `LiveDiscoveryCopy`.
///
/// An exhaustive tap-through audit caught the genre listing's empty state
/// (e.g. tapping "스포츠" when there are no live sports events) literally
/// rendering "GET /api/catalog 결과에 표시할 공연이 없습니다." on screen -
/// a raw HTTP method and API path leaked straight into production,
/// user-facing copy. The same jargon ("GET /api/catalog", "POST endpoint",
/// "LiveBackendService", "공개 GET 범위", "backend contract"/"backend
/// capability") was also found in the catalog-unavailable screen, the
/// degraded home fallback, and the "회원가입" (signup) unsupported-route
/// screen reachable from the login screen.
final class LiveDiscoveryCopyTests: XCTestCase {
    /// Substrings that must never appear in end-user-facing copy: raw HTTP
    /// methods/paths and backend implementation jargon.
    private let forbiddenJargon = [
        "GET ", "POST ", "PUT ", "DELETE ", "/api/",
        "endpoint", "Endpoint",
        "LiveBackendService",
        "backend contract", "backend capability",
        "공개 GET", "GET contract",
        "mutation",
    ]

    private func assertNoJargon(_ text: String, file: StaticString = #filePath, line: UInt = #line) {
        for jargon in forbiddenJargon {
            XCTAssertFalse(
                text.contains(jargon),
                "Copy leaks backend jargon (\"\(jargon)\"): \"\(text)\"",
                file: file,
                line: line
            )
        }
    }

    func testStaticCopyHasNoBackendJargon() {
        assertNoJargon(LiveDiscoveryCopy.catalogEmpty)
        assertNoJargon(LiveDiscoveryCopy.catalogNotFound)
        assertNoJargon(LiveDiscoveryCopy.catalogUnavailableReason)
        assertNoJargon(LiveDiscoveryCopy.stateHomeConnectionLabel)
        assertNoJargon(LiveDiscoveryCopy.unsupportedRouteHeadline)
    }

    func testUnsupportedReasonHasNoBackendJargonForEveryRoute() {
        let routes: [AppRoute] = [
            .signup, .transfer, .cancel, .resale, .queue(slug: "s"),
            .booking(slug: "s"), .reservation(id: "r"), .artist(slug: "a"),
            .region, .open, .home, .menu, .watchlist,
        ]
        for route in routes {
            assertNoJargon(LiveDiscoveryCopy.unsupportedReason(for: route))
        }
    }

    func testCatalogEmptyMessageIsPlainLanguage() {
        // The exact regression: the genre/search/ranking empty state must
        // read as plain Korean, not an HTTP request description.
        XCTAssertEqual(LiveDiscoveryCopy.catalogEmpty, "표시할 공연이 없습니다.")
    }

    func testSignupReasonPointsUsersBackToSocialLogin() {
        // The app is social-login-only (Google/Kakao/Naver) - tapping
        // "회원가입" from the login screen should explain that, in plain
        // language, rather than describing a missing POST endpoint.
        let reason = LiveDiscoveryCopy.unsupportedReason(for: .signup)
        XCTAssertTrue(reason.contains("로그인"))
    }
}
