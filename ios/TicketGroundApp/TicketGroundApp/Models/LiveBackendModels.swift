import Foundation

enum LiveAPIEndpointAccess: Equatable {
    case publicRead
    case authenticatedRead
    case mutation
}

enum LiveAPIEndpoint: Hashable {
    case health
    case state
    case catalog
    case regions
    case artist
    case openCalendar
    case publicSupport
    case seatMap
    case session
    case tickets
    case watchlist
    case supportThreads
    case supportThreadMutation
    case supportMessages
    case watchlistMutation
    case watchlistNotification
    case watchlistUpsert
    case watchlistDelete
    case ticketPurchase
    case googleAuthentication
    case identityStart
    case identityConfirm
    case deviceTrust
    case pushToken
    case ticketQR
    case virtualQR
    case queueEntryEnter
    case queueEntryStatus
    case queueEntryLeave
    case seatHoldCreate
    case seatHoldStatus
    case seatHoldExtend
    case seatHoldRelease
    case reservationDraftCreate
    case reservationDraftStatus
    case reservationDraftCancel
    case unknown(method: APIRequestMethod, path: String)

    static let known: [LiveAPIEndpoint] = [
        .health,
        .state,
        .catalog,
        .regions,
        .artist,
        .openCalendar,
        .publicSupport,
        .seatMap,
        .session,
        .tickets,
        .watchlist,
        .supportThreads,
        .supportThreadMutation,
        .supportMessages,
        .watchlistMutation,
        .watchlistNotification,
        .watchlistUpsert,
        .watchlistDelete,
        .ticketPurchase,
        .googleAuthentication,
        .identityStart,
        .identityConfirm,
        .deviceTrust,
        .pushToken,
        .ticketQR,
        .virtualQR,
        .queueEntryEnter,
        .queueEntryStatus,
        .queueEntryLeave,
        .seatHoldCreate,
        .seatHoldStatus,
        .seatHoldExtend,
        .seatHoldRelease,
        .reservationDraftCreate,
        .reservationDraftStatus,
        .reservationDraftCancel
    ]

    var method: APIRequestMethod {
        switch self {
        case .watchlistUpsert:
            return .put
        case .watchlistDelete, .queueEntryLeave, .seatHoldRelease, .reservationDraftCancel:
            return .delete
        case .supportThreadMutation, .supportMessages, .watchlistMutation,
             .watchlistNotification, .ticketPurchase, .googleAuthentication,
             .identityStart, .identityConfirm, .deviceTrust, .pushToken,
             .ticketQR, .virtualQR, .queueEntryEnter, .seatHoldCreate,
             .reservationDraftCreate:
            return .post
        case .seatHoldExtend:
            return .patch
        case .unknown(let method, _):
            return method
        case .health, .state, .catalog, .regions, .artist, .openCalendar,
             .publicSupport, .seatMap, .session, .tickets, .watchlist, .supportThreads,
             .queueEntryStatus, .seatHoldStatus, .reservationDraftStatus:
            return .get
        }
    }

