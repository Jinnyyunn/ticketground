import XCTest
@testable import TicketGroundApp

final class TicketGroundAppTests: XCTestCase {
    func testAppTargetLoads() {
        XCTAssertTrue(String(describing: ContentView.self).contains("ContentView"))
    }
}
