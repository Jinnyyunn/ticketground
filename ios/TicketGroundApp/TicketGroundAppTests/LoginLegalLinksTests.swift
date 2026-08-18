import XCTest
@testable import TicketGroundApp

/// Regression coverage for the login footer's terms/privacy links.
///
/// `ticketground.co.kr` (the previous hardcoded destination) has no
/// DNS record — only an MX record for mail — so both links opened Safari
/// to a page that could never load. Confirmed live via `curl` (000 for
/// ticketground.co.kr and www., 200 for dev.ticketground.co.kr) and by
/// tapping through the login screen in the simulator.
final class LoginLegalLinksTests: XCTestCase {
    func testDerivesLinksFromConfiguredAPIHostWhenAvailable() {
        let baseURL = URL(string: "https://dev.ticketground.co.kr")!

        XCTAssertEqual(
            LoginLegalLinks.termsURL(baseURL: baseURL),
            URL(string: "https://dev.ticketground.co.kr/terms")!
        )
        XCTAssertEqual(
            LoginLegalLinks.privacyURL(baseURL: baseURL),
            URL(string: "https://dev.ticketground.co.kr/privacy")!
        )
    }

    func testNeverPointsAtTheUnreachableApexDomainWhenABaseURLIsConfigured() {
        let baseURL = URL(string: "https://dev.ticketground.co.kr")!

        XCTAssertNotEqual(LoginLegalLinks.termsURL(baseURL: baseURL).host, "ticketground.co.kr")
        XCTAssertNotEqual(LoginLegalLinks.privacyURL(baseURL: baseURL).host, "ticketground.co.kr")
    }

    func testFallsBackToThePreviousHardcodedURLWhenNoBaseURLIsConfigured() {
        // Fixture mode and the disabled-live-client state (no
        // TICKETGROUND_API_BASE_URL configured) have no base URL at all.
        // Falling back to the previous hardcoded URL keeps behavior
        // unchanged there rather than crashing or producing a relative URL.
        XCTAssertEqual(
            LoginLegalLinks.termsURL(baseURL: nil),
            URL(string: "https://ticketground.co.kr/terms")!
        )
        XCTAssertEqual(
            LoginLegalLinks.privacyURL(baseURL: nil),
            URL(string: "https://ticketground.co.kr/privacy")!
        )
    }
}
