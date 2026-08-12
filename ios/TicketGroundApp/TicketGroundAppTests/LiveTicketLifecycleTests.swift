import XCTest
@testable import TicketGroundApp

final class LiveTicketLifecycleTests: XCTestCase {
    func test_cancellationAndResaleRequireAuthenticatedLifecycleContract() {
        XCTAssertEqual(AppRoute.cancel.classification.connectivity, .externalGate)
        XCTAssertEqual(AppRoute.resale.classification.connectivity, .externalGate)
        XCTAssertEqual(AppRoute.transfer.classification.connectivity, .intentionallyUnsupported)
    }

    func test_resalePriceMustStayInsideOwnedTicketBounds() {
        XCTAssertTrue(LiveLifecycleDisplay.acceptsResalePrice(88_000, minimum: 80_000, maximum: 100_000))
        XCTAssertFalse(LiveLifecycleDisplay.acceptsResalePrice(79_999, minimum: 80_000, maximum: 100_000))
        XCTAssertFalse(LiveLifecycleDisplay.acceptsResalePrice(100_001, minimum: 80_000, maximum: 100_000))
    }

    func test_admissionQRIsVisibleOnlyBeforeItsExpiry() {
        let now = Date(timeIntervalSince1970: 100)
        XCTAssertTrue(LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: "1970-01-01T00:02:00Z", now: now))
        XCTAssertFalse(LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: "1970-01-01T00:01:40Z", now: now))
        XCTAssertFalse(LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: "not-a-date", now: now))
    }
}
