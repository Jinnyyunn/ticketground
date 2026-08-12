import Foundation

struct LifecycleDeviceCredential { let deviceID: String; let token: String; let attestation: String }
struct UITestLifecycleConfiguration { let scenario: UITestLifecycleScenario; let route: AppRoute }
enum UITestLifecycleScenario: String { case happy, signedOut = "signed-out", unavailable, expiredQR = "expired-qr", serverError = "server-error" }

extension RuntimeConfiguration {
    static var lifecycleDeviceCredential: LifecycleDeviceCredential? {
        guard let scenario = liveLifecycleTestConfiguration?.scenario, scenario == .happy || scenario == .expiredQR else { return nil }
        return LifecycleDeviceCredential(deviceID: "ui-device", token: "ui-device-secret", attestation: "ui-attestation")
    }
    static var liveLifecycleTestConfiguration: UITestLifecycleConfiguration? {
        let arguments = ProcessInfo.processInfo.arguments
        guard arguments.contains("-ui-testing"), let scenarioIndex = arguments.firstIndex(of: "-live-lifecycle-scenario"), arguments.indices.contains(scenarioIndex + 1), let routeIndex = arguments.firstIndex(of: "-live-lifecycle-route"), arguments.indices.contains(routeIndex + 1), let scenario = UITestLifecycleScenario(rawValue: arguments[scenarioIndex + 1]) else { return nil }
        let route: AppRoute = switch arguments[routeIndex + 1] { case "cancel": .cancel; case "resale": .resale; default: .reservation(id: UITestLifecycleAPIClient.ticketID) }
        return UITestLifecycleConfiguration(scenario: scenario, route: route)
    }
}

final class UITestLifecycleAPIClient: APIClient {
    static let ticketID = "ui-lifecycle-ticket"
    let mode: APIDataMode = .live
    let baseURL = URL(string: "https://ui-lifecycle.ticketground.invalid/")
    private let scenario: UITestLifecycleScenario
    init(scenario: UITestLifecycleScenario) { self.scenario = scenario }
    func data(for request: APIRequest) async throws -> Data {
        if scenario == .serverError, request.path == "/api/me/tickets" { throw APIClientError.server(status: 503, code: "LIFECYCLE_UNAVAILABLE", message: "temporary failure") }
        switch (request.method, request.path) {
        case (.get, "/api/health"):
            let capabilities = scenario == .unavailable ? "[]" : "[\"native-account-v1\",\"native-lifecycle-v1\"]"
            return json("{\"status\":\"ok\",\"version\":\"78b3c7c\",\"capabilities\":\(capabilities)}")
        case (.get, "/api/state"): return json("{\"events\":[],\"venues\":[],\"users\":[],\"tickets\":[],\"resalePools\":[],\"backendSummary\":{\"events\":0,\"tickets\":0},\"ledger\":{\"verified\":true,\"totalEntries\":0}}")
        case (.get, "/api/catalog"): return json("{\"events\":[],\"venues\":[],\"total\":0}")
        case (.get, "/api/discovery/v1/contract"): return json("{\"version\":\"1\",\"endpoints\":[]}")
        case (.get, "/api/me/tickets"): return json("[{\"id\":\"\(Self.ticketID)\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"seatLabel\":\"VIP A1\",\"status\":\"OWNED\",\"available\":false,\"faceValue\":120000,\"minPrice\":90000,\"maxPrice\":120000,\"transferCount\":0,\"maxTransferCount\":0,\"event\":{\"id\":\"event-1\",\"title\":\"UI 테스트 콘서트\",\"venue\":\"테스트홀\",\"performance\":{\"id\":\"performance-1\",\"label\":\"8월 20일 19:00\",\"startsAt\":\"2026-08-20T19:00:00+09:00\"}},\"payment\":{\"amount\":120000,\"method\":\"카드\",\"status\":\"PAID\"}}]")
        case (.get, "/api/me/resale-pools"): return json("[{\"id\":\"pool-other\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"ticketId\":\"other-ticket\",\"showSlug\":\"ui-show\",\"price\":100000,\"buyerFee\":5000,\"buyerTotal\":105000,\"sellerSettlement\":95000,\"buyerCount\":1,\"status\":\"OPEN\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"matchedAt\":null}]")
        case (.get, "/api/me/cancellation-requests"): return json("[]")
        case (.get, "/api/me/devices"): return json("[{\"id\":\"device-record\",\"deviceId\":\"ui-device\",\"deviceName\":\"UI iPhone\",\"platform\":\"iOS\",\"status\":\"TRUSTED\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"lastVerifiedAt\":\"2026-08-12T09:00:00Z\",\"revokedAt\":null}]")
        case (.get, "/api/me/push-tokens"): return json("[{\"platform\":\"ios\",\"status\":\"ACTIVE\",\"suffix\":\"cdef\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"updatedAt\":\"2026-08-12T09:00:00Z\"}]")
        case (.post, "/api/tickets/qr"): let expiry = scenario == .expiredQR ? "2000-01-01T00:00:00Z" : "2099-01-01T00:00:00Z"; return json("{\"type\":\"admission\",\"ticketId\":\"\(Self.ticketID)\",\"ownerId\":\"ui-user\",\"expiresAt\":\"\(expiry)\",\"nonce\":\"nonce\",\"signature\":\"signature\",\"issuedAt\":\"2026-08-12T09:00:00Z\",\"performanceStartsAt\":\"2026-08-20T10:00:00Z\",\"preparedAt\":\"2026-08-12T09:00:00Z\",\"activeAt\":\"2026-08-12T09:00:00Z\",\"ttlSeconds\":60,\"traceCode\":\"trace\",\"channel\":\"APP\",\"emergencyReason\":null}")
        case (.post, "/api/me/cancellation-requests"): return json("{\"id\":\"cancel-1\",\"ticketId\":\"\(Self.ticketID)\",\"reason\":\"일정 변경\",\"refundAcknowledged\":true,\"status\":\"PENDING_REVIEW\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"updatedAt\":\"2026-08-12T09:00:00Z\"}")
        case (.post, "/api/me/resale-pools"): return json("{\"id\":\"pool-own\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"ticketId\":\"\(Self.ticketID)\",\"showSlug\":null,\"price\":100000,\"buyerFee\":5000,\"buyerTotal\":105000,\"sellerSettlement\":95000,\"buyerCount\":0,\"status\":\"OPEN\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"matchedAt\":null}")
        case (.post, let path) where path.hasSuffix("/join"): return json("{\"id\":\"pool-other\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"ticketId\":\"other-ticket\",\"showSlug\":\"ui-show\",\"price\":100000,\"buyerFee\":5000,\"buyerTotal\":105000,\"sellerSettlement\":95000,\"buyerCount\":2,\"status\":\"OPEN\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"matchedAt\":null}")
        default: throw APIClientError.invalidResponse
        }
    }
    func resolveResource(_ reference: String?) -> String? { reference }
    private func json(_ value: String) -> Data { Data(value.utf8) }
}
