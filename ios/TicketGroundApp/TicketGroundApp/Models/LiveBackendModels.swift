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
    case seatMap
    case nativeContract
    case profile
    case profileMutation
    case reservations
    case reservationDetail
    case bookingQueue
    case bookingSeats
    case bookingHold
    case bookingHoldRelease
    case bookingDraft
    case deviceChallenge
    case nativeDeviceTrust
    case nativePushToken
    case nativeDeviceRevoke
    case notificationSettings
    case testPushPayload
    case mobileTickets
    case mobileTicketQR
    case session
    case tickets
    case watchlist
    case supportPublic
    case supportThreads
    case supportThreadMutation
    case supportMessages
    case watchlistMutation
    case watchlistRemoval
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
        .regions,
        .artist,
        .openCalendar,
        .seatMap,
        .nativeContract,
        .profile,
        .profileMutation,
        .reservations,
        .reservationDetail,
        .bookingQueue,
        .bookingSeats,
        .bookingHold,
        .bookingHoldRelease,
        .bookingDraft,
        .deviceChallenge,
        .nativeDeviceTrust,
        .nativePushToken,
        .nativeDeviceRevoke,
        .notificationSettings,
        .testPushPayload,
        .mobileTickets,
        .mobileTicketQR,
        .session,
        .tickets,
        .watchlist,
        .supportPublic,
        .supportThreads,
        .supportThreadMutation,
        .supportMessages,
        .watchlistMutation,
        .watchlistRemoval,
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
        case .profileMutation:
            return .patch
        case .watchlistMutation, .watchlistNotification, .nativePushToken, .notificationSettings:
            return .put
        case .watchlistRemoval, .bookingHoldRelease, .nativeDeviceRevoke:
            return .delete
        case .bookingQueue, .bookingHold, .bookingDraft, .deviceChallenge, .nativeDeviceTrust, .testPushPayload, .mobileTicketQR,
             .supportThreadMutation, .supportMessages, .ticketPurchase, .googleAuthentication,
             .identityStart, .identityConfirm, .deviceTrust, .pushToken,
             .ticketQR, .virtualQR:
            return .post
        case .unknown(let method, _):
            return method
        case .health, .state, .catalog, .regions, .artist, .openCalendar, .nativeContract,
             .supportPublic,
             .seatMap, .profile, .reservations, .reservationDetail, .bookingSeats, .notificationSettings, .mobileTickets,
             .session, .tickets, .watchlist, .supportThreads:
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
        case .seatMap: return "/api/seat-map?eventId={eventId}&performanceDateId={performanceDateId}"
        case .nativeContract: return "/api/native/v1/contract"
        case .profile, .profileMutation: return "/api/me/profile"
        case .reservations: return "/api/me/reservations"
        case .reservationDetail: return "/api/me/reservations/{ticketId}"
        case .bookingQueue: return "/api/me/booking/queues"
        case .bookingSeats: return "/api/me/booking/events/{eventId}/performances/{performanceId}/seats"
        case .bookingHold: return "/api/me/booking/holds"
        case .bookingHoldRelease: return "/api/me/booking/holds/{holdId}"
        case .bookingDraft: return "/api/me/booking/drafts"
        case .deviceChallenge: return "/api/me/devices/challenges"
        case .nativeDeviceTrust: return "/api/me/devices/trust"
        case .nativePushToken: return "/api/me/devices/{deviceId}/push-token"
        case .nativeDeviceRevoke: return "/api/me/devices/{deviceId}"
        case .notificationSettings: return "/api/me/notification-settings"
        case .testPushPayload: return "/api/me/devices/{deviceId}/test-payload"
        case .mobileTickets: return "/api/me/tickets"
        case .mobileTicketQR: return "/api/me/tickets/{ticketId}/qr"
        case .session: return "/api/users/{userId}/session"
        case .tickets: return "/api/users/{userId}/tickets"
        case .watchlist: return "/api/me/watchlist"
        case .supportPublic: return "/api/support/v1/public"
        case .supportThreads: return "/api/me/support/threads"
        case .supportThreadMutation: return "/api/me/support/threads"
        case .supportMessages: return "/api/me/support/threads/{threadId}/messages"
        case .watchlistMutation, .watchlistRemoval: return "/api/me/watchlist/{eventId}"
        case .watchlistNotification: return "/api/me/watchlist/{eventId}/notification"
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
        case .health, .state, .catalog, .regions, .artist, .openCalendar, .seatMap, .nativeContract, .supportPublic:
            return .publicRead
        case .profile, .reservations, .reservationDetail, .bookingSeats, .notificationSettings, .mobileTickets, .session, .tickets, .watchlist, .supportThreads:
            return .authenticatedRead
        case .profileMutation, .bookingQueue, .bookingHold, .bookingHoldRelease, .bookingDraft,
             .deviceChallenge, .nativeDeviceTrust, .nativePushToken, .nativeDeviceRevoke, .testPushPayload, .mobileTicketQR,
             .supportThreadMutation, .supportMessages, .watchlistMutation, .watchlistRemoval,
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

