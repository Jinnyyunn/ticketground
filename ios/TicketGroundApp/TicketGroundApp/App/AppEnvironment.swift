import Foundation
import Observation
import Security

enum APIDataMode: String, Codable, Equatable {
    case fixture
    case live
}

enum AppRoute: Hashable, Codable {
    case home
    case search
    case ranking
    case genre(name: String)
    case region
    case open
    case event(slug: String)
    case place(slug: String?)
    case artist(slug: String)
    case goods(slug: String)
    case queue(slug: String)
    case booking(slug: String)
    case checkout(slug: String)
    case reservation(id: String)
    case login
    case signup
    case menu
    case mypage
    case cancel
    case resale
    case transfer
    case watchlist
    case help
    case inquiry
    case capabilityLedger

    var id: String {
        switch self {
        case .home: return "home"
        case .search: return "search"
        case .ranking: return "ranking"
        case .genre(let name): return "genre:\(name)"
        case .region: return "region"
        case .open: return "open"
        case .event(let slug): return "event:\(slug)"
        case .place(let slug): return "place:\(slug ?? "index")"
        case .artist(let slug): return "artist:\(slug)"
        case .goods(let slug): return "goods:\(slug)"
        case .queue(let slug): return "queue:\(slug)"
        case .booking(let slug): return "booking:\(slug)"
        case .checkout(let slug): return "checkout:\(slug)"
        case .reservation(let id): return "reservation:\(id)"
        case .login: return "login"
        case .signup: return "signup"
        case .menu: return "menu"
        case .mypage: return "mypage"
        case .cancel: return "cancel"
        case .resale: return "resale"
        case .transfer: return "transfer"
        case .watchlist: return "watchlist"
        case .help: return "help"
        case .inquiry: return "inquiry"
        case .capabilityLedger: return "capability-ledger"
        }
    }
}

enum AppRouteConnectivity: String, Equatable, Hashable {
    case publicRead
    case externalGate
    case intentionallyUnsupported
}

struct AppRouteClassification: Equatable {
    let connectivity: AppRouteConnectivity
    let reason: String
}

extension AppRoute {
    var classification: AppRouteClassification {
        switch self {
        case .home, .search, .ranking, .genre, .event, .place, .goods,
             .queue, .booking, .menu, .capabilityLedger:
            return AppRouteClassification(connectivity: .publicRead, reason: "공개 공연 및 좌석 조회 계약")
        case .region, .artist, .open:
            return AppRouteClassification(connectivity: .publicRead, reason: "버전 1 공개 탐색 계약")
        case .login, .signup, .mypage, .watchlist, .help, .inquiry:
            return AppRouteClassification(connectivity: .externalGate, reason: "HTTPS와 인증 제공자 또는 사용자 세션")
        case .checkout, .reservation, .cancel, .resale, .transfer:
            return AppRouteClassification(connectivity: .intentionallyUnsupported, reason: "거래별 HTTPS·인증·결제 계약 필요")
        }
    }
}

struct RouteResolver {
    static func resolve(_ url: URL) -> AppRoute? {
        resolve(path: url.path)
    }

    static func resolve(path: String) -> AppRoute? {
        guard let decoded = path.removingPercentEncoding else { return nil }
        let parts = decoded.split(separator: "/", omittingEmptySubsequences: true).map(String.init)
        if parts.isEmpty { return .home }
        if parts == ["contents", "search"] { return .search }
        if parts == ["contents", "ranking"] { return .ranking }
        if parts == ["contents", "region"] { return .region }
        if parts == ["open"] || parts == ["contents", "notice"] { return .open }
        if parts == ["place"] { return .place(slug: nil) }
        if parts == ["login"] { return .login }
        if parts == ["signup"] { return .signup }
        if parts == ["menu"] { return .menu }
        if parts == ["mypage"] { return .mypage }
        if parts == ["cancel"] { return .cancel }
        if parts == ["resale"] { return .resale }
        if parts == ["transfer"] { return .transfer }
        if parts == ["watchlist"] { return .watchlist }
        if parts == ["help"] { return .help }
        if parts == ["inquiry"] || parts == ["support", "inquiry"] { return .inquiry }
        guard parts.count == 2, let head = parts.first, let value = parts.last, !value.isEmpty else {
            if parts.count == 3, parts[0] == "contents", parts[1] == "genre", !parts[2].isEmpty {
                return .genre(name: parts[2])
            }
            return nil
        }
        switch head {
        case "event": return .event(slug: value)
        case "place": return .place(slug: value)
        case "artist": return .artist(slug: value)
        case "goods": return .goods(slug: value)
        case "queue": return .queue(slug: value)
        case "booking": return .booking(slug: value)
        case "checkout": return .checkout(slug: value)
        case "reservation": return .reservation(id: value)
        default: return nil
        }
    }
}

enum APIRequestMethod: String, Equatable, Hashable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

struct APIRequestQuery: Equatable {
    let name: String
    let value: String
}

struct APIRequestHeader: Equatable {
    let name: String
    let value: String
}

enum APIRequestBody: Equatable {
    case none
    case json(Data)
}

enum APIRequestAuthentication: Equatable {
    case none
    case required(userID: String)
}

enum APIRequestOwnerBinding: Equatable {
    case url
    case jsonField(String)
    case bearerPrincipal
}

struct APIRequest: Equatable {
    let method: APIRequestMethod
    let path: String
    let query: [APIRequestQuery]
    let headers: [APIRequestHeader]
    let body: APIRequestBody
    let idempotencyKey: String?
    let authentication: APIRequestAuthentication
    let ownerBinding: APIRequestOwnerBinding

    init(
        method: APIRequestMethod = .get,
        path: String,
        query: [APIRequestQuery] = [],
        headers: [APIRequestHeader] = [],
        body: APIRequestBody = .none,
        idempotencyKey: String? = nil,
        authentication: APIRequestAuthentication = .none,
        ownerBinding: APIRequestOwnerBinding = .url
    ) {
        self.method = method
        self.path = path
        self.query = query
        self.headers = headers
        self.body = body
        self.idempotencyKey = idempotencyKey
        self.authentication = authentication
        self.ownerBinding = ownerBinding
    }
}

