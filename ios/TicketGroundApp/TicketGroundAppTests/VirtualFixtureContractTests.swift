import Foundation
import XCTest
@testable import TicketGroundApp

final class VirtualFixtureContractTests: XCTestCase {
    func testSuccessFixturesDecodeIntoTypedDomainModels() throws {
        let state = try VirtualFixtureLoader.loadState()
        let seatMap = try VirtualFixtureLoader.loadSeatMap()
        let session = try VirtualFixtureLoader.loadSession()
        let tickets = try VirtualFixtureLoader.loadTickets()
        let purchase = try VirtualFixtureLoader.loadPurchase()
        let virtualQR = try VirtualFixtureLoader.loadVirtualQR()

        XCTAssertEqual(state.source, .bundled)
        XCTAssertEqual(state.events.first?.id, "virtual-event-001")
        XCTAssertEqual(seatMap.zones.first?.seats.first?.priceKRW, 99_000)
        XCTAssertEqual(session.user?.id, "virtual-user-001")
        XCTAssertEqual(tickets.first?.status, .onSale)
        XCTAssertEqual(purchase.payment.status, .paid)
        XCTAssertEqual(virtualQR.status, .fixtureOnly)
    }

    func testMoneyDateAndUnknownEnumAreDeterministic() throws {
        let money = try VirtualMoneyDecoder.decodeKRW(99_000)
        XCTAssertEqual(money.amountKRW, 99_000)
        XCTAssertEqual(money.displayCode, "KRW")

        let date = try VirtualFixtureDateParser.parse("2026-08-01T19:00:00+09:00")
        let utc = ISO8601DateFormatter()
        utc.timeZone = TimeZone(secondsFromGMT: 0)
        XCTAssertEqual(utc.string(from: date), "2026-08-01T10:00:00Z")
        XCTAssertEqual(TicketStatus(rawValue: "future-status"), .unknown(rawValue: "future-status"))
    }

    func testNegativeProbesMapToFixtureOnlyErrors() throws {
        XCTAssertThrowsError(try VirtualFixtureDecoder.decode(Data("{".utf8), as: FixtureEnvelope<StateDTO>.self)) { error in
            XCTAssertEqual(error as? VirtualFixtureDecodeError, .malformedJSON)
        }
        XCTAssertThrowsError(try VirtualFixtureDecoder.decode(Data("{\"unexpected\":true}".utf8), as: FixtureEnvelope<StateDTO>.self)) { error in
            XCTAssertEqual(error as? VirtualFixtureDecodeError, .unknownKey("unexpected"))
        }
        XCTAssertThrowsError(try VirtualFixtureDecoder.decode(Data("{\"body\":null}".utf8), as: FixtureEnvelope<StateDTO>.self)) { error in
            XCTAssertEqual(error as? VirtualFixtureDecodeError, .nullRequiredField("body"))
        }
        XCTAssertThrowsError(try VirtualFixtureDecoder.decode(Data("".utf8), as: FixtureEnvelope<StateDTO>.self)) { error in
            XCTAssertEqual(error as? VirtualFixtureDecodeError, .emptyResponse)
        }
        XCTAssertThrowsError(try VirtualFixtureDecoder.decodeUnauthorized()) { error in
            XCTAssertEqual(error as? VirtualFixtureDecodeError, .unauthorized)
        }
    }
}
