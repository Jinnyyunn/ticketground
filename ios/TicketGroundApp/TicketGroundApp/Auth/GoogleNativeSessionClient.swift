import Foundation

enum GoogleLoginError: Error, Equatable, LocalizedError {
    case cancelled
    case httpsRequired
    case invalidCredential
    case invalidResponse
    case missingConfiguration
    case network

    var errorDescription: String? {
        switch self {
        case .cancelled: return "Google 로그인 요청을 취소했습니다."
        case .httpsRequired: return "Google 로그인은 HTTPS 서버에서만 사용할 수 있습니다."
        case .invalidCredential: return "Google 인증 정보를 확인할 수 없습니다."
        case .invalidResponse: return "로그인 서버 응답을 확인할 수 없습니다."
        case .missingConfiguration: return "Google 로그인 설정이 필요합니다."
        case .network: return "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        }
    }
}

struct GoogleSessionUser: Decodable, Equatable {
    let id: String
    let name: String
    let status: String
    let trustScore: Int
    let profileConfirmed: Bool
}

private struct GoogleNativeSessionResponse: Decodable {
    struct Session: Decodable {
        let credential: String
        let expiresAt: String
    }

    let user: GoogleSessionUser
    let session: Session
}

final class GoogleNativeSessionClient {
    private let apiClient: APIClient
    private let sessionStore: SessionStore

    init(apiClient: APIClient, sessionStore: SessionStore) {
        self.apiClient = apiClient
        self.sessionStore = sessionStore
    }

    func exchange(idToken: String) async throws -> GoogleSessionUser {
        guard !idToken.isEmpty else { throw GoogleLoginError.invalidCredential }
        guard apiClient.baseURL?.scheme?.lowercased() == "https" else {
            throw GoogleLoginError.httpsRequired
        }
        let body = try JSONEncoder().encode(["credential": idToken])
        let data: Data
        do {
            data = try await apiClient.data(for: APIRequest(
                method: .post,
                path: "/api/auth/google/native",
                body: .json(body)
            ))
        } catch let error as APIClientError {
            throw map(error)
        } catch {
            throw GoogleLoginError.network
        }
        guard let response = try? JSONDecoder().decode(GoogleNativeSessionResponse.self, from: data),
              !response.user.id.isEmpty,
              !response.session.credential.isEmpty else {
            throw GoogleLoginError.invalidResponse
        }
        sessionStore.saveNativeCredential(
            response.session.credential,
            serverUserID: response.user.id
        )
        return response.user
    }

    func logout() async throws {
        guard let current = sessionStore.current else { return }
        defer { sessionStore.logout() }
        try await apiClient.revokeNativeSession(current)
    }

    @discardableResult
    func validateRestoredSession() async -> Bool {
        guard let restored = sessionStore.restoredSessionPendingValidation else { return false }
        do {
            try await apiClient.validateNativeSession(restored)
            sessionStore.confirmRestoredSession(restored)
            return true
        } catch APIClientError.server(_, "NATIVE_SESSION_INVALID", _) {
            sessionStore.discardRestoredSession()
            return false
        } catch APIClientError.credentialOwnerMismatch {
            sessionStore.discardRestoredSession()
            return false
        } catch {
            return false
        }
    }

    private func map(_ error: APIClientError) -> GoogleLoginError {
        switch error {
        case .insecureCredentialTransport: return .httpsRequired
        case .server(_, "GOOGLE_AUTH_NOT_CONFIGURED", _): return .missingConfiguration
        case .server(_, "GOOGLE_AUTH_INVALID", _): return .invalidCredential
        case .invalidResponse: return .invalidResponse
        default: return .network
        }
    }
}