protocol APIClient: AnyObject {
    var mode: APIDataMode { get }
    var baseURL: URL? { get }
    func data(for request: APIRequest) async throws -> Data
    func dataRejectingRedirects(for request: APIRequest) async throws -> Data
    func revokeNativeSession(_ session: NativeSession) async throws
    func validateNativeSession(_ session: NativeSession) async throws
    func resolveResource(_ reference: String?) -> String?
}

extension APIClient {
    var baseURL: URL? { nil }

    func dataRejectingRedirects(for request: APIRequest) async throws -> Data {
        try await data(for: request)
    }

    func data(for path: String) async throws -> Data {
        try await data(for: APIRequest(path: path))
    }

    func revokeNativeSession(_ session: NativeSession) async throws {
        throw APIClientError.liveTransportUnavailable
    }

    func validateNativeSession(_ session: NativeSession) async throws {
        throw APIClientError.liveTransportUnavailable
    }
}

enum APIClientError: Error, Equatable, LocalizedError {
    case liveTransportUnavailable
    case invalidBaseURL
    case invalidResponse
    case insecureCredentialTransport
    case missingCredential
    case credentialOwnerMismatch
    case capabilityUnavailable(endpoint: LiveAPIEndpoint, state: LiveCapabilityState)
    case reservedRequestHeader(String)
    case server(status: Int, code: String, message: String)
    case requestFailed(code: Int)

    var errorDescription: String? {
        switch self {
        case .liveTransportUnavailable: return "라이브 API 전송이 준비되지 않았습니다."
        case .invalidBaseURL: return "API 서버 주소가 올바르지 않습니다."
        case .invalidResponse: return "API 응답 형식을 확인할 수 없습니다."
        case .insecureCredentialTransport: return "보안 인증 정보는 HTTPS 연결에서만 전송할 수 있습니다."
        case .missingCredential: return "로그인이 필요한 요청입니다."
        case .credentialOwnerMismatch: return "현재 로그인 사용자와 요청 대상이 일치하지 않습니다."
        case .capabilityUnavailable(let endpoint, let state): return "API 기능을 사용할 수 없습니다: \(endpoint.pathTemplate) (\(state))"
        case .reservedRequestHeader(let name): return "보안 헤더는 요청에서 직접 설정할 수 없습니다: \(name)"
        case .server(_, _, let message): return message
        case .requestFailed(let code): return "네트워크 요청에 실패했습니다. (\(code))"
        }
    }
}

struct PublicReadPresentation: Equatable {
    let title: String
    let message: String

    static func resolve(_ error: Error) -> PublicReadPresentation {
        guard let apiError = error as? APIClientError else {
            return PublicReadPresentation(title: "공연 정보를 불러올 수 없습니다", message: "네트워크를 확인한 뒤 다시 시도해 주세요.")
        }
        switch apiError {
        case .capabilityUnavailable(_, .incompatible):
            return PublicReadPresentation(title: "공연 정보 연결 확인 필요", message: "서버 응답 형식이 앱과 달라 공연 정보를 안전하게 표시할 수 없습니다.")
        case .capabilityUnavailable:
            return PublicReadPresentation(title: "공연 정보 연결 확인 필요", message: "공개 공연 정보 계약이 아직 확인되지 않았습니다. 잠시 후 다시 시도해 주세요.")
        case .server(status: 429, _, _):
            return PublicReadPresentation(title: "요청이 많습니다", message: "잠시 후 다시 시도해 주세요.")
        case .invalidResponse:
            return PublicReadPresentation(title: "공연 정보 형식 오류", message: "서버 응답을 안전하게 해석할 수 없습니다. 잠시 후 다시 시도해 주세요.")
        case .requestFailed:
            return PublicReadPresentation(title: "네트워크 연결 확인", message: "인터넷 연결을 확인한 뒤 다시 시도해 주세요.")
        case .invalidBaseURL:
            return PublicReadPresentation(title: "API 서버 주소 확인 필요", message: "설정된 API 서버 주소가 올바르지 않습니다.")
        default:
            return PublicReadPresentation(title: "공연 정보를 불러올 수 없습니다", message: "잠시 후 다시 시도해 주세요.")
        }
    }
}

enum LiveAccountCapability {
    case account
    case watchlist
    case support

    fileprivate var endpoints: [LiveAPIEndpoint] {
        switch self {
        case .account: return [.session, .tickets]
        case .watchlist: return [.watchlist]
        case .support: return [.supportThreads]
        }
    }
}

enum LiveAccountCapabilityState: Equatable {
    case available(userID: String)
    case loginRequired
    case httpsRequired
    case unsupported
    case retry
    case help

    static func resolve(
        for capability: LiveAccountCapability,
        capabilityMap: LiveCapabilityMap,
        session: NativeSession?,
        baseURL: URL? = nil,
        requestError: APIClientError? = nil
    ) -> LiveAccountCapabilityState {
        if let requestError {
            return state(for: requestError)
        }
        if let baseURL, baseURL.scheme?.lowercased() != "https" {
            return .httpsRequired
        }
        guard let session,
              !session.userID.isEmpty,
              let credential = session.credential,
              !credential.isEmpty else {
            return .loginRequired
        }

        let states = capability.endpoints.map(capabilityMap.state(for:))
        if states.contains(.blocked(.requiresHTTPS)) {
            return .httpsRequired
        }
        if states.contains(.blocked(.unsupportedMutation))
            || states.contains(.blocked(.serverAuthorizationUnverified)) {
            return .unsupported
        }
        if states.contains(where: { state in
            if case .incompatible = state { return true }
            return false
        }) {
            return .help
        }
        if states.contains(.unknown) {
            return .retry
        }
        return .available(userID: session.userID)
    }

