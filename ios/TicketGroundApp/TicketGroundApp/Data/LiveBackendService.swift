import Foundation

final class LiveBackendService {
    private static let discoveryVersion = "1"
    private let apiClient: APIClient
    private let decoder: JSONDecoder
    private let contract: LiveAPIContract
    private var capabilities: LiveCapabilityMap
    private var diagnosedVersionlessState: LiveState?
    private let allowsCapabilityBootstrap: Bool

    init(
        apiClient: APIClient,
        decoder: JSONDecoder = JSONDecoder(),
        contract: LiveAPIContract = .deployed,
        initialCapabilityMap: LiveCapabilityMap? = nil
    ) {
        self.apiClient = apiClient
        self.decoder = decoder
        self.contract = contract
        self.capabilities = initialCapabilityMap ?? contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: nil
        )
        self.allowsCapabilityBootstrap = initialCapabilityMap == nil
    }

    var capabilityMap: LiveCapabilityMap {
        capabilities
    }

    func diagnosePublicContract() async throws -> LiveAPIContractProbe {
        let health = try await get(
            APIRequest(path: contract.bootstrapPath),
            endpoint: .health,
            bypassCapability: true,
            as: LiveAPIHealth.self
        )
        guard let version = health.version, !version.isEmpty else {
            return try await diagnoseVersionlessState()
        }
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: version,
            validatedStateResponse: false,
            catalogRouteConfirmed: false
        )
        guard capabilities.diagnostics.compatibility == .compatible else {
            return LiveAPIContractProbe(
                diagnostics: capabilities.diagnostics,
                capabilities: capabilities
            )
        }

        _ = try await get(
            APIRequest(path: "/api/catalog", query: [APIRequestQuery(name: "limit", value: "1")]),
            endpoint: .catalog,
            bypassCapability: true,
            as: LiveCatalog.self
        )
        let discoveryRoutesConfirmed = await probeDiscoveryContract()
        let nativeRoutes = await probeNativeContract()
        let supportRoutesConfirmed: Bool
        if nativeRoutes.contains("support") {
            supportRoutesConfirmed = true
        } else {
            supportRoutesConfirmed = await probeSupportContract()
        }
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: version,
            validatedStateResponse: false,
            catalogRouteConfirmed: true,
            discoveryRoutesConfirmed: discoveryRoutesConfirmed,
            accountRoutesConfirmed: nativeRoutes.contains("profile") && nativeRoutes.contains("reservations"),
            watchlistRoutesConfirmed: nativeRoutes.contains("watchlist"),
            bookingRoutesConfirmed: nativeRoutes.contains("booking"),
            deviceRoutesConfirmed: nativeRoutes.contains("devices"),
            mobileTicketRoutesConfirmed: nativeRoutes.contains("mobile-ticket-qr"),
            supportRoutesConfirmed: supportRoutesConfirmed
        )
        return LiveAPIContractProbe(
            diagnostics: capabilities.diagnostics,
            capabilities: capabilities
        )
    }

    func getState() async throws -> LiveState {
        if let diagnosedVersionlessState {
            self.diagnosedVersionlessState = nil
            return diagnosedVersionlessState
        }
        return try await get(APIRequest(path: "/api/state"), endpoint: .state, as: LiveState.self)
    }

    func getCatalog() async throws -> LiveCatalog {
        try await get(APIRequest(path: "/api/catalog"), endpoint: .catalog, as: LiveCatalog.self)
    }

    func getRegions() async throws -> LiveRegionDiscovery {
        try await getDiscovery(
            APIRequest(path: "/api/discovery/v1/regions"),
            endpoint: .regions,
            as: LiveRegionDiscovery.self
        )
    }

    func getArtist(slug: String) async throws -> LiveArtistDiscovery {
        try await getDiscovery(
            APIRequest(path: "/api/discovery/v1/artists/\(pathValue(slug))"),
            endpoint: .artist,
            as: LiveArtistDiscovery.self
        )
    }

    func getOpenCalendar() async throws -> LiveOpenCalendar {
        try await getDiscovery(
            APIRequest(path: "/api/discovery/v1/open-calendar"),
            endpoint: .openCalendar,
            as: LiveOpenCalendar.self
        )
    }

    func getSeatMap(eventID: String, performanceDateID: String) async throws -> LiveSeatMap {
        try await get(APIRequest(
            path: "/api/seat-map",
            query: [
                APIRequestQuery(name: "eventId", value: eventID),
                APIRequestQuery(name: "performanceDateId", value: performanceDateID)
            ]
        ), endpoint: .seatMap, as: LiveSeatMap.self)
    }

    func getVenueSeatMap(eventID: String) async throws -> LiveVenueSeatMap {
        try await get(
            APIRequest(path: "/api/events/\(pathValue(eventID))/seat-map"),
            endpoint: .seatMap,
            as: LiveVenueSeatMap.self
        )
    }

    func getSession(userID: String) async throws -> LiveSession {
        try await get(
            authenticatedRequest(path: "/api/users/\(pathValue(userID))/session", userID: userID),
            endpoint: .session,
            as: LiveSession.self
        )
    }

    func getTickets(userID: String) async throws -> [LiveTicket] {
        try await get(
            authenticatedRequest(path: "/api/users/\(pathValue(userID))/tickets", userID: userID),
            endpoint: .tickets,
            as: [LiveTicket].self
        )
    }

    func getWatchlist(userID: String) async throws -> [LiveWatchlistItem] {
        try await get(
            APIRequest(
                path: "/api/me/watchlist",
                authentication: .required(userID: userID),
                ownerBinding: .principal
            ),
            endpoint: .watchlist,
            as: [LiveWatchlistItem].self
        )
    }

    func getProfile(userID: String) async throws -> LiveAccountProfile {
        try await get(
            principalRequest(path: "/api/me/profile", userID: userID),
            endpoint: .profile,
            as: LiveAccountProfile.self
        )
    }

    func updateProfile(
        userID: String,
        name: String,
        idempotencyKey: String
    ) async throws -> LiveAccountProfile {
        try await get(
            try principalJSONRequest(
                method: .patch,
                path: "/api/me/profile",
                userID: userID,
                body: ["name": name],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .profileMutation,
            as: LiveAccountProfile.self
        )
    }

    func getReservations(userID: String) async throws -> [LiveReservation] {
        try await get(
            principalRequest(path: "/api/me/reservations", userID: userID),
            endpoint: .reservations,
            as: [LiveReservation].self
        )
    }

    func getReservation(userID: String, ticketID: String) async throws -> LiveReservation {
        try await get(
            principalRequest(path: "/api/me/reservations/\(pathValue(ticketID))", userID: userID),
            endpoint: .reservationDetail,
            as: LiveReservation.self
        )
    }

    func putWatchlist(
        userID: String,
        eventID: String,
        idempotencyKey: String
    ) async throws -> LiveWatchlistItem {
        try await get(
            try principalJSONRequest(
                method: .put,
                path: "/api/me/watchlist/\(pathValue(eventID))",
                userID: userID,
                body: ["notificationEnabled": true],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .watchlistMutation,
            as: LiveWatchlistItem.self
        )
    }

    func removeWatchlist(
        userID: String,
        eventID: String,
        idempotencyKey: String
    ) async throws -> LiveWatchlistRemoval {
        try await get(
            APIRequest(
                method: .delete,
                path: "/api/me/watchlist/\(pathValue(eventID))",
                idempotencyKey: idempotencyKey,
                authentication: .required(userID: userID),
                ownerBinding: .principal
            ),
            endpoint: .watchlistRemoval,
            as: LiveWatchlistRemoval.self
        )
    }

    func setWatchlistNotification(
        userID: String,
        eventID: String,
        enabled: Bool,
        idempotencyKey: String
    ) async throws -> LiveWatchlistItem {
        try await get(
            try principalJSONRequest(
                method: .put,
                path: "/api/me/watchlist/\(pathValue(eventID))/notification",
                userID: userID,
                body: ["enabled": enabled],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .watchlistNotification,
            as: LiveWatchlistItem.self
        )
    }

    func joinBookingQueue(
        userID: String,
        eventID: String,
        performanceID: String,
        idempotencyKey: String
    ) async throws -> LiveBookingQueue {
        try await get(
            try principalJSONRequest(
                method: .post,
                path: "/api/me/booking/queues",
                userID: userID,
                body: ["eventId": eventID, "performanceId": performanceID],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .bookingQueue,
            as: LiveBookingQueue.self
        )
    }

    func getBookingSeats(
        userID: String,
        eventID: String,
        performanceID: String,
        queueID: String
    ) async throws -> LiveBookingSeatSnapshot {
        try await get(
            APIRequest(
                path: "/api/me/booking/events/\(pathValue(eventID))/performances/\(pathValue(performanceID))/seats",
                query: [APIRequestQuery(name: "queueId", value: queueID)],
                authentication: .required(userID: userID),
                ownerBinding: .principal
            ),
            endpoint: .bookingSeats,
            as: LiveBookingSeatSnapshot.self
        )
    }

    func createSeatHold(
        userID: String,
        queueID: String,
        ticketID: String,
        revision: Int,
        idempotencyKey: String
    ) async throws -> LiveSeatHold {
        try await get(
            try principalJSONRequest(
                method: .post,
                path: "/api/me/booking/holds",
                userID: userID,
                body: ["queueId": queueID, "ticketId": ticketID, "revision": revision],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .bookingHold,
            as: LiveSeatHold.self
        )
    }

    func releaseSeatHold(userID: String, holdID: String, idempotencyKey: String) async throws -> LiveSeatHold {
        try await get(
            APIRequest(
                method: .delete,
                path: "/api/me/booking/holds/\(pathValue(holdID))",
                idempotencyKey: idempotencyKey,
                authentication: .required(userID: userID),
                ownerBinding: .principal
            ),
            endpoint: .bookingHoldRelease,
            as: LiveSeatHold.self
        )
    }

    func createReservationDraft(userID: String, holdID: String, idempotencyKey: String) async throws -> LiveReservationDraft {
        try await get(
            try principalJSONRequest(
                method: .post,
                path: "/api/me/booking/drafts",
                userID: userID,
                body: ["holdId": holdID],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .bookingDraft,
            as: LiveReservationDraft.self
        )
    }

    func createDeviceChallenge(userID: String, deviceID: String, idempotencyKey: String) async throws -> LiveDeviceChallenge {
        try await get(
            try principalJSONRequest(method: .post, path: "/api/me/devices/challenges", userID: userID, body: ["deviceId": deviceID], idempotencyKey: idempotencyKey),
            endpoint: .deviceChallenge,
            as: LiveDeviceChallenge.self
        )
    }

    func trustSimulatorDevice(userID: String, challengeID: String, deviceID: String, counter: Int, proof: String, idempotencyKey: String) async throws -> LiveRegisteredDevice {
        try await get(
            try principalJSONRequest(
                method: .post,
                path: "/api/me/devices/trust",
                userID: userID,
                body: ["challengeId": challengeID, "deviceId": deviceID, "counter": counter, "proof": proof],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .nativeDeviceTrust,
            as: LiveRegisteredDevice.self
        )
    }

    func registerPushToken(userID: String, deviceID: String, token: String, idempotencyKey: String) async throws -> LiveRegisteredDevice {
        try await get(
            try principalJSONRequest(method: .put, path: "/api/me/devices/\(pathValue(deviceID))/push-token", userID: userID, body: ["token": token, "environment": "simulator"], idempotencyKey: idempotencyKey),
            endpoint: .nativePushToken,
            as: LiveRegisteredDevice.self
        )
    }

    func revokeDevice(userID: String, deviceID: String, idempotencyKey: String) async throws -> LiveRegisteredDevice {
        try await get(
            APIRequest(method: .delete, path: "/api/me/devices/\(pathValue(deviceID))", idempotencyKey: idempotencyKey, authentication: .required(userID: userID), ownerBinding: .principal),
            endpoint: .nativeDeviceRevoke,
            as: LiveRegisteredDevice.self
        )
    }

    func getNotificationSettings(userID: String) async throws -> LiveNotificationSettings {
        try await get(
            principalRequest(path: "/api/me/notification-settings", userID: userID),
            endpoint: .notificationSettings,
            as: LiveNotificationSettings.self
        )
    }

    func updateNotificationSettings(userID: String, watchlistOpen: Bool, reservationUpdates: Bool, idempotencyKey: String) async throws -> LiveNotificationSettings {
        try await get(
            try principalJSONRequest(
                method: .put,
                path: "/api/me/notification-settings",
                userID: userID,
                body: ["watchlistOpen": watchlistOpen, "reservationUpdates": reservationUpdates],
                idempotencyKey: idempotencyKey
            ),
            endpoint: .notificationSettings,
            as: LiveNotificationSettings.self
        )
    }

    func getMobileTickets(userID: String) async throws -> [LiveMobileTicket] {
        try await get(principalRequest(path: "/api/me/tickets", userID: userID), endpoint: .mobileTickets, as: [LiveMobileTicket].self)
    }

    func issueMobileTicketQR(userID: String, ticketID: String, deviceID: String, idempotencyKey: String) async throws -> LiveMobileTicketQR {
        try await get(
            try principalJSONRequest(method: .post, path: "/api/me/tickets/\(pathValue(ticketID))/qr", userID: userID, body: ["deviceId": deviceID], idempotencyKey: idempotencyKey),
            endpoint: .mobileTicketQR,
            as: LiveMobileTicketQR.self
        )
    }

    func getSupportThreads(userID: String) async throws -> [LiveSupportThread] {
        try await get(APIRequest(
            path: "/api/me/support/threads",
            authentication: .required(userID: userID),
            ownerBinding: .principal
        ), endpoint: .supportThreads, as: [LiveSupportThread].self)
    }

    func getSupportPublicContent() async throws -> LiveSupportPublicContent {
        let content = try await get(
            APIRequest(path: "/api/support/v1/public"),
            endpoint: .supportPublic,
            bypassCapability: true,
            as: LiveSupportPublicContent.self
        )
        guard content.version == Self.discoveryVersion else {
            throw APIClientError.invalidResponse
        }
        return content
    }

    func createSupportThread(
        userID: String,
        category: String,
        subject: String,
        message: String,
        idempotencyKey: String
    ) async throws -> LiveSupportThread {
        let action = LiveAuthenticatedAction.supportThread(
            userID: userID,
            category: category,
            subject: subject,
            message: message,
            idempotencyKey: idempotencyKey
        )
        return try await get(action.request(), endpoint: action.endpoint, as: LiveSupportThread.self)
    }

    func addSupportMessage(
        userID: String,
        threadID: String,
        message: String,
        idempotencyKey: String
    ) async throws -> LiveSupportThread {
        let action = LiveAuthenticatedAction.supportMessage(
            userID: userID,
            threadID: threadID,
            message: message,
            idempotencyKey: idempotencyKey
        )
        return try await get(action.request(), endpoint: action.endpoint, as: LiveSupportThread.self)
    }

    func perform(_ action: LiveAuthenticatedAction) async throws -> LiveMutationReceipt {
        try await get(action.request(), endpoint: action.endpoint, as: LiveMutationReceipt.self)
    }

    private func get<Response: Decodable>(
        _ request: APIRequest,
        endpoint: LiveAPIEndpoint,
        bypassCapability: Bool = false,
        as type: Response.Type
    ) async throws -> Response {
        let data = try await data(for: request, endpoint: endpoint, bypassCapability: bypassCapability)
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIClientError.invalidResponse
        }
    }

    private func getDiscovery<Response: Decodable & LiveDiscoveryVersioned>(
        _ request: APIRequest,
        endpoint: LiveAPIEndpoint,
        as type: Response.Type
    ) async throws -> Response {
        let response = try await get(request, endpoint: endpoint, as: type)
        guard response.version == Self.discoveryVersion else {
            throw APIClientError.invalidResponse
        }
        return response
    }

    private func probeDiscoveryContract() async -> Bool {
        do {
            let response = try await get(
                APIRequest(path: "/api/discovery/v1/contract"),
                endpoint: .health,
                bypassCapability: true,
                as: LiveDiscoveryContractStatus.self
            )
            let requiredEndpoints = Set(["regions", "artists", "open-calendar"])
            return response.version == Self.discoveryVersion
                && requiredEndpoints.isSubset(of: Set(response.endpoints))
        } catch {
            return false
        }
    }

    private func probeSupportContract() async -> Bool {
        do {
            let response = try await get(
                APIRequest(path: "/api/support/v1/public"),
                endpoint: .supportPublic,
                bypassCapability: true,
                as: LiveSupportPublicContent.self
            )
            return response.version == Self.discoveryVersion
        } catch {
            return false
        }
    }

    private func probeNativeContract() async -> Set<String> {
        do {
            let response = try await get(
                APIRequest(path: "/api/native/v1/contract"),
                endpoint: .nativeContract,
                bypassCapability: true,
                as: LiveNativeContractStatus.self
            )
            guard response.version == Self.discoveryVersion else { return [] }
            return Set(response.endpoints)
        } catch {
            return []
        }
    }

    private func data(
        for request: APIRequest,
        endpoint: LiveAPIEndpoint,
        bypassCapability: Bool
    ) async throws -> Data {
        if !bypassCapability {
            try await ensureCapability(endpoint)
        }
        return try await apiClient.data(for: request)
    }

    private func diagnoseVersionlessState() async throws -> LiveAPIContractProbe {
        diagnosedVersionlessState = try await get(
            APIRequest(path: "/api/state"),
            endpoint: .state,
            bypassCapability: true,
            as: LiveState.self
        )
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: nil,
            validatedStateResponse: true,
            catalogRouteConfirmed: false
        )
        return LiveAPIContractProbe(
            diagnostics: capabilities.diagnostics,
            capabilities: capabilities
        )
    }

    private func ensureCapability(_ endpoint: LiveAPIEndpoint) async throws {
        var state = capabilities.state(for: endpoint)
        if case .unknown = state, allowsCapabilityBootstrap {
            _ = try await diagnosePublicContract()
            state = capabilities.state(for: endpoint)
        }
        guard state == .available else {
            throw APIClientError.capabilityUnavailable(endpoint: endpoint, state: state)
        }
    }

    private func pathValue(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    private func authenticatedRequest(path: String, userID: String) -> APIRequest {
        APIRequest(path: path, authentication: .required(userID: userID))
    }

    private func principalRequest(path: String, userID: String) -> APIRequest {
        APIRequest(
            path: path,
            authentication: .required(userID: userID),
            ownerBinding: .principal
        )
    }

    private func principalJSONRequest(
        method: APIRequestMethod,
        path: String,
        userID: String,
        body: [String: Any],
        idempotencyKey: String
    ) throws -> APIRequest {
        guard !userID.isEmpty,
              !idempotencyKey.isEmpty,
              JSONSerialization.isValidJSONObject(body) else {
            throw APIClientError.invalidResponse
        }
        return APIRequest(
            method: method,
            path: path,
            body: .json(try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])),
            idempotencyKey: idempotencyKey,
            authentication: .required(userID: userID),
            ownerBinding: .principal
        )
    }
}
