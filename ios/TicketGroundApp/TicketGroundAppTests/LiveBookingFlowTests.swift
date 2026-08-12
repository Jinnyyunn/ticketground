import XCTest
@testable import TicketGroundApp

final class LiveBookingFlowTests: XCTestCase {
    func test_bookingRoutesRequireAuthenticatedContract_whenNativeBookingIsAvailable() {
        // Given: the three native booking destinations.
        let routes: [AppRoute] = [
            .queue(slug: "show"),
            .booking(slug: "show"),
            .reservation(id: "draft")
        ]

        // When: their connectivity is classified.
        let connectivity = routes.map(\.classification.connectivity)

        // Then: each route is an authenticated external contract, not an unsupported screen.
        XCTAssertEqual(connectivity, [.externalGate, .externalGate, .externalGate])
    }

    func test_seatMapAdmissionAcceptsPerformanceFilter_whenEventWasDiagnosed() {
        // Given: a diagnosed event seat-map contract.
        let admission = LiveSeatMapAdmission(
            eventID: "event-1",
            performanceDateID: "performance-1"
        )

        // When: the same event is requested for a concrete performance.
        let matches = admission.matches(eventID: "event-1", performanceDateID: "performance-1")

        // Then: the service may load the performance-specific inventory.
        XCTAssertTrue(matches)
        XCTAssertFalse(admission.matches(eventID: "event-1", performanceDateID: "performance-2"))
    }

    func test_directTransferRemainsBlocked_whenOfficialResaleIsTheOnlyAllowedPolicy() {
        // Given: the directed-transfer destination.
        let route = AppRoute.transfer

        // When: its connectivity is classified.
        let classification = route.classification

        // Then: the app does not present directed person-to-person transfer as supported.
        XCTAssertEqual(classification.connectivity, .intentionallyUnsupported)
    }
}