    private static func state(for error: APIClientError) -> LiveAccountCapabilityState {
        switch error {
        case .insecureCredentialTransport:
            return .httpsRequired
        case .missingCredential, .credentialOwnerMismatch:
            return .loginRequired
        case .capabilityUnavailable(_, let state):
            switch state {
            case .available:
                return .retry
            case .blocked(.requiresHTTPS):
                return .httpsRequired
            case .blocked(.unsupportedMutation), .blocked(.serverAuthorizationUnverified):
                return .unsupported
            case .unknown:
                return .retry
            case .incompatible:
                return .help
            }
        case .server(let status, _, _):
            switch status {
            case 401:
                return .loginRequired
            case 404, 405, 501:
                return .unsupported
            case 403:
                return .help
            default:
                return .retry
            }
        case .liveTransportUnavailable, .invalidBaseURL, .reservedRequestHeader:
            return .help
        case .invalidResponse, .requestFailed:
            return .retry
        }
    }
}

final class FixtureAPIClient: APIClient {
    let mode: APIDataMode = .fixture

    func data(for request: APIRequest) async throws -> Data {
        Data("{}".utf8)
    }

    func resolveResource(_ reference: String?) -> String? {
        reference
    }
}

final class DisabledLiveAPIClient: APIClient {
    let mode: APIDataMode = .live
    private let error: APIClientError

    init(error: APIClientError = .liveTransportUnavailable) {
        self.error = error
    }

    func data(for request: APIRequest) async throws -> Data {
        throw error
    }

    func resolveResource(_ reference: String?) -> String? {
        reference
    }
}

private enum AuthenticatedRequestOwnerValidator {
    static func matches(_ userID: String, url: URL) -> Bool {
        guard !userID.isEmpty,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let pathSegments = decodedPathSegments(components.percentEncodedPath),
              let queryItems = decodedQueryItems(components.percentEncodedQuery) else {
            return false
        }

        var foundOwner = false
        for index in pathSegments.indices where pathSegments[index] == "users" {
            let ownerIndex = index + 1
            guard pathSegments.indices.contains(ownerIndex),
                  !pathSegments[ownerIndex].isEmpty,
                  pathSegments[ownerIndex] == userID else {
                return false
            }
            foundOwner = true
        }

        for item in queryItems where item.name == "userId" {
            guard let value = item.value, !value.isEmpty, value == userID else {
                return false
            }
            foundOwner = true
        }
        return foundOwner
    }

    private static func decodedPathSegments(_ percentEncodedPath: String) -> [String]? {
        let segments = percentEncodedPath.split(separator: "/", omittingEmptySubsequences: false)
        var decoded: [String] = []
        decoded.reserveCapacity(segments.count)
        for segment in segments {
            guard let value = String(segment).removingPercentEncoding else {
                return nil
            }
            decoded.append(value)
        }
        return decoded
    }

    private static func decodedQueryItems(
        _ percentEncodedQuery: String?
    ) -> [(name: String, value: String?)]? {
        guard let percentEncodedQuery else { return [] }
        var decoded: [(name: String, value: String?)] = []
        for item in percentEncodedQuery.split(separator: "&", omittingEmptySubsequences: false) {
            let parts = item.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            guard let name = String(parts[0]).removingPercentEncoding else {
                return nil
            }
            let value: String?
            if parts.count == 2 {
                guard let decodedValue = String(parts[1]).removingPercentEncoding else {
                    return nil
                }
                value = decodedValue
            } else {
                value = nil
            }
            decoded.append((name, value))
        }
        return decoded
    }
}

final class AuthenticatedRedirectDelegate: NSObject, URLSessionTaskDelegate {
    private let originalRequest: URLRequest
    private let userID: String
    private let ownerBinding: APIRequestOwnerBinding

    init(
        originalRequest: URLRequest,
        userID: String,
        ownerBinding: APIRequestOwnerBinding
    ) {
        self.originalRequest = originalRequest
        self.userID = userID
        self.ownerBinding = ownerBinding
    }

    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        guard let originalURL = originalRequest.url,
              let redirectURL = request.url,
              redirectURL.scheme?.lowercased() == "https",
              originalURL.scheme?.caseInsensitiveCompare(redirectURL.scheme ?? "") == .orderedSame,
              originalURL.host?.caseInsensitiveCompare(redirectURL.host ?? "") == .orderedSame,
              effectivePort(for: originalURL) == effectivePort(for: redirectURL),
              ownerBinding == .url,
              AuthenticatedRequestOwnerValidator.matches(userID, url: redirectURL) else {
            completionHandler(nil)
            return
        }

        var authorizedRequest = request
        authorizedRequest.setValue(
            originalRequest.value(forHTTPHeaderField: "Authorization"),
            forHTTPHeaderField: "Authorization"
        )
        completionHandler(authorizedRequest)
    }

    private func effectivePort(for url: URL) -> Int? {
        if let port = url.port {
            return port
        }
        return url.scheme?.lowercased() == "https" ? 443 : nil
    }
}

final class RejectRedirectDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        completionHandler(nil)
    }
}

final class LiveAPIClient: APIClient {
    let mode: APIDataMode = .live

    private let configuredBaseURL: URL
    private let mediaResolver: MediaResourceResolver
    private let credentialStore: CredentialStore
    private let session: URLSession

    init(
        baseURL: URL,
        assetBaseURL: URL?,
        credentialStore: CredentialStore,
        session: URLSession = .shared
    ) {
        self.configuredBaseURL = baseURL
        self.mediaResolver = MediaResourceResolver(baseURL: assetBaseURL)
        self.credentialStore = credentialStore
        self.session = session
    }

    var baseURL: URL? { configuredBaseURL }

