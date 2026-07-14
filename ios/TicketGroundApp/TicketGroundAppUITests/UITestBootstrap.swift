import XCTest

enum FixtureUIScenario: String {
    case happy
    case malformed
    case offline
    case unauthorized
    case empty

    var statusText: String {
        switch self {
        case .happy: return "상태: 준비됨"
        case .malformed: return "상태: 잘못된 링크"
        case .offline: return "상태: 오프라인"
        case .unauthorized: return "상태: 인증 필요"
        case .empty: return "상태: 데이터 없음"
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

    static func waitForHome(_ app: XCUIApplication) -> XCUIElement {
        let home = app.staticTexts["Ticketground"]
        XCTAssertTrue(home.waitForExistence(timeout: 30))
        return home
    }
}
