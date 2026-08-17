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
        XCTAssertTrue(app.buttons["lifecycle-open-trusted-device"].exists)
        XCTAssertTrue(app.buttons["lifecycle-open-push-notifications"].exists)
        XCTAssertTrue(app.buttons["lifecycle-open-admission-qr"].exists)
    }

    func testTrustedDeviceExposesCanonicalStateSurface() {
        let app = lifecycleApp(scenario: "happy", route: "trusted-device")
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["live-lifecycle-trusted-device"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["lifecycle-revoke-device"].isHittable)
        XCTAssertFalse(app.buttons["lifecycle-open-cancel"].exists)
    }

    func testPushNotificationsExposeCanonicalStateSurface() {
        let app = lifecycleApp(scenario: "happy", route: "push-notifications")
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["live-lifecycle-push-notifications"].waitForExistence(timeout: 20))
        XCTAssertGreaterThan(app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "APNs 등록됨")).count, 0)
        XCTAssertFalse(app.buttons["lifecycle-open-cancel"].exists)
    }

    func testAdmissionQrExposesCanonicalStateSurface() {
        let app = lifecycleApp(scenario: "happy", route: "admission-qr")
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["live-lifecycle-admission-qr"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["lifecycle-issue-qr"].isHittable)
        XCTAssertFalse(app.buttons["lifecycle-open-cancel"].exists)
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
        let app = lifecycleApp(scenario: "expired-qr", route: "admission-qr")
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

    func testCancellationMutationReachesPendingReview() {
        let app = lifecycleApp(scenario: "happy", route: "cancel")
        app.launch()

        let reason = app.textFields["lifecycle-cancel-reason"]
        XCTAssertTrue(reason.waitForExistence(timeout: 20))
        reason.tap()
        reason.typeText("일정 변경")
        app.switches["lifecycle-refund-acknowledgement"].tap()
        let submit = app.buttons["lifecycle-submit-cancel"]
        XCTAssertTrue(submit.isEnabled)
        submit.tap()
        XCTAssertTrue(app.descendants(matching: .any)["lifecycle-cancellation-pending"].waitForExistence(timeout: 20))
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