    func data(for apiRequest: APIRequest) async throws -> Data {
        let request = try urlRequest(for: apiRequest)

        do {
            let result: (Data, URLResponse)
            switch apiRequest.authentication {
            case .none:
                result = try await session.data(for: request)
            case .required(let userID):
                let redirectDelegate = AuthenticatedRedirectDelegate(
                    originalRequest: request,
                    userID: userID,
                    ownerBinding: apiRequest.ownerBinding
                )
                result = try await session.data(for: request, delegate: redirectDelegate)
            }
            let (data, response) = result
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIClientError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw serverError(from: data, status: httpResponse.statusCode)
            }
            return try unwrap(data)
        } catch let error as APIClientError {
            throw error
        } catch let error as URLError {
            throw APIClientError.requestFailed(code: error.code.rawValue)
        } catch {
            throw APIClientError.requestFailed(code: (error as NSError).code)
        }
    }

    func dataRejectingRedirects(for apiRequest: APIRequest) async throws -> Data {
        let request = try urlRequest(for: apiRequest)

        do {
            let (data, response) = try await session.data(
                for: request,
                delegate: RejectRedirectDelegate()
            )
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIClientError.invalidResponse
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw serverError(from: data, status: httpResponse.statusCode)
            }
            return try unwrap(data)
        } catch let error as APIClientError {
            throw error
        } catch let error as URLError {
            throw APIClientError.requestFailed(code: error.code.rawValue)
        } catch {
            throw APIClientError.requestFailed(code: (error as NSError).code)
        }
    }

    private struct NativeSessionValidationResponse: Decodable {
        struct Payload: Decodable {
            struct User: Decodable {
                let id: String
            }

            let user: User
        }

        let data: Payload
    }

    func revokeNativeSession(_ nativeSession: NativeSession) async throws {
        _ = try await nativeSessionRequest(
            nativeSession,
            method: "POST",
            path: "/api/auth/native/logout",
            body: Data("{}".utf8)
        )
    }

    func validateNativeSession(_ nativeSession: NativeSession) async throws {
        let data = try await nativeSessionRequest(
            nativeSession,
            method: "GET",
            path: "/api/auth/native/session"
        )
        guard let response = try? JSONDecoder().decode(NativeSessionValidationResponse.self, from: data) else {
            throw APIClientError.invalidResponse
        }
        guard response.data.user.id == nativeSession.userID else {
            throw APIClientError.credentialOwnerMismatch
        }
    }

    private func nativeSessionRequest(
        _ nativeSession: NativeSession,
        method: String,
        path: String,
        body: Data? = nil
    ) async throws -> Data {
        guard configuredBaseURL.scheme?.lowercased() == "https",
              let credential = nativeSession.credential,
              !credential.isEmpty,
              let url = URL(string: path, relativeTo: configuredBaseURL)?.absoluteURL else {
            throw APIClientError.insecureCredentialTransport
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(credential)", forHTTPHeaderField: "Authorization")
        request.httpBody = body
        let (data, response) = try await session.data(for: request, delegate: RejectRedirectDelegate())
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw serverError(from: data, status: httpResponse.statusCode)
        }
        return data
    }

    func urlRequest(for apiRequest: APIRequest) throws -> URLRequest {
        guard apiRequest.path.hasPrefix("/"), !apiRequest.path.hasPrefix("//"),
              let resolvedURL = URL(string: apiRequest.path, relativeTo: configuredBaseURL)?.absoluteURL,
              var components = URLComponents(url: resolvedURL, resolvingAgainstBaseURL: false) else {
            throw APIClientError.invalidBaseURL
        }
        if !apiRequest.query.isEmpty {
            components.queryItems = (components.queryItems ?? []) + apiRequest.query.map {
                URLQueryItem(name: $0.name, value: $0.value)
            }
        }
        guard let url = components.url else {
            throw APIClientError.invalidBaseURL
        }

        if let reservedHeader = apiRequest.headers.first(where: {
            $0.name.caseInsensitiveCompare("Authorization") == .orderedSame
                || $0.name.caseInsensitiveCompare("Proxy-Authorization") == .orderedSame
        }) {
            throw APIClientError.reservedRequestHeader(reservedHeader.name)
        }

        var request = URLRequest(url: url)
        request.httpMethod = apiRequest.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for header in apiRequest.headers {
            request.setValue(header.value, forHTTPHeaderField: header.name)
        }
        switch apiRequest.body {
        case .none:
            break
        case .json(let data):
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = data
        }
        if let idempotencyKey = apiRequest.idempotencyKey, !idempotencyKey.isEmpty {
            request.setValue(idempotencyKey, forHTTPHeaderField: "X-Idempotency-Key")
        }
        switch apiRequest.authentication {
        case .none:
            break
        case .required(let userID):
            guard url.scheme?.lowercased() == "https" else {
                throw APIClientError.insecureCredentialTransport
            }
            guard ownerMatches(userID, request: apiRequest, url: url) else {
                throw APIClientError.credentialOwnerMismatch
            }
            guard let storedCredential = credentialStore.read(),
                  !storedCredential.credential.isEmpty,
                  !storedCredential.serverUserID.isEmpty else {
                throw APIClientError.missingCredential
            }
            guard storedCredential.serverUserID == userID else {
                throw APIClientError.credentialOwnerMismatch
            }
            request.setValue("Bearer \(storedCredential.credential)", forHTTPHeaderField: "Authorization")
        }
        return request
    }

    func resolveResource(_ reference: String?) -> String? {
        mediaResolver.resolve(reference)?.absoluteString
    }

    private func ownerMatches(
        _ userID: String,
        request: APIRequest,
        url: URL
    ) -> Bool {
        switch request.ownerBinding {
        case .url:
            return AuthenticatedRequestOwnerValidator.matches(userID, url: url)
        case .jsonField(let name):
            guard case .json(let body) = request.body,
                  let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
                  let owner = object[name] as? String else {
                return false
            }
            return !owner.isEmpty && owner == userID
        case .bearerPrincipal:
            return true
        }
    }

    private func unwrap(_ data: Data) throws -> Data {
        guard let payload = try? JSONSerialization.jsonObject(with: data),
              let object = payload as? [String: Any],
              let ok = object["ok"] as? Bool else {
            throw APIClientError.invalidResponse
        }
        if !ok {
            throw serverError(from: data, status: 200)
        }
        guard let body = object["data"] else {
            return Data("null".utf8)
        }
        return try JSONSerialization.data(withJSONObject: body)
    }

    private func serverError(from data: Data, status: Int) -> APIClientError {
        let payload = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        let error = payload?["error"] as? [String: Any]
        return .server(
            status: status,
            code: error?["code"] as? String ?? "API_ERROR",
            message: error?["message"] as? String ?? "서버 요청에 실패했습니다."
        )
    }
}

