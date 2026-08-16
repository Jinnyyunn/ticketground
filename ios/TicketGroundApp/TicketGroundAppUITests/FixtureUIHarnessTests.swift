import XCTest

final class FixtureUIHarnessTests: XCTestCase {
    func testFixtureHappyScenario() {
        assertFixture(.happy)
    }

    func testFixtureMalformedScenario() {
        assertFixture(.malformed)
    }

    func testFixtureOfflineScenario() {
        assertFixture(.offline)
    }

    func testFixtureUnauthorizedScenario() {
        assertFixture(.unauthorized)
    }

    func testFixtureEmptyScenario() {
        assertFixture(.empty)
    }

    private func assertFixture(_ scenario: FixtureUIScenario, file: StaticString = #filePath, line: UInt = #line) {
        let app = UITestBootstrap.fixtureApp(scenario: scenario)
        XCTAssertTrue(app.launchArguments.contains("-ui-testing"), file: file, line: line)
        XCTAssertTrue(app.launchArguments.contains("fixture"), file: file, line: line)
        XCTAssertFalse(app.launchArguments.contains("live"), file: file, line: line)

        app.launch()
        _ = UITestBootstrap.waitForHome(app)
        XCTAssertTrue(app.staticTexts["Ticketground"].exists, file: file, line: line)
        switch scenario {
        case .happy:
            XCTAssertTrue(
                app.staticTexts["discovery-featured-title"].waitForExistence(timeout: 10),
                file: file,
                line: line
            )
        default:
            XCTAssertTrue(app.staticTexts[scenario.statusText].waitForExistence(timeout: 10), file: file, line: line)
        }
    }
}
