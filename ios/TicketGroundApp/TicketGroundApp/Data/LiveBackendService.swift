import Foundation

final class LiveBackendService {
    private static let discoveryVersion = "1"
    private let apiClient: APIClient
    private let decoder: JSONDecoder
    private let contract: LiveAPIContract
    private var capabilities: LiveCapabilityMap
    private var diagnosedState: LiveState?
    private var seatMapAdmission: LiveSeatMapAdmission?
    private var diagnosedSeatMap: LiveSeatMap?

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
            capabilities = contract.capabilityMap(
                for: apiClient.baseURL ?? contract.publicHost,
                observedResponseVersion: nil
            )
            return try await diagnoseVersionlessState()
        }
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: version,
            nativeAccountRoutesConfirmed: health.capabilities?.contains("native-account-v1") == true,
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true,
            nativeWatchlistRoutesConfirmed: health.capabilities?.contains("native-watchlist-v1") == true,
            nativeBookingHoldsRoutesConfirmed: health.capabilities?.contains("native-booking-holds-v1") == true
        )
        guard capabilities.diagnostics.compatibility == .compatible else {
            return LiveAPIContractProbe(
                diagnostics: capabilities.diagnostics,
                capabilities: capabilities
            )
        }

        diagnosedState = await probeState()
        var provenPublicEndpoints = await probeDiscoveryContract()
        if diagnosedState != nil {
            provenPublicEndpoints.insert(.state)
        }
        if await probeCatalog() {
            provenPublicEndpoints.insert(.catalog)
        }
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: version,
            provenPublicEndpoints: provenPublicEndpoints,
            nativeAccountRoutesConfirmed: health.capabilities?.contains("native-account-v1") == true,
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true,
            nativeWatchlistRoutesConfirmed: health.capabilities?.contains("native-watchlist-v1") == true,
            nativeBookingHoldsRoutesConfirmed: health.capabilities?.contains("native-booking-holds-v1") == true
        )
        return LiveAPIContractProbe(
            diagnostics: capabilities.diagnostics,
            capabilities: capabilities
        )
    }

    func diagnoseSeatMap(eventID: String, performanceDateID: String? = nil) async throws -> LiveSeatMap {
        let state = capabilities.state(for: .seatMap)
        clearSeatMapProof()
        guard !eventID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw APIClientError.invalidResponse
        }
        if case .incompatible = state {
            throw APIClientError.capabilityUnavailable(endpoint: .seatMap, state: state)
        }
        let seatMap: LiveSeatMap
        do {
            seatMap = try await fetchSeatMap(
                eventID: eventID,
                performanceDateID: performanceDateID,
                bypassCapability: true
            )
        } catch {
            clearSeatMapProof()
            throw error
        }
        var states = capabilities.states
        states[.seatMap] = .available
        capabilities = LiveCapabilityMap(
            diagnostics: capabilities.diagnostics,
            baseURL: capabilities.baseURL,
            states: states
        )
        seatMapAdmission = LiveSeatMapAdmission(
            eventID: eventID,
            performanceDateID: performanceDateID
        )
        diagnosedSeatMap = seatMap
        return seatMap
    }

    func diagnoseSupportContract() async throws -> LiveAPIContractProbe {
        let health = try await get(
            APIRequest(path: contract.bootstrapPath),
            endpoint: .health,
            bypassCapability: true,
            as: LiveAPIHealth.self
        )
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: health.version,
            nativeAccountRoutesConfirmed: health.capabilities?.contains("native-account-v1") == true,
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true,
            nativeWatchlistRoutesConfirmed: health.capabilities?.contains("native-watchlist-v1") == true,
            nativeBookingHoldsRoutesConfirmed: health.capabilities?.contains("native-booking-holds-v1") == true
        )
        return LiveAPIContractProbe(diagnostics: capabilities.diagnostics, capabilities: capabilities)
    }

    func diagnoseWatchlistContract() async throws -> LiveAPIContractProbe {
        let health = try await get(
            APIRequest(path: contract.bootstrapPath),
            endpoint: .health,
            bypassCapability: true,
            as: LiveAPIHealth.self
        )
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: health.version,
            nativeAccountRoutesConfirmed: health.capabilities?.contains("native-account-v1") == true,
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true,
            nativeWatchlistRoutesConfirmed: health.capabilities?.contains("native-watchlist-v1") == true,
            nativeBookingHoldsRoutesConfirmed: health.capabilities?.contains("native-booking-holds-v1") == true
        )
        return LiveAPIContractProbe(diagnostics: capabilities.diagnostics, capabilities: capabilities)
    }

    func diagnoseBookingHoldsContract() async throws -> LiveAPIContractProbe {
        let health = try await get(
            APIRequest(path: contract.bootstrapPath),
            endpoint: .health,
            bypassCapability: true,
            as: LiveAPIHealth.self
        )
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: health.version,
            nativeAccountRoutesConfirmed: health.capabilities?.contains("native-account-v1") == true,
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true,
            nativeWatchlistRoutesConfirmed: health.capabilities?.contains("native-watchlist-v1") == true,
            nativeBookingHoldsRoutesConfirmed: health.capabilities?.contains("native-booking-holds-v1") == true
        )
        return LiveAPIContractProbe(diagnostics: capabilities.diagnostics, capabilities: capabilities)
    }

    func getState() async throws -> LiveState {
        let state = capabilities.state(for: .state)
        guard state == .available else {
            diagnosedState = nil
            throw APIClientError.capabilityUnavailable(endpoint: .state, state: state)
        }
        if let diagnosedState {
            self.diagnosedState = nil
            return diagnosedState
        }
        return try await get(APIRequest(path: "/api/state"), endpoint: .state, as: LiveState.self)
    }

    func getCatalog(limit: Int = LiveCatalogReadPolicy.defaultLimit) async throws -> LiveCatalog {
        guard LiveCatalogReadPolicy.accepts(limit: limit) else {
            throw APIClientError.invalidResponse
        }

        var events: [LiveBackendCatalogEvent] = []
        var venues: [LiveCatalogVenue]?
        var total: Int?
        var cursor: String?
        var seenCursors: Set<String> = []

        for pageIndex in 0..<LiveCatalogReadPolicy.maximumPages {
            var query = [APIRequestQuery(name: "limit", value: String(limit))]
            if let cursor {
                query.append(APIRequestQuery(name: "cursor", value: cursor))
            }
            let page = try await get(
                APIRequest(path: "/api/catalog", query: query),
                endpoint: .catalog,
                as: LiveCatalog.self
            )
            events.append(contentsOf: page.events)
            if let pageVenues = page.venues {
                if venues == nil { venues = [] }
                venues?.append(contentsOf: pageVenues)
            }
            if total == nil { total = page.total }

            guard let nextCursor = page.nextCursor else {
                return LiveCatalog(events: events, venues: venues, nextCursor: nil, total: total)
            }
            guard !nextCursor.isEmpty,
                  seenCursors.insert(nextCursor).inserted,
                  pageIndex + 1 < LiveCatalogReadPolicy.maximumPages else {
                throw APIClientError.invalidResponse
            }
            cursor = nextCursor
        }
        throw APIClientError.invalidResponse
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

    func getPublicSupport() async throws -> LivePublicSupport {
        try await get(APIRequest(path: "/api/support/public"), endpoint: .publicSupport, as: LivePublicSupport.self)
    }

    func getSeatMap(eventID: String, performanceDateID: String? = nil) async throws -> LiveSeatMap {
        let state = capabilities.state(for: .seatMap)
        guard state == .available else {
            seatMapAdmission = nil
            diagnosedSeatMap = nil
            throw APIClientError.capabilityUnavailable(endpoint: .seatMap, state: state)
        }
        guard seatMapAdmission?.matches(
            eventID: eventID,
            performanceDateID: performanceDateID
        ) == true else {
            throw APIClientError.capabilityUnavailable(endpoint: .seatMap, state: unprovedSeatMapState)
        }
        if let diagnosedSeatMap {
            self.diagnosedSeatMap = nil
            return diagnosedSeatMap
        }
        do {
            return try await fetchSeatMap(
                eventID: eventID,
                performanceDateID: performanceDateID,
                bypassCapability: false
            )
        } catch {
            clearSeatMapProof()
            throw error
        }
    }

    func getVenueSeatMap(eventID _: String) async throws -> LiveVenueSeatMap {
        throw APIClientError.capabilityUnavailable(endpoint: .seatMap, state: unprovedSeatMapState)
    }

    func getSession(userID: String) async throws -> LiveSession {
        try await get(
            principalRequest(path: "/api/me", userID: userID),
            endpoint: .session,
            as: LiveSession.self
        )
    }

    func getTickets(userID: String) async throws -> [LiveTicket] {
        try await get(
            principalRequest(path: "/api/me/tickets", userID: userID),
            endpoint: .tickets,
            as: [LiveTicket].self
        )
    }

    func updateProfile(userID: String, name: String) async throws -> LiveSession {
        let body = try JSONEncoder().encode(["name": name])
        return try await get(
            APIRequest(
                method: .patch,
                path: "/api/me/profile",
                body: .json(body),
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .session,
            as: LiveSession.self
        )
    }

    func getWatchlist(userID: String) async throws -> [LiveWatchlistItem] {
        try await get(
            principalRequest(path: "/api/me/watchlist", userID: userID),
            endpoint: .watchlist,
            as: [LiveWatchlistItem].self
        )
    }

    func upsertWatchlist(
        userID: String,
        eventID: String,
        channels: [String],
        calendarEnabled: Bool,
        notificationEnabled: Bool
    ) async throws -> LiveWatchlistItem {
        let body = try JSONEncoder().encode(LiveWatchlistPreferences(
            channels: channels,
            calendarEnabled: calendarEnabled,
            notificationEnabled: notificationEnabled
        ))
        return try await get(
            APIRequest(
                method: .put,
                path: "/api/me/watchlist/\(pathValue(eventID))",
                body: .json(body),
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .watchlistUpsert,
            as: LiveWatchlistItem.self
        )
    }

    func deleteWatchlist(userID: String, eventID: String) async throws -> LiveWatchlistDeletion {
        try await get(
            APIRequest(
                method: .delete,
                path: "/api/me/watchlist/\(pathValue(eventID))",
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .watchlistDelete,
            as: LiveWatchlistDeletion.self
        )
    }

    func enterQueue(userID: String, performanceDateID: String) async throws -> LiveQueueEntry {
        let body = try JSONEncoder().encode(["performanceDateId": performanceDateID])
        return try await get(
            APIRequest(
                method: .post,
                path: "/api/me/queue-entries",
                body: .json(body),
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .queueEntryEnter,
            as: LiveQueueEntry.self
        )
    }

    func getQueueEntry(userID: String, entryID: String) async throws -> LiveQueueEntry {
        try await get(
            principalRequest(path: "/api/me/queue-entries/\(pathValue(entryID))", userID: userID),
            endpoint: .queueEntryStatus,
            as: LiveQueueEntry.self
        )
    }

    func leaveQueue(userID: String, entryID: String) async throws -> LiveQueueEntryLeaveResult {
        try await get(
            APIRequest(
                method: .delete,
                path: "/api/me/queue-entries/\(pathValue(entryID))",
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .queueEntryLeave,
            as: LiveQueueEntryLeaveResult.self
        )
    }

    func createSeatHold(
        userID: String,
        performanceDateID: String,
        ticketIDs: [String],
        idempotencyKey: String
    ) async throws -> LiveSeatHold {
        let body = try JSONEncoder().encode(LiveSeatHoldRequest(performanceDateId: performanceDateID, ticketIds: ticketIDs))
        return try await get(
            APIRequest(
                method: .post,
                path: "/api/me/seat-holds",
                body: .json(body),
                idempotencyKey: idempotencyKey,
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .seatHoldCreate,
            as: LiveSeatHold.self
        )
    }

    func getSeatHold(userID: String, holdID: String) async throws -> LiveSeatHold {
        try await get(
            principalRequest(path: "/api/me/seat-holds/\(pathValue(holdID))", userID: userID),
            endpoint: .seatHoldStatus,
            as: LiveSeatHold.self
        )
    }

    func extendSeatHold(userID: String, holdID: String) async throws -> LiveSeatHold {
        try await get(
            APIRequest(
                method: .patch,
                path: "/api/me/seat-holds/\(pathValue(holdID))/extend",
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .seatHoldExtend,
            as: LiveSeatHold.self
        )
    }

    func releaseSeatHold(userID: String, holdID: String) async throws -> LiveSeatHold {
        try await get(
            APIRequest(
                method: .delete,
                path: "/api/me/seat-holds/\(pathValue(holdID))",
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .seatHoldRelease,
            as: LiveSeatHold.self
        )
    }

    func createReservationDraft(
        userID: String,
        holdID: String,
        idempotencyKey: String
    ) async throws -> LiveReservationDraft {
        let body = try JSONEncoder().encode(["holdId": holdID])
        return try await get(
            APIRequest(
                method: .post,
                path: "/api/me/reservation-drafts",
                body: .json(body),
                idempotencyKey: idempotencyKey,
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .reservationDraftCreate,
            as: LiveReservationDraft.self
        )
    }

    func getReservationDraft(userID: String, draftID: String) async throws -> LiveReservationDraft {
        try await get(
            principalRequest(path: "/api/me/reservation-drafts/\(pathValue(draftID))", userID: userID),
            endpoint: .reservationDraftStatus,
            as: LiveReservationDraft.self
        )
    }

    func cancelReservationDraft(userID: String, draftID: String) async throws -> LiveReservationDraft {
        try await get(
            APIRequest(
                method: .delete,
                path: "/api/me/reservation-drafts/\(pathValue(draftID))",
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .reservationDraftCancel,
            as: LiveReservationDraft.self
        )
    }

    func getSupportThreads(userID: String) async throws -> [LiveSupportThread] {
        try await get(
            principalRequest(path: "/api/me/support/threads", userID: userID),
            endpoint: .supportThreads,
            as: [LiveSupportThread].self
        )
    }

    func createSupportThread(
        userID: String,
        subject: String,
        message: String,
        idempotencyKey: String
    ) async throws -> LiveSupportThread {
        let body = try JSONEncoder().encode(["subject": subject, "message": message])
        return try await get(
            APIRequest(
                method: .post,
                path: "/api/me/support/threads",
                body: .json(body),
                idempotencyKey: idempotencyKey,
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .supportThreadMutation,
            as: LiveSupportThread.self
        )
    }

    func addSupportMessage(
        userID: String,
        threadID: String,
        message: String,
        idempotencyKey: String
    ) async throws -> LiveSupportThread {
        let body = try JSONEncoder().encode(["threadId": threadID, "message": message])
        return try await get(
            APIRequest(
                method: .post,
                path: "/api/me/support/messages",
                body: .json(body),
                idempotencyKey: idempotencyKey,
                authentication: .required(userID: userID),
                ownerBinding: .bearerPrincipal
            ),
            endpoint: .supportMessages,
            as: LiveSupportThread.self
        )
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

    private func probeDiscoveryContract() async -> Set<LiveAPIEndpoint> {
        do {
            let response = try await get(
                APIRequest(path: "/api/discovery/v1/contract"),
                endpoint: .health,
                bypassCapability: true,
                as: LiveDiscoveryContractStatus.self
            )
            guard response.version == Self.discoveryVersion else { return [] }
            let endpoints = Set(response.endpoints)
            var proven: Set<LiveAPIEndpoint> = []
            if endpoints.contains("regions") { proven.insert(.regions) }
            if endpoints.contains("artists") { proven.insert(.artist) }
            if endpoints.contains("open-calendar") { proven.insert(.openCalendar) }
            return proven
        } catch {
            return []
        }
    }

    private func probeState() async -> LiveState? {
        try? await get(
            APIRequest(path: "/api/state"),
            endpoint: .state,
            bypassCapability: true,
            as: LiveState.self
        )
    }

    private func probeCatalog() async -> Bool {
        do {
            _ = try await get(
                APIRequest(path: "/api/catalog", query: [APIRequestQuery(name: "limit", value: "1")]),
                endpoint: .catalog,
                bypassCapability: true,
                as: LiveCatalog.self
            )
            return true
        } catch {
            return false
        }
    }

    private func fetchSeatMap(
        eventID: String,
        performanceDateID: String?,
        bypassCapability: Bool
    ) async throws -> LiveSeatMap {
        var query = [APIRequestQuery(name: "eventId", value: eventID)]
        if let performanceDateID {
            query.append(APIRequestQuery(name: "performanceDateId", value: performanceDateID))
        }
        let seatMap = try await get(
            APIRequest(
                path: "/api/seat-map",
                query: query
            ),
            endpoint: .seatMap,
            bypassCapability: bypassCapability,
            as: LiveSeatMap.self
        )
        guard !seatMap.event.id.isEmpty, seatMap.event.id == eventID else {
            throw APIClientError.invalidResponse
        }
        return seatMap
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
        diagnosedState = try await get(
            APIRequest(path: "/api/state"),
            endpoint: .state,
            bypassCapability: true,
            as: LiveState.self
        )
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: nil,
            provenPublicEndpoints: [.state]
        )
        return LiveAPIContractProbe(
            diagnostics: capabilities.diagnostics,
            capabilities: capabilities
        )
    }

    private func ensureCapability(_ endpoint: LiveAPIEndpoint) async throws {
        let state = capabilities.state(for: endpoint)
        guard state == .available else {
            throw APIClientError.capabilityUnavailable(endpoint: endpoint, state: state)
        }
    }

    private var unprovedSeatMapState: LiveCapabilityState {
        let state = capabilities.state(for: .seatMap)
        if case .incompatible = state {
            return state
        }
        return .unknown
    }

    private func clearSeatMapProof() {
        seatMapAdmission = nil
        diagnosedSeatMap = nil
        var states = capabilities.states
        if case .incompatible = states[.seatMap] {
            return
        }
        states[.seatMap] = .unknown
        capabilities = LiveCapabilityMap(
            diagnostics: capabilities.diagnostics,
            baseURL: capabilities.baseURL,
            states: states
        )
    }

    private func pathValue(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    private func principalRequest(path: String, userID: String) -> APIRequest {
        APIRequest(
            path: path,
            authentication: .required(userID: userID),
            ownerBinding: .bearerPrincipal
        )
    }
}

private struct LiveWatchlistPreferences: Encodable {
    let channels: [String]
    let calendarEnabled: Bool
    let notificationEnabled: Bool
}

private struct LiveSeatHoldRequest: Encodable {
    let performanceDateId: String
    let ticketIds: [String]
}