struct StoredCredential: Codable, Equatable {
    let credential: String
    let serverUserID: String
}

protocol CredentialStore: AnyObject {
    func read() -> StoredCredential?
    func save(_ credential: StoredCredential)
    func delete()
}

final class InMemoryCredentialStore: CredentialStore {
    private(set) var value: StoredCredential?

    func read() -> StoredCredential? { value }

    func save(_ credential: StoredCredential) {
        value = credential
    }

    func delete() {
        value = nil
    }
}

final class KeychainCredentialStore: CredentialStore {
    private let service: String
    private let account: String

    init(service: String = Bundle.main.bundleIdentifier ?? "kr.ticketground.app", account: String = "native-session") {
        self.service = service
        self.account = account
    }

    func read() -> StoredCredential? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(StoredCredential.self, from: data)
    }

    func save(_ credential: StoredCredential) {
        guard let data = try? JSONEncoder().encode(credential) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item.merge(attributes) { _, new in new }
            SecItemAdd(item as CFDictionary, nil)
        }
    }

    func delete() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

struct NativeSession: Equatable {
    let userID: String
    let credential: String?
}

@Observable
final class SessionStore {
    private let credentialStore: CredentialStore
    private(set) var current: NativeSession?
    private(set) var restoredSessionPendingValidation: NativeSession?
    private(set) var revision = 0

    init(credentialStore: CredentialStore) {
        self.credentialStore = credentialStore
        restore()
    }

    func restore() {
        revision &+= 1
        guard let storedCredential = credentialStore.read(),
              !storedCredential.credential.isEmpty,
              !storedCredential.serverUserID.isEmpty else {
            current = nil
            restoredSessionPendingValidation = nil
            return
        }
        current = nil
        restoredSessionPendingValidation = NativeSession(
            userID: storedCredential.serverUserID,
            credential: storedCredential.credential
        )
    }

    func confirmRestoredSession(_ session: NativeSession) {
        guard restoredSessionPendingValidation == session else { return }
        revision &+= 1
        current = session
        restoredSessionPendingValidation = nil
    }

    func discardRestoredSession() {
        revision &+= 1
        credentialStore.delete()
        restoredSessionPendingValidation = nil
        current = nil
    }

    func saveNativeCredential(_ credential: String, serverUserID: String) {
        guard !credential.isEmpty, !serverUserID.isEmpty else { return }
        revision &+= 1
        credentialStore.save(StoredCredential(
            credential: credential,
            serverUserID: serverUserID
        ))
        current = NativeSession(userID: serverUserID, credential: credential)
        restoredSessionPendingValidation = nil
    }

    func setFixtureUser(_ userID: String) {
        guard !userID.isEmpty else { return }
        revision &+= 1
        current = NativeSession(userID: userID, credential: nil)
        restoredSessionPendingValidation = nil
    }

    func logout() {
        revision &+= 1
        credentialStore.delete()
        current = nil
        restoredSessionPendingValidation = nil
    }
}

struct AppEnvironment {
    let mode: APIDataMode
    let apiClient: APIClient
    let sessionStore: SessionStore
}

@Observable
final class AppContainer {
    let environment: AppEnvironment
    var navigationPath: [AppRoute] = []

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func completeLoginNavigation() {
        navigationPath.removeAll()
    }

    static func fixture(credentialStore: CredentialStore = InMemoryCredentialStore()) -> AppContainer {
        let sessionStore = SessionStore(credentialStore: credentialStore)
        return AppContainer(environment: AppEnvironment(
            mode: .fixture,
            apiClient: FixtureAPIClient(),
            sessionStore: sessionStore
        ))
    }

    static func live(
        baseURL: URL,
        assetBaseURL: URL? = nil,
        credentialStore: CredentialStore = KeychainCredentialStore()
    ) -> AppContainer {
        let sessionStore = SessionStore(credentialStore: credentialStore)
        return AppContainer(environment: AppEnvironment(
            mode: .live,
            apiClient: LiveAPIClient(
                baseURL: baseURL,
                assetBaseURL: assetBaseURL,
                credentialStore: credentialStore
            ),
            sessionStore: sessionStore
        ))
    }

    static func configured() -> AppContainer {
        if FixtureScenario.isFixtureMode {
            return fixture()
        }
        if let scenario = RuntimeConfiguration.liveHomeTestScenario {
            return liveHomeTest(scenario)
        }
        guard let apiURL = RuntimeConfiguration.apiBaseURL else {
            let credentialStore = KeychainCredentialStore()
            return AppContainer(environment: AppEnvironment(
                mode: .live,
                apiClient: DisabledLiveAPIClient(error: .invalidBaseURL),
                sessionStore: SessionStore(credentialStore: credentialStore)
            ))
        }
        return live(baseURL: apiURL, assetBaseURL: RuntimeConfiguration.assetBaseURL)
    }

    private static func liveHomeTest(_ scenario: UITestLiveHomeScenario) -> AppContainer {
        let sessionStore = SessionStore(credentialStore: InMemoryCredentialStore())
        if scenario == .supportAuthenticated || scenario == .watchlistAuthenticated || scenario == .watchlistRetry || scenario == .watchlistCommittedResponseLost || scenario == .watchlistCTALost || scenario == .watchlistProbeUnauthorized {
            let suffix = scenario == .supportAuthenticated ? "support" : "watchlist"
            sessionStore.saveNativeCredential("ui-test-\(suffix)-credential", serverUserID: "ui-test-\(suffix)-user")
        }
        return AppContainer(environment: AppEnvironment(
            mode: .live,
            apiClient: UITestLiveHomeAPIClient(scenario: scenario),
            sessionStore: sessionStore
        ))
    }
}

