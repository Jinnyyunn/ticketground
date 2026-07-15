import XCTest

final class DiscoveryTests: XCTestCase {
    func testHomeRankingAndOpenCalendar() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()

        XCTAssertTrue(app.staticTexts["콘서트"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["뮤지컬"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["전시"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["IU 2026 WORLD TOUR"].waitForExistence(timeout: 10))
        let heroTitle = app.staticTexts["discovery-featured-title"]
        XCTAssertTrue(heroTitle.waitForExistence(timeout: 10))
        XCTAssertGreaterThan(heroTitle.frame.height, 60)
        let homeCategory = app.buttons["discovery-category-home"]
        let concertCategory = app.buttons["discovery-category-concert"]
        XCTAssertEqual(homeCategory.value as? String, "selected")
        XCTAssertEqual(concertCategory.value as? String, "default")
        XCTAssertTrue(app.buttons["discovery-featured-cta"].waitForExistence(timeout: 10))
        let heroIndicator = app.staticTexts["discovery-hero-page-indicator"]
        XCTAssertTrue(heroIndicator.waitForExistence(timeout: 10))
        XCTAssertEqual(heroIndicator.label, "1 / 2")
        XCTAssertTrue(app.staticTexts["실시간 예매 랭킹 TOP10"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["티켓오픈 예정"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["바로가기"].waitForExistence(timeout: 10))
        assertDiscoverable(app.buttons["discovery-featured-cta"])
        assertDiscoverable(app.buttons["discovery-open-calendar"])
        assertDiscoverable(app.buttons["shortcut-open-calendar"])
        assertWithinHomeBounds(app)

        app.buttons["discovery-open-calendar"].tap()
        XCTAssertTrue(app.staticTexts["2026년 7월 월별 캘린더"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["오픈 임박"].exists)
    }

    func testEmptyDiscoveryFixture() {
        let app = UITestBootstrap.fixtureApp(scenario: .empty)
        app.launch()

        XCTAssertTrue(app.staticTexts["티켓오픈 일정이 없습니다."].waitForExistence(timeout: 10))
        assertDiscoverable(app.buttons["discovery-empty-action"])
        XCTAssertTrue(app.buttons["discovery-empty-action"].label.contains("홈"))
    }

    func testHeaderSearchNavigatesToFixtureSearch() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["header-search"].waitForExistence(timeout: 10))
        app.buttons["header-search"].tap()
        XCTAssertTrue(app.staticTexts["search-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.textFields["search-input"].exists)
        app.textFields["search-input"].tap()
        app.textFields["search-input"].typeText("IU")
        XCTAssertTrue(app.staticTexts["IU 2026 WORLD TOUR"].waitForExistence(timeout: 10))
    }

    func testHeaderLoginNavigatesToFixtureLogin() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["header-watchlist"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["header-watchlist"].isHittable)
        app.buttons["header-watchlist"].tap()
        XCTAssertTrue(app.staticTexts["login-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["login-google"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["login-kakao"].exists)
        XCTAssertTrue(app.buttons["login-naver"].exists)
        app.buttons["login-google"].tap()
        XCTAssertTrue(app.staticTexts["login-success"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Google fixture 로그인 완료"].exists)
    }

    func testHeaderMenuNavigatesToFixtureMenu() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["header-mypage"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["header-mypage"].isHittable)
        app.buttons["header-mypage"].tap()
        XCTAssertTrue(app.staticTexts["menu-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["menu-login"].exists)
        XCTAssertTrue(app.buttons["menu-signup"].exists)
        XCTAssertTrue(app.switches["menu-theme-toggle"].exists)
        XCTAssertTrue(app.buttons["menu-category-concert"].exists)
        XCTAssertTrue(app.buttons["menu-category-musical"].exists)
        XCTAssertTrue(app.buttons["menu-calendar"].exists)
        XCTAssertTrue(app.buttons["menu-help"].exists)
        XCTAssertTrue(app.buttons["menu-inquiry"].exists)
        app.buttons["menu-login"].tap()
        XCTAssertTrue(app.staticTexts["login-screen-title"].waitForExistence(timeout: 10))
    }

    func testBottomSearchTabNavigatesToFixtureSearch() {
        let app = UITestBootstrap.fixtureApp(scenario: .happy)
        app.launch()
        XCTAssertTrue(app.buttons["tab-search"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["tab-search"].isHittable)
        app.buttons["tab-search"].tap()
        XCTAssertTrue(app.staticTexts["search-screen-title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.textFields["search-input"].exists)
    }

    private func assertDiscoverable(_ element: XCUIElement, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: 10), file: file, line: line)
    }

    private func assertWithinHomeBounds(_ app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line) {
        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10), file: file, line: line)
        let identifiers = ["header-logo", "header-search", "discovery-hero-previous", "discovery-hero-next"]
        for identifier in identifiers {
            let element = app.descendants(matching: .any)[identifier]
            XCTAssertTrue(element.waitForExistence(timeout: 10), identifier, file: file, line: line)
            XCTAssertGreaterThanOrEqual(element.frame.minX, window.frame.minX + 4, identifier, file: file, line: line)
            XCTAssertLessThanOrEqual(element.frame.maxX, window.frame.maxX - 4, identifier, file: file, line: line)
        }
    }
}
