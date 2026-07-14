import XCTest

final class SharedShellTests: XCTestCase {
    func testHeaderAndBottomNavigation() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        assertHittable(app.buttons["header-search"])
        assertHittable(app.buttons["header-watchlist"])
        assertHittable(app.buttons["header-mypage"])
        assertHittable(app.buttons["tab-home"])
        assertHittable(app.buttons["tab-search"])
        assertHittable(app.buttons["tab-watchlist"])
        assertHittable(app.buttons["tab-mypage"])
        XCTAssertTrue(app.buttons["header-search"].label.contains("검색"))
        XCTAssertTrue(app.buttons["header-watchlist"].label.contains("관심공연"))
        XCTAssertTrue(app.buttons["header-mypage"].label.contains("마이페이지"))
    }

    func testLargeTextAndReducedMotion() {
        let app = UITestBootstrap.fixtureApp(scenario: .empty)
        app.launchArguments.append("-reduce-motion")
        app.launchEnvironment["TICKETGROUND_UI_CONTENT_SIZE"] = "accessibilityExtraExtraExtraLarge"
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        XCTAssertTrue(app.staticTexts["상태: 데이터 없음"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.otherElements["reduced-motion-safe"].waitForExistence(timeout: 10))
        assertHittable(app.buttons["tab-home"])
        assertHittable(app.buttons["tab-search"])
        assertHittable(app.buttons["tab-watchlist"])
        assertHittable(app.buttons["tab-mypage"])
    }

    private func assertHittable(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), file: file, line: line)
        XCTAssertTrue(element.isHittable, file: file, line: line)
    }
}