enum RuntimeConfiguration {
    fileprivate static var liveHomeTestScenario: UITestLiveHomeScenario? {
        let arguments = ProcessInfo.processInfo.arguments
        guard arguments.contains("-ui-testing"),
              let index = arguments.firstIndex(of: "-live-home-scenario"),
              arguments.indices.contains(index + 1) else {
            return nil
        }
        return UITestLiveHomeScenario(rawValue: arguments[index + 1])
    }

    static var liveAccountCapabilityTestState: LiveAccountCapabilityState? {
        let arguments = ProcessInfo.processInfo.arguments
        guard arguments.contains("-ui-testing"),
              let index = arguments.firstIndex(of: "-live-capability-state"),
              arguments.indices.contains(index + 1) else {
            return nil
        }
        switch arguments[index + 1] {
        case "login-required": return .loginRequired
        case "https-required": return .httpsRequired
        case "unsupported": return .unsupported
        case "retry": return .retry
        case "help": return .help
        default: return nil
        }
    }

    static var apiBaseURL: URL? {
        apiBaseURL(from: value(for: "TICKETGROUND_API_BASE_URL"))
    }

    static func apiBaseURL(from configured: String?) -> URL? {
        guard let value = configured else { return nil }
        guard let components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              let host = components.host,
              !host.isEmpty,
              components.percentEncodedPath.isEmpty || components.percentEncodedPath == "/",
              components.query == nil,
              components.fragment == nil else {
            return nil
        }
        return components.url
    }

    static var assetBaseURL: URL? {
        guard let configured = value(for: "TICKETGROUND_ASSET_BASE_URL"),
              let url = URL(string: configured),
              PublicMediaOrigin(url: url) != nil else {
            return nil
        }
        return url
    }

    static func configuredValue(
        for key: String,
        environmentValue: String?,
        arguments: [String],
        bundledValue: String?
    ) -> String? {
        let argumentValue = arguments.firstIndex(of: "-\(key)")
            .flatMap { arguments.indices.contains($0 + 1) ? arguments[$0 + 1] : nil }
        return [environmentValue, argumentValue, bundledValue]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .first { !$0.isEmpty && !$0.contains("$(") }
    }

    private static func value(for key: String) -> String? {
        let bundleKey = [
            "TICKETGROUND_API_BASE_URL": "TicketgroundAPIBaseURL",
            "TICKETGROUND_ASSET_BASE_URL": "TicketgroundAssetBaseURL"
        ][key]
        let bundledValue = bundleKey.flatMap {
            Bundle.main.object(forInfoDictionaryKey: $0) as? String
        }
        return configuredValue(
            for: key,
            environmentValue: ProcessInfo.processInfo.environment[key],
            arguments: ProcessInfo.processInfo.arguments,
            bundledValue: bundledValue
        )
    }
}

private enum UITestLiveHomeScenario: String {
    case catalog
    case support
    case supportAuthenticated
    case watchlistAuthenticated
    case watchlistCTALost
    case watchlistCommittedResponseLost
    case watchlistProbeUnauthorized
    case watchlistRetry
    case empty
    case offline
    case rateLimited
    case incompatible
    case unavailable
    case recovering
    case discoveryNotFound
    case discoveryFailure
    case discoveryRouteNotFound
}

private final class UITestLiveHomeAPIClient: APIClient {
    let mode: APIDataMode = .live
    var baseURL: URL? {
        URL(string: scenario == .support || scenario == .supportAuthenticated || scenario == .watchlistAuthenticated || scenario == .watchlistCTALost || scenario == .watchlistCommittedResponseLost || scenario == .watchlistProbeUnauthorized || scenario == .watchlistRetry
            ? "https://ui-test.ticketground.invalid/"
            : "http://ui-test.ticketground.invalid/")
    }
    private let scenario: UITestLiveHomeScenario
    private var healthRequestCount = 0
    private var supportMessageRequestCount = 0
    private var publicSupportRequestCount = 0
    private var watchlistMutationRequestCount = 0
    private var watchlistReadRequestCount = 0
    private var watchlistPresent = false
    private var watchlistNotificationEnabled = true
    private var watchlistCalendarEnabled = false

    init(scenario: UITestLiveHomeScenario) {
        self.scenario = scenario
        if scenario == .watchlistCommittedResponseLost {
            watchlistPresent = true
        }
    }

