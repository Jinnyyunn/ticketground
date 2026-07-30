import Foundation

final class VirtualFixtureBundleMarker: NSObject {}

enum VirtualFixtureLoader {
    static func loadState() throws -> VirtualState {
        let fixture: FixtureEnvelope<StateDTO> = try load("state")
        return try VirtualFixtureMapper.state(fixture.body)
    }

    static func loadSeatMap() throws -> VirtualSeatMap {
        let fixture: FixtureEnvelope<SeatMapDTO> = try load("seat-map")
        return try VirtualFixtureMapper.seatMap(fixture.body)
    }

    static func loadSession() throws -> VirtualSession {
        let fixture: FixtureEnvelope<SessionDTO> = try load("session")
        return VirtualFixtureMapper.session(fixture.body)
    }

    static func loadTickets() throws -> [VirtualTicket] {
        let fixture: FixtureEnvelope<[TicketDTO]> = try load("tickets")
        return try fixture.body.map(VirtualFixtureMapper.ticket)
    }

    static func loadPurchase() throws -> VirtualPurchase {
        let fixture: FixtureEnvelope<PurchaseDTO> = try load("purchase")
        return try VirtualFixtureMapper.purchase(fixture.body)
    }

    static func loadVirtualQR() throws -> VirtualQR {
        let fixture: FixtureEnvelope<VirtualQRDTO> = try load("virtual-qr")
        return try VirtualFixtureMapper.virtualQR(fixture.body)
    }

    private static func load<Body: Decodable>(_ name: String) throws -> FixtureEnvelope<Body> {
        let bundles = [Bundle(for: VirtualFixtureBundleMarker.self), Bundle.main]
        guard let url = bundles.compactMap({ $0.url(forResource: name, withExtension: "json") }).first else {
            throw VirtualFixtureDecodeError.invalidResponse
        }
        let data = try Data(contentsOf: url)
        let fixture: FixtureEnvelope<Body> = try VirtualFixtureDecoder.decode(data, as: FixtureEnvelope<Body>.self)
        guard fixture.mode == "virtual", fixture.source == "fixture-only", fixture.live == false,
              fixture.deterministic, fixture.status == 200 else {
            throw VirtualFixtureDecodeError.invalidResponse
        }
        return fixture
    }
}
