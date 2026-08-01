import Foundation

enum SocialLoginProvider: String, Equatable, Sendable {
    case kakao
    case naver

    var displayName: String {
        switch self {
        case .kakao: return "카카오톡"
        case .naver: return "네이버"
        }
    }
}

enum SocialLoginError: Error, Equatable, LocalizedError {
    case cancelled
    case httpsRequired
    case invalidCallback
    case providerMismatch
    case invalidHandoff
    case invalidResponse
    case network

    var errorDescription: String? {
        switch self {
        case .cancelled: return "로그인 요청을 취소했습니다."
        case .httpsRequired: return "소셜 로그인은 HTTPS 서버에서만 사용할 수 있습니다."
        case .invalidCallback: return "로그인 콜백을 확인할 수 없습니다."
        case .providerMismatch: return "로그인 제공자 정보가 일치하지 않습니다."
        case .invalidHandoff: return "로그인 연결 정보가 만료되었거나 올바르지 않습니다."
        case .invalidResponse: return "로그인 서버 응답을 확인할 수 없습니다."
        case .network: return "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        }
    }
}

struct SocialSessionUser: Decodable, Equatable {
    let id: String
    let name: String
    let status: String
    let trustScore: Int
    let profileConfirmed: Bool
}

private struct SocialNativeSessionResponse: Decodable {
    struct Session: Decodable {
        let credential: String
        let expiresAt: String
    }

    let user: SocialSessionUser
    let session: Session
}

final class SocialNativeSessionClient {
    private let apiClient: APIClient
    private let sessionStore: SessionStore

    init(apiClient: APIClient, sessionStore: SessionStore) {
        self.apiClient = apiClient
        self.sessionStore = sessionStore
    }

    func exchange(provider: SocialLoginProvider, code: String) async throws -> SocialSessionUser {
        guard !code.isEmpty else { throw SocialLoginError.invalidHandoff }
        guard apiClient.baseURL?.scheme?.lowercased() == "https" else {
            throw SocialLoginError.httpsRequired
        }
        let body = try JSONEncoder().encode([
            "provider": provider.rawValue,
            "code": code
        ])
        let data: Data
        do {
            data = try await apiClient.data(for: APIRequest(
                method: .post,
                path: "/api/auth/native/handoff",
                body: .json(body)
            ))
        } catch let error as APIClientError {
            throw map(error)
        } catch {
            throw SocialLoginError.network
        }
        guard let response = try? JSONDecoder().decode(SocialNativeSessionResponse.self, from: data),
              !response.user.id.isEmpty,
              !response.session.credential.isEmpty else {
            throw SocialLoginError.invalidResponse
        }
        sessionStore.saveNativeCredential(
            response.session.credential,
            serverUserID: response.user.id
        )
        return response.user
    }

    private func map(_ error: APIClientError) -> SocialLoginError {
        switch error {
        case .insecureCredentialTransport: return .httpsRequired
        case .server(_, "NATIVE_HANDOFF_INVALID", _): return .invalidHandoff
        case .invalidResponse: return .invalidResponse
        default: return .network
        }
    }
}