    func data(for request: APIRequest) async throws -> Data {
        if scenario == .offline {
            throw APIClientError.requestFailed(code: URLError.notConnectedToInternet.rawValue)
        }
        if scenario == .rateLimited {
            throw APIClientError.server(status: 429, code: "RATE_LIMITED", message: "too many requests")
        }
        switch (request.path, request.query) {
        case ("/api/health", _):
            healthRequestCount += 1
            if scenario == .watchlistProbeUnauthorized && healthRequestCount > 2 {
                throw APIClientError.server(status: 401, code: "GATEWAY_UNAUTHORIZED", message: "gateway rejected public probe")
            }
            if scenario == .unavailable || (scenario == .recovering && healthRequestCount == 1) {
                return json("{\"status\":\"ok\",\"version\":null}")
            }
            if scenario == .support || scenario == .supportAuthenticated {
                return json("{\"status\":\"ok\",\"version\":\"78b3c7c\",\"capabilities\":[\"native-support-v1\"]}")
            }
            if scenario == .watchlistAuthenticated || scenario == .watchlistCTALost || scenario == .watchlistCommittedResponseLost || scenario == .watchlistRetry {
                return json("{\"status\":\"ok\",\"version\":\"78b3c7c\",\"capabilities\":[\"native-watchlist-v1\"]}")
            }
            return json("{\"status\":\"ok\",\"version\":\"\(scenario == .incompatible ? "future-contract" : "78b3c7c")\"}")
        case ("/api/support/public", _) where scenario == .support || scenario == .supportAuthenticated:
            publicSupportRequestCount += 1
            if scenario == .supportAuthenticated && publicSupportRequestCount > 1 {
                try await Task.sleep(for: .seconds(15))
            }
            return json("{\"version\":\"1\",\"faqs\":[{\"id\":\"booking\",\"question\":\"예매 내역은 어디에서 확인하나요?\",\"answer\":\"로그인 후 마이페이지에서 확인할 수 있습니다.\"}],\"notices\":[{\"id\":\"secure\",\"title\":\"안전한 1:1 문의\",\"body\":\"로그인 세션의 본인 문의만 확인할 수 있습니다.\"}]}")
        case ("/api/me/support/threads", _) where scenario == .supportAuthenticated && request.method == .get:
            if supportMessageRequestCount > 0 {
                return json("[{\"id\":\"support-ui\",\"subject\":\"배송 문의\",\"status\":\"OPEN\",\"category\":\"GENERAL\",\"createdAt\":\"2026-08-02T00:00:00Z\",\"updatedAt\":\"2026-08-02T00:03:00Z\",\"messages\":[{\"id\":\"message-ui\",\"role\":\"MODERATOR\",\"body\":\"확인 중입니다.\",\"at\":\"2026-08-02T00:00:00Z\"},{\"id\":\"message-reply\",\"role\":\"CUSTOMER\",\"body\":\"추가 문의\",\"at\":\"2026-08-02T00:03:00Z\"}]},{\"id\":\"support-newer\",\"subject\":\"좌석 문의\",\"status\":\"OPEN\",\"category\":\"GENERAL\",\"createdAt\":\"2026-08-02T00:02:00Z\",\"updatedAt\":\"2026-08-02T00:02:00Z\",\"messages\":[{\"id\":\"message-newer\",\"role\":\"CUSTOMER\",\"body\":\"좌석 확인\",\"at\":\"2026-08-02T00:02:00Z\"}]}]")
            }
            return json("[{\"id\":\"support-newer\",\"subject\":\"좌석 문의\",\"status\":\"OPEN\",\"category\":\"GENERAL\",\"createdAt\":\"2026-08-02T00:02:00Z\",\"updatedAt\":\"2026-08-02T00:02:00Z\",\"messages\":[{\"id\":\"message-newer\",\"role\":\"CUSTOMER\",\"body\":\"좌석 확인\",\"at\":\"2026-08-02T00:02:00Z\"}]},{\"id\":\"support-ui\",\"subject\":\"배송 문의\",\"status\":\"OPEN\",\"category\":\"GENERAL\",\"createdAt\":\"2026-08-02T00:00:00Z\",\"updatedAt\":\"2026-08-02T00:00:00Z\",\"messages\":[{\"id\":\"message-ui\",\"role\":\"MODERATOR\",\"body\":\"확인 중입니다.\",\"at\":\"2026-08-02T00:00:00Z\"}]}]")
        case ("/api/me/support/threads", _) where scenario == .supportAuthenticated && request.method == .post:
            try await Task.sleep(for: .seconds(5))
            throw APIClientError.server(status: 401, code: "NATIVE_SESSION_INVALID", message: "session expired")
        case ("/api/me/support/messages", _) where scenario == .supportAuthenticated:
            supportMessageRequestCount += 1
            if supportMessageRequestCount == 1 {
                return json("{\"id\":\"support-ui\",\"subject\":\"배송 문의\",\"status\":\"OPEN\",\"category\":\"GENERAL\",\"createdAt\":\"2026-08-02T00:00:00Z\",\"updatedAt\":\"2026-08-02T00:03:00Z\",\"messages\":[{\"id\":\"message-ui\",\"role\":\"MODERATOR\",\"body\":\"확인 중입니다.\",\"at\":\"2026-08-02T00:00:00Z\"},{\"id\":\"message-reply\",\"role\":\"CUSTOMER\",\"body\":\"추가 문의\",\"at\":\"2026-08-02T00:03:00Z\"}]}")
            }
            throw APIClientError.server(status: 401, code: "NATIVE_SESSION_INVALID", message: "session expired")
        case ("/api/me/watchlist", _) where scenario == .watchlistRetry && request.method == .get:
            watchlistReadRequestCount += 1
            if watchlistReadRequestCount == 1 {
                throw APIClientError.server(status: 503, code: "WATCHLIST_UNAVAILABLE", message: "temporary failure")
            }
            return json("[]")
        case ("/api/me/watchlist", _) where (scenario == .watchlistAuthenticated || scenario == .watchlistCTALost || scenario == .watchlistCommittedResponseLost) && request.method == .get:
            return json(watchlistPresent ? "[\(watchlistItem)]" : "[]")
        case ("/api/me/watchlist/live-neon", _) where scenario == .watchlistCTALost && request.method == .put:
            let body = jsonBody(request)
            watchlistPresent = true
            watchlistNotificationEnabled = body["notificationEnabled"] as? Bool ?? true
            watchlistCalendarEnabled = body["calendarEnabled"] as? Bool ?? false
            throw APIClientError.server(status: 503, code: "WATCHLIST_RESPONSE_LOST", message: "response lost after commit")
        case ("/api/me/watchlist/live-neon", _) where scenario == .watchlistCommittedResponseLost && request.method == .put:
            let body = jsonBody(request)
            watchlistPresent = true
            watchlistNotificationEnabled = body["notificationEnabled"] as? Bool ?? true
            watchlistCalendarEnabled = body["calendarEnabled"] as? Bool ?? false
            throw APIClientError.server(status: 503, code: "WATCHLIST_RESPONSE_LOST", message: "response lost after commit")
        case ("/api/me/watchlist/live-neon", _) where scenario == .watchlistAuthenticated && request.method == .put:
            watchlistMutationRequestCount += 1
            if watchlistMutationRequestCount == 2 {
                try await Task.sleep(for: .milliseconds(500))
                throw APIClientError.server(status: 503, code: "WATCHLIST_UNAVAILABLE", message: "temporary failure")
            }
            let body = jsonBody(request)
            watchlistPresent = true
            watchlistNotificationEnabled = body["notificationEnabled"] as? Bool ?? true
            watchlistCalendarEnabled = body["calendarEnabled"] as? Bool ?? false
            return json(watchlistItem)
        case ("/api/me/watchlist/live-neon", _) where scenario == .watchlistAuthenticated && request.method == .delete:
            watchlistPresent = false
            return json("{\"deleted\":true,\"eventId\":\"live-neon\"}")
        case ("/api/me/watchlist/live-neon", _) where scenario == .watchlistCommittedResponseLost && request.method == .delete:
            watchlistPresent = false
            throw APIClientError.server(status: 503, code: "WATCHLIST_RESPONSE_LOST", message: "response lost after commit")
        case ("/api/state", _):
            return json("{\"events\":[],\"venues\":[],\"users\":[],\"tickets\":[],\"resalePools\":[],\"backendSummary\":{\"events\":1,\"tickets\":0},\"ledger\":{\"verified\":true,\"totalEntries\":1}}")
        case ("/api/catalog", let query) where query.contains(APIRequestQuery(name: "limit", value: "1")):
            return catalog(events: "[\(event)]")
        case ("/api/catalog", _):
            return scenario == .empty ? catalog(events: "[]") : catalog(events: "[\(event)]")
        case ("/api/discovery/v1/contract", _):
            return json("{\"version\":\"1\",\"endpoints\":[\"regions\",\"artists\",\"open-calendar\"]}")
        case ("/api/seat-map", _):
            return json("{\"category\":\"concert\",\"date\":\"2026-08-01\",\"event\":{\"id\":\"live-neon\",\"title\":\"Neon Stage\",\"venueId\":\"live-hall\",\"venue\":\"Live Hall\"},\"map\":{\"id\":\"live-hall-map\",\"venue\":\"Live Hall\",\"title\":\"Live Hall 좌석도\",\"image\":\"\",\"description\":\"공개 좌석 현황\"},\"zones\":[{\"id\":\"R\",\"name\":\"R석\",\"price\":88000,\"available\":12}],\"seats\":[{\"id\":\"R-1\",\"label\":\"R-1\",\"displayCode\":\"R-1\",\"zoneId\":\"R\",\"zoneName\":\"R석\",\"price\":88000,\"status\":\"available\",\"available\":true}]}")
        case ("/api/discovery/v1/regions", _):
            if scenario == .discoveryRouteNotFound {
                throw APIClientError.server(status: 404, code: "ROUTE_NOT_FOUND", message: "route not found")
            }
            if scenario == .discoveryFailure {
                throw APIClientError.server(status: 503, code: "DISCOVERY_UNAVAILABLE", message: "discovery unavailable")
            }
            let regions = scenario == .empty
                ? "[]"
                : "[{\"slug\":\"seoul\",\"name\":\"서울\",\"eventCount\":1,\"events\":[\(event)]}]"
            return json("{\"version\":\"1\",\"regions\":\(regions)}")
        case ("/api/discovery/v1/artists/neon-artist", _):
            if scenario == .discoveryNotFound {
                throw APIClientError.server(status: 404, code: "ARTIST_NOT_FOUND", message: "artist not found")
            }
            return json("{\"version\":\"1\",\"artist\":{\"slug\":\"neon-artist\",\"name\":\"Neon Artist\"},\"events\":[\(event)]}")
        case ("/api/discovery/v1/open-calendar", _):
            if scenario == .discoveryFailure {
                throw APIClientError.server(status: 503, code: "DISCOVERY_UNAVAILABLE", message: "discovery unavailable")
            }
            let entries = scenario == .empty
                ? "[]"
                : "[{\"opensAt\":\"2026-07-02T19:00:00.000Z\",\"saleState\":\"open\",\"event\":\(event)}]"
            return json("{\"version\":\"1\",\"entries\":\(entries)}")
        default:
            throw APIClientError.invalidResponse
        }
    }