    var pathTemplate: String {
        switch self {
        case .health: return "/api/health"
        case .state: return "/api/state"
        case .catalog: return "/api/catalog"
        case .regions: return "/api/discovery/v1/regions"
        case .artist: return "/api/discovery/v1/artists/{slug}"
        case .openCalendar: return "/api/discovery/v1/open-calendar"
        case .publicSupport: return "/api/support/public"
        case .seatMap: return "/api/seat-map?eventId={eventId}"
        case .session: return "/api/me"
        case .tickets: return "/api/me/tickets"
        case .watchlist: return "/api/me/watchlist"
        case .supportThreads: return "/api/me/support/threads"
        case .supportThreadMutation: return "/api/me/support/threads"
        case .supportMessages: return "/api/me/support/messages"
        case .watchlistMutation: return "/api/watchlist"
        case .watchlistNotification: return "/api/watchlist/notify"
        case .watchlistUpsert: return "/api/me/watchlist/{eventId}"
        case .watchlistDelete: return "/api/me/watchlist/{eventId}"
        case .ticketPurchase: return "/api/tickets/buy"
        case .googleAuthentication: return "/api/auth/google"
        case .identityStart: return "/api/identity/portone-danal/start"
        case .identityConfirm: return "/api/identity/portone-danal/confirm"
        case .deviceTrust: return "/api/devices/trust"
        case .pushToken: return "/api/devices/push-token"
        case .ticketQR: return "/api/tickets/qr"
        case .virtualQR: return "/api/tickets/virtual-qr"
        case .queueEntryEnter: return "/api/me/queue-entries"
        case .queueEntryStatus: return "/api/me/queue-entries/{entryId}"
        case .queueEntryLeave: return "/api/me/queue-entries/{entryId}"
        case .seatHoldCreate: return "/api/me/seat-holds"
        case .seatHoldStatus: return "/api/me/seat-holds/{holdId}"
        case .seatHoldExtend: return "/api/me/seat-holds/{holdId}/extend"
        case .seatHoldRelease: return "/api/me/seat-holds/{holdId}"
        case .reservationDraftCreate: return "/api/me/reservation-drafts"
        case .reservationDraftStatus: return "/api/me/reservation-drafts/{draftId}"
        case .reservationDraftCancel: return "/api/me/reservation-drafts/{draftId}"
        case .unknown(_, let path): return path
        }
    }

    var access: LiveAPIEndpointAccess {
        switch self {
        case .health, .state, .catalog, .regions, .artist, .openCalendar, .publicSupport, .seatMap:
            return .publicRead
        case .session, .tickets, .watchlist, .supportThreads,
             .queueEntryStatus, .seatHoldStatus, .reservationDraftStatus:
            return .authenticatedRead
        case .supportThreadMutation, .supportMessages, .watchlistMutation,
             .watchlistNotification, .ticketPurchase, .googleAuthentication,
             .identityStart, .identityConfirm, .deviceTrust, .pushToken,
             .ticketQR, .virtualQR, .watchlistUpsert, .watchlistDelete,
             .queueEntryEnter, .queueEntryLeave, .seatHoldCreate, .seatHoldExtend,
             .seatHoldRelease, .reservationDraftCreate, .reservationDraftCancel:
            return .mutation
        case .unknown:
            return .mutation
        }
    }
}

enum LiveCapabilityBlockReason: Equatable {
    case requiresHTTPS
    case serverAuthorizationUnverified
    case unsupportedMutation
}

enum LiveCapabilityState: Equatable {
    case available
    case blocked(LiveCapabilityBlockReason)
    case unknown
    case incompatible(expected: String, observed: String)
}

enum LiveContractCompatibility: Equatable {
    case unknown
    case compatible
    case incompatible(expected: String, observed: String)
}

struct LiveAPIContractDiagnostics: Equatable {
    let expectedResponseVersion: String
    let observedResponseVersion: String?

    var compatibility: LiveContractCompatibility {
        guard let observedResponseVersion else { return .unknown }
        guard observedResponseVersion == expectedResponseVersion else {
            return .incompatible(expected: expectedResponseVersion, observed: observedResponseVersion)
        }
        return .compatible
    }
}

struct LiveAPIHealth: Decodable, Equatable {
    let status: String?
    let time: String?
    let version: String?
    let capabilities: [String]?
}

struct LiveCapabilityMap: Equatable {
    let diagnostics: LiveAPIContractDiagnostics
    let baseURL: URL
    let states: [LiveAPIEndpoint: LiveCapabilityState]

    func state(for endpoint: LiveAPIEndpoint) -> LiveCapabilityState {
        states[endpoint] ?? .unknown
    }
}

struct LiveAPIContractProbe: Equatable {
    let diagnostics: LiveAPIContractDiagnostics
    let capabilities: LiveCapabilityMap
}

