import XCTest

enum FixtureUIScenario: String {
    case happy
    case loading
    case malformed
    case offline
    case unauthorized
    case empty
    case mediaFallback
    case svgSeatMap
    case corruptSVGSeatMap

    var statusText: String {
        switch self {
        case .happy: return "상태: 준비됨"
        case .loading: return "상태: 불러오는 중"
        case .malformed: return "상태: 잘못된 링크"
        case .offline: return "상태: 오프라인"
        case .unauthorized: return "상태: 인증 필요"
        case .empty: return "상태: 데이터 없음"
        case .mediaFallback: return "상태: 미디어 없음"
        case .svgSeatMap: return "상태: SVG 좌석 배치도"
        case .corruptSVGSeatMap: return "상태: 손상된 SVG 좌석 배치도"
        }
    }
}

enum UITestBootstrap {
    static func fixtureApp(scenario: FixtureUIScenario) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-ui-testing",
            "-api-mode", "fixture",
            "-fixture-scenario", scenario.rawValue
        ]
        return app
    }

    static func liveApp(apiBaseURL: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-api-mode", "live"]
        app.launchEnvironment["TICKETGROUND_API_BASE_URL"] = apiBaseURL
        app.launchEnvironment["TICKETGROUND_ASSET_BASE_URL"] = apiBaseURL
        return app
    }

    static func waitForHome(_ app: XCUIApplication) -> XCUIElement {
        let home = app.staticTexts["Ticketground"]
        XCTAssertTrue(home.waitForExistence(timeout: 30))
        return home
    }
}

extension XCUIApplication {
    /// The four primary tabs, left to right - matches `TicketgroundTab.allCases`
    /// (`ContentView`'s `TabView`) in the app target.
    private static let tabBarIdentifierOrder = ["tab-home", "tab-search", "tab-watchlist", "tab-mypage"]

    /// Looks up a bottom tab bar button by its `tab-home` / `tab-search` /
    /// `tab-watchlist` / `tab-mypage` accessibility identifier, falling back to
    /// a position-based lookup within `tabBars` when the identifier hasn't
    /// resolved.
    ///
    /// This is a long-standing UIKit/XCUITest limitation on iPhone-style tab
    /// bars (not something app code can force synchronously): a
    /// `.accessibilityIdentifier` set on the `Label` inside SwiftUI's
    /// `.tabItem` bridges to the underlying `UITabBarItem` asynchronously,
    /// and a tab bar re-layout (triggered by a push/pop within a tab, or by
    /// switching tabs) can transiently drop it until the next SwiftUI
    /// re-render reattaches it. The button is still on screen with the
    /// correct label the whole time - only the *identifier* lookup is
    /// unreliable - so falling back to position within `tabBars.buttons`
    /// (which iPhone always renders as a single `tabBars` element, one
    /// button per tab, in tab order) finds the same button deterministically.
    func tabBarButton(_ identifier: String, timeout: TimeInterval = 5) -> XCUIElement {
        let byIdentifier = buttons[identifier].firstMatch
        if byIdentifier.waitForExistence(timeout: timeout) {
            return byIdentifier
        }
        guard let index = Self.tabBarIdentifierOrder.firstIndex(of: identifier) else {
            return byIdentifier
        }
        return tabBars.buttons.element(boundBy: index)
    }
}
