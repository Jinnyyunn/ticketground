import Foundation

final class LiveBackendService {
    private let apiClient: APIClient
    private let decoder: JSONDecoder
    private let contract: LiveAPIContract
    private var capabilities: LiveCapabilityMap
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
        let data = try await data(
            for: APIRequest(path: contract.bootstrapPath),
            endpoint: .health,
            bypassCapability: true
        )
        let observation = try observeBootstrap(from: data)
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: observation.version,
            validatedStateResponse: observation.validatedStateResponse,
            catalogRouteConfirmed: false
        )
        return LiveAPIContractProbe(
            diagnostics: capabilities.diagnostics,
            capabilities: capabilities
        )
    }

    func getState() async throws -> LiveState {
        try await get(APIRequest(path: "/api/state"), endpoint: .state, as: LiveState.self)
    }

    func getCatalog() async throws -> LiveCatalog {
        try await get(APIRequest(path: "/api/catalog"), endpoint: .catalog, as: LiveCatalog.self)
    }

    func getSeatMap(eventID: String) async throws -> LiveSeatMap {
        try await get(APIRequest(
            path: "/api/seat-map",
            query: [APIRequestQuery(name: "eventId", value: eventID)]
        ), endpoint: .seatMap, as: LiveSeatMap.self)
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
            authenticatedRequest(path: "/api/users/\(pathValue(userID))/watchlist", userID: userID),
            endpoint: .watchlist,
            as: [LiveWatchlistItem].self
        )
    }

    func getSupportThreads(userID: String) async throws -> [LiveSupportThread] {
        try await get(APIRequest(
            path: "/api/support/threads",
            query: [APIRequestQuery(name: "userId", value: userID)],
            authentication: .required(userID: userID)
        ), endpoint: .supportThreads, as: [LiveSupportThread].self)
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

    private func observeBootstrap(from data: Data) throws -> (version: String?, validatedStateResponse: Bool) {
        if let health = try? decoder.decode(LiveAPIHealth.self, from: data),
           let version = health.version,
           !version.isEmpty {
            return (version, false)
        }
        guard (try? decoder.decode(LiveState.self, from: data)) != nil else {
            throw APIClientError.invalidResponse
        }
        return (nil, true)
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
}