struct LiveSeatMapAdmission: Equatable {
    let eventID: String

    func matches(eventID: String, performanceDateID: String?) -> Bool {
        self.eventID == eventID && performanceDateID == nil
    }
}

struct LiveAPIContract {
    let expectedResponseVersion: String
    let publicHost: URL
    let bootstrapPath: String = "/api/health"

    static let deployed = LiveAPIContract(
        expectedResponseVersion: "78b3c7c",
        publicHost: URL(string: "http://132.145.109.87:4174")!
    )

    func capabilityMap(
        for baseURL: URL,
        observedResponseVersion: String?,
        provenPublicEndpoints: Set<LiveAPIEndpoint> = [],
        validatedStateResponse: Bool = false,
        catalogRouteConfirmed: Bool = false,
        nativeAccountRoutesConfirmed: Bool = false,
        nativeSupportRoutesConfirmed: Bool = false,
        nativeWatchlistRoutesConfirmed: Bool = false,
        nativeBookingHoldsRoutesConfirmed: Bool = false
    ) -> LiveCapabilityMap {
        var provenPublicEndpoints = provenPublicEndpoints
        if validatedStateResponse {
            provenPublicEndpoints.insert(.state)
        }
        if catalogRouteConfirmed {
            provenPublicEndpoints.insert(.catalog)
        }
        let diagnostics = LiveAPIContractDiagnostics(
            expectedResponseVersion: expectedResponseVersion,
            observedResponseVersion: observedResponseVersion
        )
        let states = Dictionary(uniqueKeysWithValues: LiveAPIEndpoint.known.map { endpoint in
            (
                endpoint,
                state(
                    for: endpoint,
                    baseURL: baseURL,
                    diagnostics: diagnostics,
                    provenPublicEndpoints: provenPublicEndpoints,
                    nativeAccountRoutesConfirmed: nativeAccountRoutesConfirmed,
                    nativeSupportRoutesConfirmed: nativeSupportRoutesConfirmed,
                    nativeWatchlistRoutesConfirmed: nativeWatchlistRoutesConfirmed,
                    nativeBookingHoldsRoutesConfirmed: nativeBookingHoldsRoutesConfirmed
                )
            )
        })
        return LiveCapabilityMap(diagnostics: diagnostics, baseURL: baseURL, states: states)
    }

    private func state(
        for endpoint: LiveAPIEndpoint,
        baseURL: URL,
        diagnostics: LiveAPIContractDiagnostics,
        provenPublicEndpoints: Set<LiveAPIEndpoint>,
        nativeAccountRoutesConfirmed: Bool,
        nativeSupportRoutesConfirmed: Bool,
        nativeWatchlistRoutesConfirmed: Bool,
        nativeBookingHoldsRoutesConfirmed: Bool
    ) -> LiveCapabilityState {
        switch diagnostics.compatibility {
        case .unknown:
            return endpoint.access == .publicRead && provenPublicEndpoints.contains(endpoint)
                ? .available
                : .unknown
        case .incompatible(let expected, let observed):
            return .incompatible(expected: expected, observed: observed)
        case .compatible:
            guard ![.state, .catalog, .seatMap, .regions, .artist, .openCalendar].contains(endpoint)
                || provenPublicEndpoints.contains(endpoint) else {
                return .unknown
            }
            guard endpoint != .publicSupport || nativeSupportRoutesConfirmed else {
                return .unknown
            }
            switch endpoint.access {
            case .publicRead:
                return .available
            case .authenticatedRead:
                guard baseURL.scheme?.lowercased() == "https" else {
                    return .blocked(.requiresHTTPS)
                }
                if nativeAccountRoutesConfirmed && [.session, .tickets].contains(endpoint) {
                    return .available
                }
                if nativeWatchlistRoutesConfirmed && endpoint == .watchlist {
                    return .available
                }
                if nativeBookingHoldsRoutesConfirmed
                    && [.queueEntryStatus, .seatHoldStatus, .reservationDraftStatus].contains(endpoint) {
                    return .available
                }
                return nativeSupportRoutesConfirmed && endpoint == .supportThreads
                    ? .available
                    : .blocked(.serverAuthorizationUnverified)
            case .mutation:
                guard baseURL.scheme?.lowercased() == "https" else {
                    return .blocked(.requiresHTTPS)
                }
                if nativeSupportRoutesConfirmed && [.supportThreadMutation, .supportMessages].contains(endpoint) {
                    return .available
                }
                if nativeWatchlistRoutesConfirmed && [.watchlistUpsert, .watchlistDelete].contains(endpoint) {
                    return .available
                }
                if nativeBookingHoldsRoutesConfirmed && [
                    .queueEntryEnter, .queueEntryLeave, .seatHoldCreate, .seatHoldExtend,
                    .seatHoldRelease, .reservationDraftCreate, .reservationDraftCancel
                ].contains(endpoint) {
                    return .available
                }
                return .blocked(.unsupportedMutation)
            }
        }
    }
}

