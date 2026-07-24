import Foundation

final class LiveBackendService {
    private let apiClient: APIClient
    private let decoder: JSONDecoder
    private let contract: LiveAPIContract

    init(
        apiClient: APIClient,
        decoder: JSONDecoder = JSONDecoder(),
        contract: LiveAPIContract = .deployed
    ) {
        self.apiClient = apiClient
        self.decoder = decoder
        self.contract = contract
    }

    var capabilityMap: LiveCapabilityMap {
        contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: nil
        )
    }

    func diagnosePublicContract() async throws -> LiveAPIContractProbe {
        let health = try await get(APIRequest(path: "/api/health"), as: LiveAPIHealth.self)
        let capabilities = contract.capabilityMap(
            for: apiClient.baseURL ?? contract.publicHost,
            observedResponseVersion: health.version
        )
        return LiveAPIContractProbe(
            diagnostics: capabilities.diagnostics,
            capabilities: capabilities
        )
    }

    func getState() async throws -> LiveState {
        try await get(APIRequest(path: "/api/state"), as: LiveState.self)
    }

    func getCatalog() async throws -> LiveCatalog {
        try await get(APIRequest(path: "/api/catalog"), as: LiveCatalog.self)
    }

    func getSeatMap(eventID: String) async throws -> LiveSeatMap {
        try await get(APIRequest(
            path: "/api/seat-map",
            query: [APIRequestQuery(name: "eventId", value: eventID)]
        ), as: LiveSeatMap.self)
    }

    func getSession(userID: String) async throws -> LiveSession {
        try await get(authenticatedRequest(path: "/api/users/\(pathValue(userID))/session", userID: userID), as: LiveSession.self)
    }

    func getTickets(userID: String) async throws -> [LiveTicket] {
        try await get(authenticatedRequest(path: "/api/users/\(pathValue(userID))/tickets", userID: userID), as: [LiveTicket].self)
    }

    func getWatchlist(userID: String) async throws -> [LiveWatchlistItem] {
        try await get(authenticatedRequest(path: "/api/users/\(pathValue(userID))/watchlist", userID: userID), as: [LiveWatchlistItem].self)
    }

    func getSupportThreads(userID: String) async throws -> [LiveSupportThread] {
        try await get(APIRequest(
            path: "/api/support/threads",
            query: [APIRequestQuery(name: "userId", value: userID)],
            authentication: .required(userID: userID)
        ), as: [LiveSupportThread].self)
    }

    private func get<Response: Decodable>(_ request: APIRequest, as type: Response.Type) async throws -> Response {
        let data = try await apiClient.data(for: request)
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIClientError.invalidResponse
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
