import XCTest

final class SharedShellTests: XCTestCase {
    func testHeaderControlsExposeDistinctSearchLoginAndMenuActions() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        assertHittable(app.buttons["header-search"])
        assertHittable(app.buttons["header-login"])
        assertHittable(app.buttons["header-menu"])
        XCTAssertEqual(app.buttons["header-search"].label, "공연, 아티스트 또는 공연장 검색")
        XCTAssertEqual(app.buttons["header-login"].label, "로그인")
        XCTAssertEqual(app.buttons["header-menu"].label, "전체 메뉴")
        XCTAssertFalse(app.buttons["header-watchlist"].exists)
        XCTAssertFalse(app.buttons["header-mypage"].exists)
    }

    func testBottomNavigationRemainsReachable() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        assertHittable(app.tabBarButton("tab-home"))
        assertHittable(app.tabBarButton("tab-search"))
        assertHittable(app.tabBarButton("tab-watchlist"))
        assertHittable(app.tabBarButton("tab-mypage"))
    }

    func testBottomNavigationTabBarSurvivesSwitchingToAnotherTab() {
        // The whole point of Phase 2's migration to a native `TabView` (each
        // tab owning its own `NavigationStack`) was to fix the previous
        // custom `HStack` tab bar disappearing whenever a screen was pushed
        // - see `ContentView.swift`. Confirm the regression this was meant
        // to fix doesn't resurface: after switching to a non-Home tab, the
        // tab bar (all four tab buttons) must still be present and hittable,
        // not just immediately after launch on the Home tab.
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        assertHittable(app.tabBarButton("tab-search"))
        app.tabBarButton("tab-search").tap()
        XCTAssertTrue(app.staticTexts["search-screen-title"].waitForExistence(timeout: 10))
        assertHittable(app.tabBarButton("tab-home"))
        assertHittable(app.tabBarButton("tab-search"))
        assertHittable(app.tabBarButton("tab-watchlist"))
        assertHittable(app.tabBarButton("tab-mypage"))
    }

    func testLargeTextAndReducedMotion() {
        let app = UITestBootstrap.fixtureApp(scenario: .empty)
        app.launchArguments.append("-reduce-motion")
        app.launchEnvironment["TICKETGROUND_UI_CONTENT_SIZE"] = "accessibilityExtraExtraExtraLarge"
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        XCTAssertTrue(app.staticTexts["상태: 데이터 없음"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.otherElements["reduced-motion-safe"].waitForExistence(timeout: 10))
        assertHittable(app.tabBarButton("tab-home"))
        assertHittable(app.tabBarButton("tab-search"))
        assertHittable(app.tabBarButton("tab-watchlist"))
        assertHittable(app.tabBarButton("tab-mypage"))
    }

    private func assertHittable(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), file: file, line: line)
        XCTAssertTrue(element.isHittable, file: file, line: line)
    }
}