struct LiveState: Decodable, Equatable {
    let events: [LiveStateEvent]
    let venues: [LiveVenue]
    let users: [LiveUser]
    let tickets: [LiveTicket]?
    let resalePools: [LiveResalePool]
    let backendSummary: LiveBackendSummary
    let ledger: LiveLedger
}

struct LiveStateEvent: Decodable, Equatable {
    let id: String
    let title: String
    let venue: String?
    let venueId: String
    let category: String
    let saleState: String
    let sale: LiveSaleSummary
}

struct LiveSaleSummary: Decodable, Equatable {
    let state: String
    let label: String
    let note: String?
    let discountRate: Int?
    let displayPrice: Int?
    let basePrice: Int?
    let bookable: Bool
}

struct LiveVenue: Decodable, Equatable {
    let id: String
    let name: String
    let address: String
    let mapType: String?
    let imageUrl: String?
}

struct LiveUser: Decodable, Equatable {
    let id: String
    let name: String
}

struct LiveBackendSummary: Decodable, Equatable {
    let events: Int
    let tickets: Int
}

struct LiveLedger: Decodable, Equatable {
    let verified: Bool
    let totalEntries: Int
}

struct LiveCatalog: Decodable, Equatable {
    let events: [LiveBackendCatalogEvent]
    let venues: [LiveCatalogVenue]?
    let nextCursor: String?
    let total: Int?
}

enum LiveCatalogReadPolicy {
    static let defaultLimit = 50
    static let maximumLimit = 100
    static let maximumPages = 20

    static func accepts(limit: Int) -> Bool {
        (1...maximumLimit).contains(limit)
    }
}

protocol LiveDiscoveryVersioned {
    var version: String { get }
}

struct LiveDiscoveryContractStatus: Decodable, Equatable, LiveDiscoveryVersioned {
    let version: String
    let endpoints: [String]
}

struct LiveRegionDiscovery: Decodable, Equatable, LiveDiscoveryVersioned {
    let version: String
    let regions: [LiveRegionGroup]
}

struct LiveRegionGroup: Decodable, Equatable {
    let slug: String
    let name: String
    let eventCount: Int
    let events: [LiveBackendCatalogEvent]
}

struct LiveArtistDiscovery: Decodable, Equatable, LiveDiscoveryVersioned {
    let version: String
    let artist: LiveArtistIdentity
    let events: [LiveBackendCatalogEvent]
}

struct LiveArtistIdentity: Decodable, Equatable {
    let slug: String
    let name: String
}

struct LiveOpenCalendar: Decodable, Equatable, LiveDiscoveryVersioned {
    let version: String
    let entries: [LiveOpenCalendarEntry]
}

