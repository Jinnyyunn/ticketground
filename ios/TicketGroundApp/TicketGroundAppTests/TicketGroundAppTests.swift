import XCTest
@testable import TicketGroundApp

final class TicketGroundAppTests: XCTestCase {
    func testAppTargetLoads() {
        XCTAssertTrue(String(describing: ContentView.self).contains("ContentView"))
    }

    func testContentSizeOverrideIsLimitedToExplicitUITestValues() {
        XCTAssertNil(TicketGroundApp.requestedSizeCategory(environment: [:]))
        XCTAssertNil(TicketGroundApp.requestedSizeCategory(environment: [
            "TICKETGROUND_UI_CONTENT_SIZE": "large"
        ]))
        XCTAssertEqual(
            TicketGroundApp.requestedSizeCategory(environment: [
                "TICKETGROUND_UI_CONTENT_SIZE": "accessibilityExtraExtraExtraLarge"
            ]),
            .accessibilityExtraExtraExtraLarge
        )
    }
}
