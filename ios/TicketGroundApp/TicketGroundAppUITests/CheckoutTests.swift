import XCTest

// Verifies LiveCheckoutRouteView's own state machine (gate resolution, ticket/
// config loading, widget mounting) against the in-process scripted
// UITestCheckoutAPIClient. There is no native seat/ticket selection flow yet
// to reach .checkout(ticketId:) through in production, so these tests seed
// the route directly via -live-checkout-scenario (see AppContainer.
// liveCheckoutTest). Actually completing a real payment through the
// TossPayments widget requires a live sandbox account and is explicitly a
// manual testing concern (matches the web side's same scoping).
final class CheckoutTests: XCTestCase {
    private func checkoutApp(scenario: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-api-mode", "live", "-live-checkout-scenario", scenario]
        return app
    }

    private func anyElement(_ app: XCUIApplication, identifier: String) -> XCUIElement {
        app.descendants(matching: .any)[identifier]
    }

    func testLoggedOutShowsLoginRequiredGateWithoutLoadingTicketOrConfig() {
        let app = checkoutApp(scenario: "loggedOut")
        app.launch()
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-login-required").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-checkout-payment-method").exists)
    }

    func testHTTPBaseURLShowsHTTPSRequiredGate() {
        let app = checkoutApp(scenario: "httpsRequired")
        app.launch()
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-https-required").waitForExistence(timeout: 10))
    }

    func testReadyScenarioLoadsTicketAmountAndMountsThePaymentWidget() {
        let app = checkoutApp(scenario: "ready")
        app.launch()
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-amount").waitForExistence(timeout: 10))
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-payment-method").waitForExistence(timeout: 10))
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-agreement").waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["live-checkout-pay"].waitForExistence(timeout: 10))
    }

    func testNotConfiguredScenarioShowsAnErrorInsteadOfAnEmptyWidget() {
        let app = checkoutApp(scenario: "notConfigured")
        app.launch()
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-not-configured").waitForExistence(timeout: 10))
        XCTAssertFalse(anyElement(app, identifier: "live-checkout-payment-method").exists)
    }

    func testTicketNotFoundScenarioShowsAFailureStateInsteadOfHanging() {
        let app = checkoutApp(scenario: "ticketNotFound")
        app.launch()
        XCTAssertTrue(anyElement(app, identifier: "live-checkout-error").waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["선택한 티켓을 확인할 수 없습니다."].waitForExistence(timeout: 10))
    }
}
