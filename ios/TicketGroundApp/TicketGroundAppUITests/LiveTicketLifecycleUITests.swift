import XCTest

final class LiveTicketLifecycleUITests: XCTestCase {
    func testHappyPathShowsOwnedReservationLifecycleActions() {
        let app = lifecycleApp(scenario: "happy", route: "reservation")
        app.launch()

        XCTAssertTrue(app.buttons["lifecycle-open-cancel"].waitForExistence(timeout: 20))
        XCTAssertGreaterThan(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "UI 테스트 콘서트")).count, 0)
        XCTAssertGreaterThan(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "VIP A1")).count, 0)
        XCTAssertTrue(app.buttons["lifecycle-open-cancel"].isHittable)
        XCTAssertTrue(app.buttons["lifecycle-open-resale"].isHittable)
        XCTAssertTrue(app.buttons["lifecycle-issue-qr"].exists)
    }

    func testSignedOutLifecycleFailsClosed() {
        let app = lifecycleApp(scenario: "signed-out", route: "reservation")
        app.launch()

        XCTAssertTrue(app.staticTexts["로그인이 필요합니다"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["로그인"].isHittable)
    }

    func testUnavailableCapabilityDoesNotExposeMutations() {
        let app = lifecycleApp(scenario: "unavailable", route: "resale")
        app.launch()

        XCTAssertTrue(app.staticTexts["기능을 사용할 수 없습니다"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.buttons["lifecycle-list-ticket"].exists)
    }

    func testExpiredAdmissionQRIsNeverRendered() {
        let app = lifecycleApp(scenario: "expired-qr", route: "reservation")
        app.launch()

        let issueButton = app.buttons["lifecycle-issue-qr"]
        XCTAssertTrue(issueButton.waitForExistence(timeout: 20))
        issueButton.tap()
        let expired = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "QR이 만료되었습니다")).firstMatch
        XCTAssertTrue(expired.waitForExistence(timeout: 20))
        XCTAssertFalse(app.images["lifecycle-admission-qr"].exists)
    }

    func testServerErrorOffersRetry() {
        let app = lifecycleApp(scenario: "server-error", route: "cancel")
        app.launch()

        XCTAssertTrue(app.staticTexts["요청을 완료할 수 없습니다"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["state-error-action"].isHittable)
    }

    private func lifecycleApp(scenario: String, route: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-ui-testing",
            "-api-mode", "live",
            "-live-lifecycle-scenario", scenario,
            "-live-lifecycle-route", route
        ]
        return app
    }
}