struct LiveOpenCalendarEntry: Decodable, Equatable {
    let opensAt: String
    let saleState: String?
    let event: LiveBackendCatalogEvent
}

struct LiveCatalogVenue: Decodable, Equatable {
    let id: String
    let name: String
    let address: String?
    let mapType: String?
    let imageURL: String?

    enum CodingKeys: String, CodingKey {
        case id, name, address, mapType
        case imageURL = "imageUrl"
    }
}

struct LiveBackendCatalogEvent: Decodable, Equatable {
    let id: String
    let slug: String?
    let category: String?
    let title: String
    let shortTitle: String?
    let venueID: String?
    let venue: String
    let date: String?
    let dates: [LiveCatalogSchedule]?
    let schedules: [LiveCatalogSchedule]?
    let period: String?
    let runtime: String?
    let ageLimit: String?
    let image: String?
    let badge: String?
    let artistSlug: String?
    let summary: String?
    let casts: [String]?
    let notices: [String]?
    let prices: [LiveCatalogPrice]?
    let saleState: String?
    let saleNote: String?
    let pinnedRank: Int?
    let soldCount: Int
    let sale: LiveCatalogSale?

    enum CodingKeys: String, CodingKey {
        case id, slug, category, title, shortTitle, venue, date, dates, schedules, period, runtime, ageLimit, image, badge, artistSlug, summary, casts, notices, prices, saleState, saleNote, pinnedRank, soldCount, sale
        case venueID = "venueId"
    }
}

struct LiveCatalogSchedule: Decodable, Equatable {
    let id: String?
    let label: String?
    let date: String?
    let startsAt: String?
    let times: [String]?
}

struct LiveCatalogPrice: Decodable, Equatable {
    let grade: String?
    let seat: String?
    let price: Int?
}

struct LiveCatalogSale: Decodable, Equatable {
    let state: String?
    let label: String?
    let note: String?
}

struct LiveSeatMap: Decodable, Equatable {
    let category: String?
    let date: String?
    let event: LiveSeatMapEvent
    let map: LiveSeatMapDetails
    let zones: [LiveSeatMapZone]
    let seats: [LiveSeat]
}

struct LiveSeatMapEvent: Decodable, Equatable {
    let id: String
    let title: String
    let venueId: String
    let venue: String
}

struct LiveSeatMapDetails: Decodable, Equatable {
    let id: String?
    let venue: String?
    let title: String
    let image: String
    let description: String
}

struct LiveSeatMapZone: Decodable, Equatable {
    let id: String
    let name: String
    let price: Int
    let available: Int
}

struct LiveSeat: Decodable, Equatable {
    let id: String
    let label: String
    let displayCode: String
    let zoneId: String
    let zoneName: String
    let price: Int
    let status: String
    let available: Bool
    let mapPosition: LiveSeatMapPosition?
}

struct LiveSeatMapPosition: Decodable, Equatable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
    let rotate: Double
    let shape: String
}

struct LiveVenueSeatMap: Decodable, Equatable {
    let eventID: String
    let venueID: String
    let venue: String
    let address: String?
    let type: String?
    let imageURL: String?
    let imageSource: String?
    let stage: String?
    let helper: String?
    let labels: [LiveVenueSeatMapLabel]?
    let seats: [LiveVenueSeat]

    enum CodingKeys: String, CodingKey {
        case venue, address, type, imageSource, stage, helper, labels, seats
        case eventID = "eventId"
        case venueID = "venueId"
        case imageURL = "imageUrl"
    }
}

struct LiveVenueSeatMapLabel: Decodable, Equatable {
    let text: String
    let x: Double
    let y: Double
}

struct LiveVenueSeat: Decodable, Equatable {
    let zoneID: String
    let seatLabel: String
    let number: Int
    let x: Double
    let y: Double
    let section: String?

    enum CodingKeys: String, CodingKey {
        case number, x, y, section
        case zoneID = "zoneId"
        case seatLabel
    }
}

