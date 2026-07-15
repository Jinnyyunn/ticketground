import Foundation

final class LiveBackendService {
    private let apiClient: APIClient
    private let decoder: JSONDecoder

    init(apiClient: APIClient, decoder: JSONDecoder = JSONDecoder()) {
        self.apiClient = apiClient
        self.decoder = decoder
    }

    func getState() async throws -> LiveState {
        try await get("/api/state", as: LiveState.self)
    }

    func getCatalog() async throws -> LiveCatalog {
        try await get("/api/catalog", as: LiveCatalog.self)
    }

    func getSeatMap(eventID: String) async throws -> LiveSeatMap {
        try await get("/api/seat-map?eventId=\(queryValue(eventID))", as: LiveSeatMap.self)
    }

    func getSession(userID: String) async throws -> LiveSession {
        try await get("/api/users/\(pathValue(userID))/session", as: LiveSession.self)
    }

    func getTickets(userID: String) async throws -> [LiveTicket] {
        try await get("/api/users/\(pathValue(userID))/tickets", as: [LiveTicket].self)
    }

    func getWatchlist(userID: String) async throws -> [LiveWatchlistItem] {
        try await get("/api/users/\(pathValue(userID))/watchlist", as: [LiveWatchlistItem].self)
    }

    func getSupportThreads(userID: String) async throws -> [LiveSupportThread] {
        try await get("/api/support/threads?userId=\(queryValue(userID))", as: [LiveSupportThread].self)
    }

    private func get<Response: Decodable>(_ path: String, as type: Response.Type) async throws -> Response {
        let data = try await apiClient.data(for: path)
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIClientError.invalidResponse
        }
    }

    private func pathValue(_ value: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    private func queryValue(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: "&=+")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}
