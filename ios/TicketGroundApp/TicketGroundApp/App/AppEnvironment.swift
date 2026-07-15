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

protocol APIClient: AnyObject {
    var mode: APIDataMode { get }
    func data(for path: String) async throws -> Data
    func resolveResource(_ reference: String?) -> String?
}

enum APIClientError: Error, Equatable, LocalizedError {
    case liveTransportUnavailable
    case invalidBaseURL
    case invalidResponse
    case server(status: Int, code: String, message: String)
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .liveTransportUnavailable: return "라이브 API 전송이 준비되지 않았습니다."
        case .invalidBaseURL: return "API 서버 주소가 올바르지 않습니다."
        case .invalidResponse: return "API 응답 형식을 확인할 수 없습니다."
        case .server(_, _, let message): return message
        case .requestFailed(let message): return message
        }
    }
}

final class FixtureAPIClient: APIClient {
    let mode: APIDataMode = .fixture

    func data(for path: String) async throws -> Data {
        Data("{}".utf8)
    }

    func resolveResource(_ reference: String?) -> String? {
        reference
    }
}

final class DisabledLiveAPIClient: APIClient {
    let mode: APIDataMode = .live

    func data(for path: String) async throws -> Data {
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

    func data(for path: String) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIClientError.invalidBaseURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if url.scheme?.lowercased() == "https",
           let token = credentialStore.read(),
           !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

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
        } catch {
            throw APIClientError.requestFailed(error.localizedDescription)
        }
    }

    func resolveResource(_ reference: String?) -> String? {
        guard let reference, !reference.isEmpty else { return nil }
        if let absolute = URL(string: reference), absolute.scheme != nil {
            return absolute.absoluteString
        }
        return URL(string: reference, relativeTo: assetBaseURL)?.absoluteURL.absoluteString
    }

    private func unwrap(_ data: Data) throws -> Data {
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
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

protocol CredentialStore: AnyObject {
    func read() -> String?
    func save(_ credential: String)
    func delete()
}

final class InMemoryCredentialStore: CredentialStore {
    private(set) var value: String?

    func read() -> String? { value }

    func save(_ credential: String) {
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

    func read() -> String? {
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
        return String(data: data, encoding: .utf8)
    }

    func save(_ credential: String) {
        let data = Data(credential.utf8)
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
        guard let credential = credentialStore.read(), !credential.isEmpty else {
            current = nil
            return
        }
        current = NativeSession(userID: "native", credential: credential)
    }

    func saveNativeCredential(_ credential: String) {
        guard !credential.isEmpty else { return }
        credentialStore.save(credential)
        current = NativeSession(userID: "native", credential: credential)
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
