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
            catalogRouteConfirmed: false,
            nativeAccountRoutesConfirmed: health.capabilities?.contains("native-account-v1") == true,
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true
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
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: version,
            validatedStateResponse: false,
            catalogRouteConfirmed: true,
            discoveryRoutesConfirmed: discoveryRoutesConfirmed,
            nativeAccountRoutesConfirmed: health.capabilities?.contains("native-account-v1") == true,
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true
        )
        return LiveAPIContractProbe(
            diagnostics: capabilities.diagnostics,
            capabilities: capabilities
        )
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
            nativeSupportRoutesConfirmed: health.capabilities?.contains("native-support-v1") == true
        )
        return LiveAPIContractProbe(diagnostics: capabilities.diagnostics, capabilities: capabilities)
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

    func getPublicSupport() async throws -> LivePublicSupport {
        try await get(APIRequest(path: "/api/support/public"), endpoint: .publicSupport, as: LivePublicSupport.self)
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
            authenticatedRequest(path: "/api/users/\(pathValue(userID))/watchlist", userID: userID),
            endpoint: .watchlist,
            as: [LiveWatchlistItem].self
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
            ownerBinding: .bearerPrincipal
        )
    }
}
