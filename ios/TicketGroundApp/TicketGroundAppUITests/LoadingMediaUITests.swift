import XCTest

final class LoadingMediaUITests: XCTestCase {
    func testLoadingUsesCenteredProgressWithoutVisibleLoadingProse() {
        let app = UITestBootstrap.fixtureApp(scenario: .loading)
        app.launch()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        XCTAssertTrue(anyElement(app, identifier: "state-loading").waitForExistence(timeout: 10))
        XCTAssertTrue(anyElement(app, identifier: "state-loading-progress").waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["공연 콘텐츠를 불러오는 중"].exists)
        XCTAssertFalse(app.staticTexts["상태: 불러오는 중"].exists)
    }

    func testEmptyErrorAndRetryStatesRemainDistinct() {
        let emptyApp = UITestBootstrap.fixtureApp(scenario: .empty)
        emptyApp.launch()
        XCTAssertTrue(anyElement(emptyApp, identifier: "state-empty").waitForExistence(timeout: 10))
        let emptyRetry = emptyApp.buttons["state-empty-action"]
        XCTAssertTrue(emptyRetry.waitForExistence(timeout: 10))
        XCTAssertEqual(emptyRetry.label, "다시 시도")
        XCTAssertTrue(emptyRetry.isEnabled)
        let retryCount = anyElement(emptyApp, identifier: "fixture-retry-count")
        XCTAssertEqual(retryCount.label, "재시도 요청 0회")
        emptyRetry.tap()
        XCTAssertTrue(waitForLabel("재시도 요청 1회", on: retryCount))
        emptyApp.terminate()

        let errorApp = UITestBootstrap.fixtureApp(scenario: .offline)
        errorApp.launch()
        XCTAssertTrue(anyElement(errorApp, identifier: "state-error").waitForExistence(timeout: 10))
        let errorRetry = errorApp.buttons["state-error-action"]
        XCTAssertTrue(errorRetry.waitForExistence(timeout: 10))
        XCTAssertEqual(errorRetry.label, "다시 시도")
        XCTAssertTrue(errorRetry.isEnabled)
    }

    func testOfflinePosterUsesAccessibleFallback() {
        let app = UITestBootstrap.fixtureApp(scenario: .mediaFallback)
        addUIInterruptionMonitor(withDescription: "Apple account confirmation") { alert in
            let notNow = alert.buttons["지금 안 함"].exists
                ? alert.buttons["지금 안 함"]
                : alert.buttons["Not Now"]
            guard notNow.exists else { return false }
            notNow.tap()
            return true
        }
        app.launch()
        app.tap()

        XCTAssertTrue(UITestBootstrap.waitForHome(app).exists)
        let fallback = anyElement(app, identifier: "media-fallback-poster")
        XCTAssertTrue(fallback.waitForExistence(timeout: 10))
        XCTAssertTrue(fallback.label.contains("포스터"))

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "offline-poster-fallback"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testSVGSeatMapRendersAndCorruptedSVGUsesFallback() {
        let validApp = UITestBootstrap.fixtureApp(scenario: .svgSeatMap)
        validApp.launch()
        XCTAssertTrue(anyElement(validApp, identifier: "media-seat-map").waitForExistence(timeout: 15))

        let renderedAttachment = XCTAttachment(screenshot: validApp.screenshot())
        renderedAttachment.name = "valid-svg-seat-map-rendered"
        renderedAttachment.lifetime = .keepAlways
        add(renderedAttachment)
        validApp.terminate()

        let corruptApp = UITestBootstrap.fixtureApp(scenario: .corruptSVGSeatMap)
        corruptApp.launch()
        let fallback = anyElement(corruptApp, identifier: "media-fallback-seat-map")
        XCTAssertTrue(fallback.waitForExistence(timeout: 15))
        XCTAssertTrue(fallback.label.contains("좌석 배치도 없음"))

        let attachment = XCTAttachment(screenshot: corruptApp.screenshot())
        attachment.name = "corrupt-svg-seat-map-fallback"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func anyElement(_ app: XCUIApplication, identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func waitForLabel(_ expected: String, on element: XCUIElement) -> Bool {
        let predicate = NSPredicate(format: "label == %@", expected)
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: element)
        return XCTWaiter.wait(for: [expectation], timeout: 10) == .completed
    }
}