struct LiveSession: Decodable, Equatable {
    let id: String
    let name: String
    let status: String
    let trustScore: Int
}

struct LiveTicket: Decodable, Equatable {
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
    let virtualQR: LiveVirtualQR?
    let event: LiveTicketEvent?
    let payment: LiveTicketPayment?

    enum CodingKeys: String, CodingKey {
        case id
        case eventId
        case performanceDateId
        case zoneId
        case seatLabel
        case status
        case available
        case faceValue
        case minPrice
        case maxPrice
        case transferCount
        case maxTransferCount
        case issuedAt
        case virtualQR = "virtualQr"
        case event
        case payment
    }
}

struct LiveTicketEvent: Decodable, Equatable {
    let id: String
    let title: String
    let venue: String?
    let performance: LiveTicketPerformance?
}

struct LiveTicketPerformance: Decodable, Equatable {
    let id: String
    let label: String?
    let startsAt: String
}

struct LiveTicketPayment: Decodable, Equatable {
    let amount: Int
    let method: String
    let status: String
}

struct LiveVirtualQR: Decodable, Equatable {
    let type: String
    let issuedAt: String
}

struct LiveResalePool: Decodable, Equatable {
    let id: String
    let eventId: String
    let performanceDateId: String
    let zoneId: String
    let ticketId: String
    let sellerId: String
    let showSlug: String?
    let price: Int
    let buyerFee: Int?
    let buyerTotal: Int?
    let sellerSettlement: Int?
    let buyerCount: Int
    let status: String
    let createdAt: String
    let matchedAt: String?
}

struct LiveWatchlistItem: Decodable, Equatable {
    let id: String
    let userId: String?
    let eventId: String
    let channels: [String]
    let calendarEnabled: Bool
    let notificationEnabled: Bool
    let createdAt: String?
    let updatedAt: String?
    let event: LiveWatchlistEvent?
    let notificationJobs: [LiveNotificationJob]
}

struct LiveWatchlistDeletion: Decodable, Equatable {
    let deleted: Bool
    let eventId: String
}

struct LiveWatchlistEvent: Decodable, Equatable {
    let id: String
    let title: String
    let venue: String?
    let venueId: String
    let category: String
    let saleState: String
}

enum LiveQueueEntryStatus: String, Decodable, Equatable {
    case waiting = "WAITING"
    case admitted = "ADMITTED"
    case expired = "EXPIRED"
    case left = "LEFT"
    case unknown

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: rawValue) ?? .unknown
    }
}

struct LiveQueueEntry: Decodable, Equatable {
    let id: String
    let performanceDateId: String
    let status: LiveQueueEntryStatus
    let position: Int
    let admittedAt: String?
    let admissionExpiresAt: String?
    let enteredAt: String
}

struct LiveQueueEntryLeaveResult: Decodable, Equatable {
    let id: String
    let status: LiveQueueEntryStatus
}

enum LiveSeatHoldStatus: String, Decodable, Equatable {
    case active = "ACTIVE"
    case expired = "EXPIRED"
    case released = "RELEASED"
    case converted = "CONVERTED"
    case unknown

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: rawValue) ?? .unknown
    }
}

struct LiveSeatHold: Decodable, Equatable {
    let id: String
    let status: LiveSeatHoldStatus
    let performanceDateId: String
    let ticketIds: [String]
    let expiresAt: String
    let extensionsUsed: Int
}

enum LiveReservationDraftStatus: String, Decodable, Equatable {
    case pendingPayment = "PENDING_PAYMENT"
    case expired = "EXPIRED"
    case cancelled = "CANCELLED"
    case confirmed = "CONFIRMED"
    case unknown

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: rawValue) ?? .unknown
    }
}

struct LiveReservationAmount: Decodable, Equatable {
    let faceValueTotal: Int
    let serviceFee: Int
    let total: Int
}

