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
    case seatMap
    case session
    case tickets
    case watchlist
    case supportThreads
    case supportThreadMutation
    case supportMessages
    case watchlistMutation
    case watchlistNotification
    case ticketPurchase
    case googleAuthentication
    case identityStart
    case identityConfirm
    case deviceTrust
    case pushToken
    case ticketQR
    case virtualQR
    case unknown(method: APIRequestMethod, path: String)

    static let known: [LiveAPIEndpoint] = [
        .health,
        .state,
        .catalog,
        .seatMap,
        .session,
        .tickets,
        .watchlist,
        .supportThreads,
        .supportThreadMutation,
        .supportMessages,
        .watchlistMutation,
        .watchlistNotification,
        .ticketPurchase,
        .googleAuthentication,
        .identityStart,
        .identityConfirm,
        .deviceTrust,
        .pushToken,
        .ticketQR,
        .virtualQR
    ]

    var method: APIRequestMethod {
        switch self {
        case .supportThreadMutation, .supportMessages, .watchlistMutation,
             .watchlistNotification, .ticketPurchase, .googleAuthentication,
             .identityStart, .identityConfirm, .deviceTrust, .pushToken,
             .ticketQR, .virtualQR:
            return .post
        case .unknown(let method, _):
            return method
        case .health, .state, .catalog, .seatMap, .session, .tickets, .watchlist, .supportThreads:
            return .get
        }
    }

    var pathTemplate: String {
        switch self {
        case .health: return "/api/health"
        case .state: return "/api/state"
        case .catalog: return "/api/catalog"
        case .seatMap: return "/api/seat-map?eventId={eventId}"
        case .session: return "/api/users/{userId}/session"
        case .tickets: return "/api/users/{userId}/tickets"
        case .watchlist: return "/api/users/{userId}/watchlist"
        case .supportThreads: return "/api/support/threads?userId={userId}"
        case .supportThreadMutation: return "/api/support/threads"
        case .supportMessages: return "/api/support/messages"
        case .watchlistMutation: return "/api/watchlist"
        case .watchlistNotification: return "/api/watchlist/notify"
        case .ticketPurchase: return "/api/tickets/buy"
        case .googleAuthentication: return "/api/auth/google"
        case .identityStart: return "/api/identity/portone-danal/start"
        case .identityConfirm: return "/api/identity/portone-danal/confirm"
        case .deviceTrust: return "/api/devices/trust"
        case .pushToken: return "/api/devices/push-token"
        case .ticketQR: return "/api/tickets/qr"
        case .virtualQR: return "/api/tickets/virtual-qr"
        case .unknown(_, let path): return path
        }
    }

    var access: LiveAPIEndpointAccess {
        switch self {
        case .health, .state, .catalog, .seatMap:
            return .publicRead
        case .session, .tickets, .watchlist, .supportThreads:
            return .authenticatedRead
        case .supportThreadMutation, .supportMessages, .watchlistMutation,
             .watchlistNotification, .ticketPurchase, .googleAuthentication,
             .identityStart, .identityConfirm, .deviceTrust, .pushToken,
             .ticketQR, .virtualQR:
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
        validatedStateResponse: Bool = false,
        catalogRouteConfirmed: Bool = false
    ) -> LiveCapabilityMap {
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
                    validatedStateResponse: validatedStateResponse,
                    catalogRouteConfirmed: catalogRouteConfirmed
                )
            )
        })
        return LiveCapabilityMap(diagnostics: diagnostics, baseURL: baseURL, states: states)
    }

    private func state(
        for endpoint: LiveAPIEndpoint,
        baseURL: URL,
        diagnostics: LiveAPIContractDiagnostics,
        validatedStateResponse: Bool,
        catalogRouteConfirmed: Bool
    ) -> LiveCapabilityState {
        switch diagnostics.compatibility {
        case .unknown:
            return validatedStateResponse && endpoint == .state ? .available : .unknown
        case .incompatible(let expected, let observed):
            return .incompatible(expected: expected, observed: observed)
        case .compatible:
            guard endpoint != .catalog || catalogRouteConfirmed else {
                return .unknown
            }
            switch endpoint.access {
            case .publicRead:
                return .available
            case .authenticatedRead:
                return baseURL.scheme?.lowercased() == "https"
                    ? .blocked(.serverAuthorizationUnverified)
                    : .blocked(.requiresHTTPS)
            case .mutation:
                return baseURL.scheme?.lowercased() == "https" ? .blocked(.unsupportedMutation) : .blocked(.requiresHTTPS)
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
    }
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

struct LiveWatchlistEvent: Decodable, Equatable {
    let id: String
    let title: String
    let venue: String?
    let venueId: String
    let category: String
    let saleState: String
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
    let userId: String
    let subject: String
    let status: LiveSupportStatus
    let updatedAt: String
    let messages: [LiveSupportMessage]
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
    let actorId: String
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
        case .watchlist: return .watchlistMutation
        case .watchlistNotification: return .watchlistNotification
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
            owner = (userID, "userId")
            body = ["userId": userID, "message": message]
            idempotencyKey = key
        case let .supportMessage(userID, threadID, message, key):
            owner = (userID, "actorId")
            body = ["threadId": threadID, "actorId": userID, "message": message]
            idempotencyKey = key
        case let .watchlist(userID, eventID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "eventId": eventID]
            idempotencyKey = key
        case let .watchlistNotification(userID, eventID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "eventId": eventID]
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
        return APIRequest(
            method: .post,
            path: endpoint.pathTemplate,
            body: .json(try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])),
            idempotencyKey: idempotencyKey,
            authentication: .required(userID: owner.id),
            ownerBinding: .jsonField(owner.field)
        )
    }
}
