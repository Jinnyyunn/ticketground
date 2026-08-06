import Foundation

enum TosspaymentsError: Error, Equatable, LocalizedError {
    case httpsRequired
    case missingSession
    case notConfigured
    case ticketNotFound
    case network
    case server(code: String, message: String)

    var errorDescription: String? {
        switch self {
        case .httpsRequired: return "결제는 HTTPS 서버에서만 진행할 수 있습니다."
        case .missingSession: return "로그인이 필요합니다."
        case .notConfigured: return "토스페이먼츠가 아직 설정되어 있지 않습니다."
        case .ticketNotFound: return "선택한 티켓을 확인할 수 없습니다."
        case .network: return "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        case .server(_, let message): return message
        }
    }
}

struct TosspaymentsConfig: Decodable, Equatable {
    let configured: Bool
    let clientKey: String
}

struct TosspaymentsPurchaseResult: Decodable, Equatable {
    struct Ticket: Decodable, Equatable {
        let id: String
        let seatLabel: String
    }

    let ticket: Ticket
}

// Mirrors GoogleNativeSessionClient's shape: a direct, standalone caller of
// APIClient rather than going through LiveBackendService's health-check-gated
// capability map - these routes are always on (mock-mode fallback server side
// when unconfigured), so there is no "native-tosspayments-v1" capability
// string to negotiate.
final class TosspaymentsClient {
    private let apiClient: APIClient
    private let sessionStore: SessionStore

    init(apiClient: APIClient, sessionStore: SessionStore) {
        self.apiClient = apiClient
        self.sessionStore = sessionStore
    }

    // Bypasses LiveBackendService.getState()'s capability gate on purpose - that
    // gate requires diagnosePublicContract() to have already "proven" /api/state
    // is reachable, which this standalone client never bootstraps. /api/state is
    // an always-on public read (same as the web checkout panel's own getState()
    // call), so there is nothing to negotiate here.
    func fetchTicket(ticketID: String) async throws -> LiveTicket {
        guard apiClient.baseURL?.scheme?.lowercased() == "https" else {
            throw TosspaymentsError.httpsRequired
        }
        do {
            let data = try await apiClient.data(for: APIRequest(path: "/api/state"))
            let state: LiveState = try decode(data)
            guard let ticket = state.tickets?.first(where: { $0.id == ticketID }) else {
                throw TosspaymentsError.ticketNotFound
            }
            return ticket
        } catch let error as APIClientError {
            throw map(error)
        }
    }

    func fetchConfig() async throws -> TosspaymentsConfig {
        guard apiClient.baseURL?.scheme?.lowercased() == "https" else {
            throw TosspaymentsError.httpsRequired
        }
        do {
            let data = try await apiClient.data(for: APIRequest(path: "/api/payments/tosspayments/config"))
            return try decode(data)
        } catch let error as APIClientError {
            throw map(error)
        }
    }

    func confirmPurchase(
        ticketID: String,
        paymentMethod: String,
        tossPaymentKey: String,
        idempotencyKey: String
    ) async throws -> TosspaymentsPurchaseResult {
        guard apiClient.baseURL?.scheme?.lowercased() == "https" else {
            throw TosspaymentsError.httpsRequired
        }
        guard let userID = sessionStore.current?.userID, !userID.isEmpty else {
            throw TosspaymentsError.missingSession
        }
        let body = try JSONEncoder().encode([
            "userId": userID,
            "ticketId": ticketID,
            "paymentMethod": paymentMethod,
            "tossPaymentKey": tossPaymentKey
        ])
        do {
            let data = try await apiClient.data(for: APIRequest(
                method: .post,
                path: "/api/payments/tosspayments/purchase",
                body: .json(body),
                idempotencyKey: idempotencyKey,
                authentication: .required(userID: userID),
                ownerBinding: .jsonField("userId")
            ))
            return try decode(data)
        } catch let error as APIClientError {
            throw map(error)
        }
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        guard let value = try? JSONDecoder().decode(T.self, from: data) else {
            throw TosspaymentsError.network
        }
        return value
    }

    private func map(_ error: APIClientError) -> TosspaymentsError {
        switch error {
        case .insecureCredentialTransport: return .httpsRequired
        case .missingCredential, .credentialOwnerMismatch: return .missingSession
        case .server(_, let code, let message): return .server(code: code, message: message)
        case .invalidResponse, .requestFailed, .liveTransportUnavailable, .invalidBaseURL, .reservedRequestHeader, .capabilityUnavailable:
            return .network
        }
    }
}