struct LiveReservationDraft: Decodable, Equatable {
    let id: String
    let status: LiveReservationDraftStatus
    let performanceDateId: String
    let ticketIds: [String]
    let amount: LiveReservationAmount
    let expiresAt: String
}

struct LiveNotificationJob: Decodable, Equatable {
    let id: String
    let type: String
    let title: String
    let status: String
    let scheduledAt: String
}

struct LiveSupportThread: Decodable, Equatable {
    let id: String
    let subject: String
    let status: LiveSupportStatus
    let category: String?
    let createdAt: String?
    let updatedAt: String
    let messages: [LiveSupportMessage]
}

struct LivePublicSupport: Decodable, Equatable {
    let version: String
    let faqs: [LiveSupportFAQ]
    let notices: [LiveSupportNotice]
}

struct LiveSupportFAQ: Decodable, Equatable {
    let id: String
    let question: String
    let answer: String
}

struct LiveSupportNotice: Decodable, Equatable {
    let id: String
    let title: String
    let body: String
}

enum LiveSupportStatus: String, Decodable, Equatable {
    case open = "OPEN"
    case answered = "ANSWERED"
    case closed = "CLOSED"
    case unknown

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: rawValue) ?? .unknown
    }
}

struct LiveSupportMessage: Decodable, Equatable {
    let id: String
    let role: LiveSupportRole
    let body: String
    let at: String
}

enum LiveSupportRole: String, Decodable, Equatable {
    case customer = "CUSTOMER"
    case admin = "ADMIN"
    case unknown

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        self = Self(rawValue: rawValue) ?? .unknown
    }
}

indirect enum LiveJSONValue: Decodable, Equatable {
    case object([String: LiveJSONValue])
    case array([LiveJSONValue])
    case string(String)
    case number(Double)
    case bool(Bool)
    case null

    init(from decoder: Decoder) throws {
        if let container = try? decoder.container(keyedBy: DynamicCodingKey.self) {
            self = .object(Dictionary(uniqueKeysWithValues: try container.allKeys.map { key in
                (key.stringValue, try container.decode(LiveJSONValue.self, forKey: key))
            }))
        } else if var container = try? decoder.unkeyedContainer() {
            var values: [LiveJSONValue] = []
            while !container.isAtEnd {
                values.append(try container.decode(LiveJSONValue.self))
            }
            self = .array(values)
        } else {
            let container = try decoder.singleValueContainer()
            if container.decodeNil() { self = .null }
            else if let value = try? container.decode(Bool.self) { self = .bool(value) }
            else if let value = try? container.decode(Double.self) { self = .number(value) }
            else { self = .string(try container.decode(String.self)) }
        }
    }
}

private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    init?(stringValue: String) { self.stringValue = stringValue }
    let intValue: Int? = nil
    init?(intValue: Int) { return nil }
}

struct LiveMutationReceipt: Decodable, Equatable {
    let payload: LiveJSONValue

    init(from decoder: Decoder) throws {
        payload = try LiveJSONValue(from: decoder)
    }
}

enum LiveAuthenticatedAction: Equatable {
    case supportThread(userID: String, message: String, idempotencyKey: String)
    case supportMessage(userID: String, threadID: String, message: String, idempotencyKey: String)
    case watchlist(userID: String, eventID: String, idempotencyKey: String)
    case watchlistNotification(userID: String, eventID: String, idempotencyKey: String)
    case ticketPurchase(userID: String, ticketID: String, idempotencyKey: String)
    case identityStart(userID: String, phone: String, idempotencyKey: String)
    case identityConfirm(userID: String, phone: String, verificationID: String, idempotencyKey: String)
    case trustDevice(userID: String, deviceID: String, attestation: String, idempotencyKey: String)
    case pushToken(userID: String, token: String, idempotencyKey: String)
    case admissionQR(userID: String, ticketID: String, deviceID: String, attestation: String, idempotencyKey: String)
    case virtualQR(userID: String, ticketID: String, idempotencyKey: String)