struct LiveNativeContractStatus: Decodable, Equatable {
    let version: String
    let endpoints: [String]
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
        catalogRouteConfirmed: Bool = false,
        discoveryRoutesConfirmed: Bool = false,
        accountRoutesConfirmed: Bool = false,
        watchlistRoutesConfirmed: Bool = false,
        bookingRoutesConfirmed: Bool = false,
        deviceRoutesConfirmed: Bool = false,
        mobileTicketRoutesConfirmed: Bool = false,
        supportRoutesConfirmed: Bool = false
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
                    catalogRouteConfirmed: catalogRouteConfirmed,
                    discoveryRoutesConfirmed: discoveryRoutesConfirmed,
                    accountRoutesConfirmed: accountRoutesConfirmed,
                    watchlistRoutesConfirmed: watchlistRoutesConfirmed,
                    bookingRoutesConfirmed: bookingRoutesConfirmed,
                    deviceRoutesConfirmed: deviceRoutesConfirmed,
                    mobileTicketRoutesConfirmed: mobileTicketRoutesConfirmed,
                    supportRoutesConfirmed: supportRoutesConfirmed
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
        catalogRouteConfirmed: Bool,
        discoveryRoutesConfirmed: Bool,
        accountRoutesConfirmed: Bool,
        watchlistRoutesConfirmed: Bool,
        bookingRoutesConfirmed: Bool,
        deviceRoutesConfirmed: Bool,
        mobileTicketRoutesConfirmed: Bool,
        supportRoutesConfirmed: Bool
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
            guard ![.regions, .artist, .openCalendar].contains(endpoint) || discoveryRoutesConfirmed else {
                return .unknown
            }
            guard ![.supportPublic, .supportThreads, .supportThreadMutation, .supportMessages].contains(endpoint)
                    || supportRoutesConfirmed else {
                return .unknown
            }
            guard ![.profile, .profileMutation, .reservations, .reservationDetail].contains(endpoint)
                    || accountRoutesConfirmed else {
                return .unknown
            }
            guard ![.watchlist, .watchlistMutation, .watchlistRemoval, .watchlistNotification].contains(endpoint)
                    || watchlistRoutesConfirmed else {
                return .unknown
            }
            guard ![.bookingQueue, .bookingSeats, .bookingHold, .bookingHoldRelease, .bookingDraft].contains(endpoint)
                    || bookingRoutesConfirmed else {
                return .unknown
            }
            guard ![.deviceChallenge, .nativeDeviceTrust, .nativePushToken, .nativeDeviceRevoke, .notificationSettings, .testPushPayload].contains(endpoint)
                    || deviceRoutesConfirmed else {
                return .unknown
            }
            guard ![.mobileTickets, .mobileTicketQR].contains(endpoint) || mobileTicketRoutesConfirmed else {
                return .unknown
            }
            switch endpoint.access {
            case .publicRead:
                return .available
            case .authenticatedRead:
                guard baseURL.scheme?.lowercased() == "https" else { return .blocked(.requiresHTTPS) }
                let routeConfirmed = ([.profile, .reservations, .reservationDetail].contains(endpoint) && accountRoutesConfirmed)
                    || (endpoint == .watchlist && watchlistRoutesConfirmed)
                    || (endpoint == .bookingSeats && bookingRoutesConfirmed)
                    || (endpoint == .notificationSettings && deviceRoutesConfirmed)
                    || (endpoint == .mobileTickets && mobileTicketRoutesConfirmed)
                    || (endpoint == .supportThreads && supportRoutesConfirmed)
                return routeConfirmed ? .available : .blocked(.serverAuthorizationUnverified)
            case .mutation:
                guard baseURL.scheme?.lowercased() == "https" else { return .blocked(.requiresHTTPS) }
                return [
                    .profileMutation,
                    .watchlistMutation,
                    .watchlistRemoval,
                    .watchlistNotification,
                    .bookingQueue,
                    .bookingHold,
                    .bookingHoldRelease,
                    .bookingDraft,
                    .deviceChallenge,
                    .nativeDeviceTrust,
                    .nativePushToken,
                    .nativeDeviceRevoke,
                    .testPushPayload,
                    .mobileTicketQR,
                    .supportThreadMutation,
                    .supportMessages
                ].contains(endpoint) ? .available : .blocked(.unsupportedMutation)
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

struct LiveAccountProfile: Decodable, Equatable {
    let id: String
    let name: String
    let status: String
    let trustScore: Int
    let profileConfirmed: Bool
}

struct LiveReservation: Decodable, Equatable {
    let ticketId: String
    let ticketStatus: String
    let event: LiveReservationEvent
    let performance: LiveReservationPerformance
    let seat: LiveReservationSeat
    let faceValue: Int
    let issuedAt: String?
}

struct LiveReservationEvent: Decodable, Equatable {
    let id: String
    let title: String
    let venue: String?
}

struct LiveReservationPerformance: Decodable, Equatable {
    let id: String
    let label: String?
    let startsAt: String?
}

struct LiveReservationSeat: Decodable, Equatable {
    let zoneId: String
    let label: String
}

struct LiveBookingQueue: Decodable, Equatable {
    let id: String
    let eventId: String
    let performanceId: String
    let status: String
    let position: Int
    let expiresAt: String
    let updatedAt: String
}

struct LiveBookingSeatSnapshot: Decodable, Equatable {
    let event: LiveReservationEvent
    let performanceId: String
    let queue: LiveBookingQueue
    let revision: Int
    let seats: [LiveBookingSeat]
}

struct LiveBookingSeat: Decodable, Equatable {
    let ticketId: String
    let zoneId: String
    let label: String
    let price: Int
    let state: String
    let holdExpiresAt: String?
}

struct LiveSeatHold: Decodable, Equatable {
    let id: String
    let queueId: String
    let ticketId: String
    let status: String
    let expiresAt: String
    let revision: Int
    let updatedAt: String
}

struct LiveReservationDraft: Decodable, Equatable {
    let id: String
    let holdId: String
    let ticketId: String
    let eventId: String
    let performanceId: String
    let seat: LiveReservationSeat
    let amount: Int
    let status: String
    let expiresAt: String
    let createdAt: String
    let updatedAt: String
}

struct LiveDeviceChallenge: Decodable, Equatable {
    let id: String
    let nonce: String
    let expiresAt: String
    let provider: String
}

struct LiveRegisteredDevice: Decodable, Equatable {
    let id: String
    let deviceId: String
    let platform: String
    let status: String
    let counter: Int
    let deliveryStatus: String
    let updatedAt: String
}

struct LiveNotificationSettings: Decodable, Equatable {
    let preferences: LiveNotificationPreferences
    let delivery: LiveNotificationDelivery
}

struct LiveNotificationPreferences: Decodable, Equatable {
    let reservationUpdates: Bool
    let watchlistOpen: Bool
}

struct LiveNotificationDelivery: Decodable, Equatable {
    let available: Bool
    let devices: [LiveRegisteredDevice]
}

struct LiveMobileTicket: Decodable, Equatable {
    let id: String
    let event: LiveReservationEvent
    let performance: LiveReservationPerformance
    let seat: LiveReservationSeat
    let status: String
    let admissionStatus: String
}

struct LiveMobileTicketQR: Decodable, Equatable {
    let token: String
    let status: String
    let issuedAt: String
    let expiresAt: String
    let ttlSeconds: Int
    let ticket: LiveMobileTicket
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

struct LiveWatchlistRemoval: Decodable, Equatable {
    let removed: Bool
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

struct LiveSupportPublicContent: Decodable, Equatable {
    let version: String
    let categories: [LiveSupportCategory]
    let faqs: [LiveSupportFAQ]
    let notices: [LiveSupportNotice]
}

struct LiveSupportCategory: Decodable, Equatable {
    let id: String
    let label: String
}

struct LiveSupportFAQ: Decodable, Equatable {
    let id: String
    let category: String
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
    case supportThread(userID: String, category: String, subject: String, message: String, idempotencyKey: String)
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
        let owner: (id: String, field: String?)
        let body: [String: Any]
        let idempotencyKey: String
        let path: String
        let method: APIRequestMethod
        switch self {
        case let .supportThread(userID, category, subject, message, key):
            owner = (userID, nil)
            body = ["category": category, "subject": subject, "message": message]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        case let .supportMessage(userID, threadID, message, key):
            owner = (userID, nil)
            body = ["message": message]
            idempotencyKey = key
            path = "/api/me/support/threads/\(threadID)/messages"
            method = .post
        case let .watchlist(userID, eventID, key):
            owner = (userID, nil)
            body = ["notificationEnabled": true]
            idempotencyKey = key
            path = "/api/me/watchlist/\(eventID)"
            method = .put
        case let .watchlistNotification(userID, eventID, key):
            owner = (userID, nil)
            body = ["enabled": true]
            idempotencyKey = key
            path = "/api/me/watchlist/\(eventID)/notification"
            method = .put
        case let .ticketPurchase(userID, ticketID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "ticketId": ticketID]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        case let .identityStart(userID, phone, key):
            owner = (userID, "userId")
            body = ["userId": userID, "phone": phone]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        case let .identityConfirm(userID, phone, verificationID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "phone": phone, "identityVerificationId": verificationID]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        case let .trustDevice(userID, deviceID, attestation, key):
            owner = (userID, "userId")
            body = ["userId": userID, "deviceId": deviceID, "biometricVerified": true, "appAttestation": attestation]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        case let .pushToken(userID, token, key):
            owner = (userID, "userId")
            body = ["userId": userID, "platform": "ios", "token": token]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        case let .admissionQR(userID, ticketID, deviceID, attestation, key):
            owner = (userID, "userId")
            body = ["userId": userID, "ticketId": ticketID, "channel": "APP", "deviceId": deviceID, "appAttestation": attestation]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        case let .virtualQR(userID, ticketID, key):
            owner = (userID, "userId")
            body = ["userId": userID, "ticketId": ticketID]
            idempotencyKey = key
            path = endpoint.pathTemplate
            method = .post
        }
        guard !owner.id.isEmpty,
              !idempotencyKey.isEmpty,
              !path.hasSuffix("/"),
              body.values.allSatisfy({ !($0 as? String == "") }),
              JSONSerialization.isValidJSONObject(body) else {
            throw APIClientError.invalidResponse
        }
        return APIRequest(
            method: method,
            path: path,
            body: .json(try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])),
            idempotencyKey: idempotencyKey,
            authentication: .required(userID: owner.id),
            ownerBinding: owner.field.map(APIRequestOwnerBinding.jsonField) ?? .principal
        )
    }
}
