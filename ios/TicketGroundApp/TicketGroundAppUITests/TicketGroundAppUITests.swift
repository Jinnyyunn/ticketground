import XCTest

final class TicketGroundAppUITests: XCTestCase {
    func testHomeScreenIsReady() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        XCTAssertTrue(app.tabBarButton("tab-home").waitForExistence(timeout: 10))
        XCTAssertTrue(app.tabBarButton("tab-home").isSelected)
    }
}
