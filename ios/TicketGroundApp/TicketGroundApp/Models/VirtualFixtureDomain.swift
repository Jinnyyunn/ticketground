import Foundation

enum FixtureRecordSource: Equatable {
    case bundled
    case live
}

struct VirtualState: Equatable {
    let source: FixtureRecordSource
    let events: [VirtualEvent]
    let venues: [VirtualVenue]
    let users: [VirtualUser]
    let tickets: [VirtualTicket]
    let resalePools: Int
    let backendSummary: VirtualBackendSummary
    let ledger: VirtualLedger
}

struct VirtualEvent: Equatable {
    let id: String
    let title: String
    let category: String
    let venueId: String
    let startsAt: Date
    let saleStatus: SaleStatus
    let available: Bool
}

struct VirtualVenue: Equatable {
    let id: String
    let name: String
    let address: String
    let mapType: String
    let imageURL: String
}

struct VirtualUser: Equatable {
    let id: String
    let name: String
}

struct VirtualTicket: Equatable {
    let id: String
    let eventId: String
    let performanceDateId: String
    let zoneId: String
    let seatLabel: String
    let status: TicketStatus
    let available: Bool
    let faceValue: VirtualMoney
    let minPrice: VirtualMoney
    let maxPrice: VirtualMoney
    let transferCount: Int
    let maxTransferCount: Int
    let issuedAt: Date?
    let virtualQR: VirtualQRSummary?
}

struct VirtualQRSummary: Equatable {
    let type: String
    let issuedAt: Date
}

struct VirtualSeatMap: Equatable {
    let source: FixtureRecordSource
    let event: VirtualEventSummary
    let mapType: String
    let imageURL: String?
    let zones: [VirtualZone]
}

struct VirtualEventSummary: Equatable {
    let id: String
    let title: String
    let venue: String
}

struct VirtualZone: Equatable {
    let id: String
    let name: String
    let priceKRW: Int
    let seats: [VirtualSeat]
}

struct VirtualSeat: Equatable {
    let id: String
    let label: String
    let status: SeatStatus
    let holderId: String?
    let priceKRW: Int
}

struct VirtualSession: Equatable {
    let source: FixtureRecordSource
    let user: VirtualUser?
    let authenticated: Bool
    let sessionSource: String
}

struct VirtualPurchase: Equatable {
    let source: FixtureRecordSource
    let ticket: VirtualTicket
    let event: VirtualEventSummary
    let performanceDate: Date
    let payment: VirtualPayment
    let admission: VirtualAdmission
}

struct VirtualPayment: Equatable {
    let method: String
    let label: String
    let status: PaymentStatus
}

struct VirtualAdmission: Equatable {
    let status: String
    let preparedAt: Date
    let activeAt: Date?
    let activationChannel: String
    let riskStatus: String
}

struct VirtualQR: Equatable {
    let source: FixtureRecordSource
    let ticketId: String
    let type: String
    let issuedAt: Date
    let expiresAt: Date
    let status: VirtualQRStatus
}

struct VirtualBackendSummary: Equatable {
    let events: Int
    let tickets: Int
}

struct VirtualLedger: Equatable {
    let verified: Bool
    let totalEntries: Int
}

struct VirtualMoney: Equatable {
    let amountKRW: Int

    var displayCode: String { "KRW" }
}

enum SaleStatus: Equatable {
    case onSale
    case soldOut
    case unknown(rawValue: String)

    init(rawValue: String) {
        switch rawValue {
        case "ON_SALE": self = .onSale
        case "SOLD_OUT": self = .soldOut
        default: self = .unknown(rawValue: rawValue)
        }
    }
}

enum TicketStatus: Equatable {
    case onSale
    case sold
    case soldOut
    case unknown(rawValue: String)

    init(rawValue: String) {
        switch rawValue {
        case "ON_SALE": self = .onSale
        case "SOLD": self = .sold
        case "SOLD_OUT": self = .soldOut
        default: self = .unknown(rawValue: rawValue)
        }
    }
}

enum SeatStatus: Equatable {
    case onSale
    case soldOut
    case unknown(rawValue: String)

    init(rawValue: String) {
        switch rawValue {
        case "ON_SALE": self = .onSale
        case "SOLD_OUT": self = .soldOut
        default: self = .unknown(rawValue: rawValue)
        }
    }
}

enum PaymentStatus: Equatable {
    case paid
    case unknown(rawValue: String)

    init(rawValue: String) {
        self = rawValue == "PAID" ? .paid : .unknown(rawValue: rawValue)
    }
}

enum VirtualQRStatus: Equatable {
    case fixtureOnly
    case unknown(rawValue: String)

    init(rawValue: String) {
        self = rawValue == "fixture-only" ? .fixtureOnly : .unknown(rawValue: rawValue)
    }
}
