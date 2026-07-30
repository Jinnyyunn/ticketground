import XCTest

final class TicketGroundAppUITests: XCTestCase {
    func testHomeScreenIsReady() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.navigationBars["홈"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Ticketground"].exists)
    }
}
