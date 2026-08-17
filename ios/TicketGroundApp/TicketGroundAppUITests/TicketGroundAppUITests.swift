import XCTest

final class TicketGroundAppUITests: XCTestCase {
    func testHomeScreenIsReady() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        XCTAssertTrue(app.buttons["tab-home"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["tab-home"].isSelected)
    }
}