    func resolveResource(_ reference: String?) -> String? {
        reference
    }

    private var event: String {
        "{\"id\":\"live-neon\",\"slug\":\"neon-stage\",\"category\":\"concert\",\"title\":\"Neon Stage\",\"venue\":\"Live Hall\",\"date\":\"2026-08-01T19:00:00\",\"dates\":[{\"id\":\"live-neon-first\",\"label\":\"8월 1일 19:00\",\"startsAt\":\"2026-08-01T19:00:00\"},{\"id\":\"live-neon-second\",\"label\":\"8월 2일 19:00\",\"startsAt\":\"2026-08-02T19:00:00\"}],\"artistSlug\":\"neon-artist\",\"casts\":[\"Neon Artist\"],\"soldCount\":42,\"sale\":{\"state\":\"open\",\"label\":\"예매중\",\"note\":\"일반예매\"}}"
    }

    private func catalog(events: String) -> Data {
        json("{\"events\":\(events),\"venues\":[],\"total\":1}")
    }

    private var watchlistItem: String {
        "{\"id\":\"watch-live-neon\",\"eventId\":\"live-neon\",\"channels\":[\"APP_PUSH\"],\"calendarEnabled\":\(watchlistCalendarEnabled),\"notificationEnabled\":\(watchlistNotificationEnabled),\"createdAt\":\"2026-08-02T00:00:00Z\",\"updatedAt\":\"2026-08-02T00:00:00Z\",\"event\":{\"id\":\"live-neon\",\"title\":\"Neon Stage\",\"venue\":\"Live Hall\",\"venueId\":\"live-hall\",\"category\":\"concert\",\"saleState\":\"ON_SALE\"},\"notificationJobs\":[]}"
    }

    private func jsonBody(_ request: APIRequest) -> [String: Any] {
        guard case .json(let data) = request.body,
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return body
    }

    private func json(_ value: String) -> Data {
        Data(value.utf8)
    }
}
