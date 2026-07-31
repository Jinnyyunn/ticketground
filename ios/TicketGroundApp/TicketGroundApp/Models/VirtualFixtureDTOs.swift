import Foundation

struct FixtureEnvelope<Body: Decodable>: Decodable {
    let contractId: String
    let fixtureId: String
    let mode: String
    let source: String
    let live: Bool
    let deterministic: Bool
    let status: Int
    let body: Body
}

struct StateDTO: Decodable {
    let events: [EventDTO]
    let venues: [VenueDTO]
    let users: [UserDTO]
    let tickets: [TicketDTO]
    let resalePools: [ResalePoolDTO]
    let backendSummary: BackendSummaryDTO
    let ledger: LedgerDTO
}

struct EventDTO: Decodable {
    let id: String
    let title: String
    let category: String
    let venueId: String
    let startsAt: String
    let sale: SaleDTO
}

struct EventSummaryDTO: Decodable {
    let id: String
    let title: String
    let venue: String
}

struct SaleDTO: Decodable {
    let status: String
    let available: Bool
}

struct VenueDTO: Decodable {
    let id: String
    let name: String
    let address: String
    let mapType: String
    let imageUrl: String
}

struct UserDTO: Decodable {
    let id: String
    let name: String
}

struct TicketDTO: Decodable {
    let id: String
    let eventId: String
    let performanceDateId: String
    let zoneId: String
    let seatLabel: String
    let status: String
    let available: Bool
    let faceValue: Int
    let minPrice: Int
    let maxPrice: Int
    let transferCount: Int
    let maxTransferCount: Int
    let issuedAt: String?
    let virtualQr: TicketVirtualQRDTO?
}

struct TicketVirtualQRDTO: Decodable {
    let type: String
    let issuedAt: String
}

struct SeatMapDTO: Decodable {
    let event: EventSummaryDTO
    let map: MapDTO
    let zones: [ZoneDTO]
}

struct MapDTO: Decodable {
    let type: String
    let imageUrl: String?
}

struct ZoneDTO: Decodable {
    let id: String
    let name: String
    let price: Int
    let seats: [SeatDTO]
}

struct SeatDTO: Decodable {
    let id: String
    let label: String
    let status: String
    let holderId: String?
}

struct SessionDTO: Decodable {
    let user: UserDTO?
    let authenticated: Bool
    let source: String
}

struct PurchaseDTO: Decodable {
    let ticket: TicketDTO
    let event: EventSummaryDTO
    let performanceDate: String
    let payment: PaymentDTO
    let admission: AdmissionDTO
}

struct PaymentDTO: Decodable {
    let method: String
    let label: String
    let status: String
}

struct AdmissionDTO: Decodable {
    let status: String
    let preparedAt: String
    let activeAt: String?
    let activationChannel: String
    let riskStatus: String
}

struct VirtualQRDTO: Decodable {
    let ticketId: String
    let type: String
    let issuedAt: String
    let expiresAt: String
    let status: String
}

struct ResalePoolDTO: Decodable {}

struct BackendSummaryDTO: Decodable {
    let events: Int
    let tickets: Int
}

struct LedgerDTO: Decodable {
    let verified: Bool
    let totalEntries: Int
}