    var endpoint: LiveAPIEndpoint {
        switch self {
        case .supportThread: return .supportThreadMutation
        case .supportMessage: return .supportMessages
        case .watchlist, .watchlistNotification: return .watchlistUpsert
        case .ticketPurchase: return .ticketPurchase
        case .identityStart: return .identityStart
        case .identityConfirm: return .identityConfirm
        case .trustDevice: return .deviceTrust
        case .pushToken: return .pushToken
        case .admissionQR: return .ticketQR
        case .virtualQR: return .virtualQR
        }
    }

    func request() throws -> APIRequest {
        let owner: (id: String, field: String)
        let body: [String: Any]
        let idempotencyKey: String
        switch self {
        case let .supportThread(userID, message, key):
            owner = (userID, "__bearer__")
            body = ["message": message]
            idempotencyKey = key
        case let .supportMessage(userID, threadID, message, key):
            owner = (userID, "__bearer__")
            body = ["threadId": threadID, "message": message]
            idempotencyKey = key
        case let .watchlist(userID, _, key):
            owner = (userID, "__bearer__")
            body = [
                "channels": ["APP_PUSH"],
                "calendarEnabled": false,
                "notificationEnabled": true
            ]
            idempotencyKey = key
        case let .watchlistNotification(userID, _, key):
            owner = (userID, "__bearer__")
            body = [
                "channels": ["APP_PUSH"],
                "calendarEnabled": false,
                "notificationEnabled": true
            ]
            idempotencyKey = key
        case let .ticketPurchase(userID, ticketID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "ticketId": ticketID]
            idempotencyKey = key
        case let .identityStart(userID, phone, key):
            owner = (userID, "userId")
            body = ["userId": userID, "phone": phone]
            idempotencyKey = key
        case let .identityConfirm(userID, phone, verificationID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "phone": phone, "identityVerificationId": verificationID]
            idempotencyKey = key
        case let .trustDevice(userID, deviceID, attestation, key):
            owner = (userID, "userId")
            body = ["userId": userID, "deviceId": deviceID, "biometricVerified": true, "appAttestation": attestation]
            idempotencyKey = key
        case let .pushToken(userID, token, key):
            owner = (userID, "userId")
            body = ["userId": userID, "platform": "ios", "token": token]
            idempotencyKey = key
        case let .admissionQR(userID, ticketID, deviceID, attestation, key):
            owner = (userID, "userId")
            body = ["userId": userID, "ticketId": ticketID, "channel": "APP", "deviceId": deviceID, "appAttestation": attestation]
            idempotencyKey = key
        case let .virtualQR(userID, ticketID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "ticketId": ticketID]
            idempotencyKey = key
        }
        guard !owner.id.isEmpty,
              !idempotencyKey.isEmpty,
              body.values.allSatisfy({ !($0 as? String == "") }),
              JSONSerialization.isValidJSONObject(body) else {
            throw APIClientError.invalidResponse
        }
        let path: String
        switch self {
        case .watchlist(_, let eventID, _), .watchlistNotification(_, let eventID, _):
            let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
            guard !eventID.isEmpty,
                  let encodedEventID = eventID.addingPercentEncoding(withAllowedCharacters: allowed),
                  !encodedEventID.isEmpty else {
                throw APIClientError.invalidResponse
            }
            path = endpoint.pathTemplate.replacingOccurrences(of: "{eventId}", with: encodedEventID)
        default:
            path = endpoint.pathTemplate
        }
        return APIRequest(
            method: endpoint.method,
            path: path,
            body: .json(try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])),
            idempotencyKey: idempotencyKey,
            authentication: .required(userID: owner.id),
            ownerBinding: owner.field == "__bearer__" ? .bearerPrincipal : .jsonField(owner.field)
        )
    }
}
