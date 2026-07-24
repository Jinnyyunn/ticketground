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
    case mypage
    case cancel
    case resale
    case transfer
    case watchlist
    case help
    case inquiry

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
        case .mypage: return "mypage"
        case .cancel: return "cancel"
        case .resale: return "resale"
        case .transfer: return "transfer"
        case .watchlist: return "watchlist"
        case .help: return "help"
        case .inquiry: return "inquiry"
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

enum APIRequestMethod: String, Equatable {
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

struct APIRequest: Equatable {
    let method: APIRequestMethod
    let path: String
    let query: [APIRequestQuery]
    let headers: [APIRequestHeader]
    let body: APIRequestBody
    let idempotencyKey: String?
    let authentication: APIRequestAuthentication

    init(
        method: APIRequestMethod = .get,
        path: String,
        query: [APIRequestQuery] = [],
        headers: [APIRequestHeader] = [],
        body: APIRequestBody = .none,
        idempotencyKey: String? = nil,
        authentication: APIRequestAuthentication = .none
    ) {
        self.method = method
        self.path = path
        self.query = query
        self.headers = headers
        self.body = body
        self.idempotencyKey = idempotencyKey
        self.authentication = authentication
    }
}

protocol APIClient: AnyObject {
    var mode: APIDataMode { get }
    func data(for request: APIRequest) async throws -> Data
    func resolveResource(_ reference: String?) -> String?
}

extension APIClient {
    func data(for path: String) async throws -> Data {
        try await data(for: APIRequest(path: path))
    }
}

enum APIClientError: Error, Equatable, LocalizedError {
    case liveTransportUnavailable
    case invalidBaseURL
    case invalidResponse
    case insecureCredentialTransport
    case missingCredential
    case credentialOwnerMismatch
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
        case .reservedRequestHeader(let name): return "보안 헤더는 요청에서 직접 설정할 수 없습니다: \(name)"
        case .server(_, _, let message): return message
        case .requestFailed(let code): return "네트워크 요청에 실패했습니다. (\(code))"
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

    func data(for request: APIRequest) async throws -> Data {
        throw APIClientError.liveTransportUnavailable
    }

    func resolveResource(_ reference: String?) -> String? {
        reference
    }
}

final class LiveAPIClient: APIClient {
    let mode: APIDataMode = .live

    private let baseURL: URL
    private let assetBaseURL: URL
    private let credentialStore: CredentialStore
    private let session: URLSession

    init(
        baseURL: URL,
        assetBaseURL: URL,
        credentialStore: CredentialStore,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.assetBaseURL = assetBaseURL
        self.credentialStore = credentialStore
        self.session = session
    }

    func data(for apiRequest: APIRequest) async throws -> Data {
        let request = try urlRequest(for: apiRequest)

        do {
            let (data, response) = try await session.data(for: request)
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

    func urlRequest(for apiRequest: APIRequest) throws -> URLRequest {
        guard apiRequest.path.hasPrefix("/"), !apiRequest.path.hasPrefix("//"),
              let resolvedURL = URL(string: apiRequest.path, relativeTo: baseURL)?.absoluteURL,
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
        guard let reference, !reference.isEmpty else { return nil }
        if let absolute = URL(string: reference), absolute.scheme != nil {
            return absolute.absoluteString
        }
        return URL(string: reference, relativeTo: assetBaseURL)?.absoluteURL.absoluteString
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

    init(credentialStore: CredentialStore) {
        self.credentialStore = credentialStore
        restore()
    }

    func restore() {
        guard let storedCredential = credentialStore.read(),
              !storedCredential.credential.isEmpty,
              !storedCredential.serverUserID.isEmpty else {
            current = nil
            return
        }
        current = NativeSession(
            userID: storedCredential.serverUserID,
            credential: storedCredential.credential
        )
    }

    func saveNativeCredential(_ credential: String, serverUserID: String) {
        guard !credential.isEmpty, !serverUserID.isEmpty else { return }
        credentialStore.save(StoredCredential(
            credential: credential,
            serverUserID: serverUserID
        ))
        current = NativeSession(userID: serverUserID, credential: credential)
    }

    func setFixtureUser(_ userID: String) {
        guard !userID.isEmpty else { return }
        current = NativeSession(userID: userID, credential: nil)
    }

    func logout() {
        credentialStore.delete()
        current = nil
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

    static func fixture(credentialStore: CredentialStore = InMemoryCredentialStore()) -> AppContainer {
        let sessionStore = SessionStore(credentialStore: credentialStore)
        return AppContainer(environment: AppEnvironment(
            mode: .fixture,
            apiClient: FixtureAPIClient(),
            sessionStore: sessionStore
        ))
    }

    static func live(
        baseURL: URL = URL(string: "http://132.145.109.87:4174/")!,
        assetBaseURL: URL = URL(string: "http://132.145.109.87:4173/")!,
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
        let apiURL = RuntimeConfiguration.apiBaseURL
        return live(baseURL: apiURL, assetBaseURL: RuntimeConfiguration.assetBaseURL(for: apiURL))
    }
}

enum RuntimeConfiguration {
    static var apiBaseURL: URL {
        URL(string: value(for: "TICKETGROUND_API_BASE_URL") ?? "http://132.145.109.87:4174/")!
    }

    static func assetBaseURL(for apiURL: URL) -> URL {
        if let configured = value(for: "TICKETGROUND_ASSET_BASE_URL"), let url = URL(string: configured) {
            return url
        }
        guard var components = URLComponents(url: apiURL, resolvingAgainstBaseURL: false), components.port == 4174 else {
            return apiURL
        }
        components.port = 4173
        return components.url ?? apiURL
    }

    private static func value(for key: String) -> String? {
        if let environmentValue = ProcessInfo.processInfo.environment[key], !environmentValue.isEmpty {
            return environmentValue
        }
        let arguments = ProcessInfo.processInfo.arguments
        guard let index = arguments.firstIndex(of: "-\(key)"), arguments.indices.contains(index + 1) else {
            return nil
        }
        return arguments[index + 1]
    }
}
