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
        let health = try await get(
            APIRequest(path: "/api/health"),
            endpoint: .health,
            bypassCapability: true,
            as: LiveAPIHealth.self
        )
        capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: health.version
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
        if !bypassCapability {
            try await ensureCapability(endpoint)
        }
        let data = try await apiClient.data(for: request)
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIClientError.invalidResponse
        }
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
