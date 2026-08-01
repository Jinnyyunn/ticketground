import AuthenticationServices
import Observation
import UIKit

@MainActor
protocol SocialWebAuthenticating: AnyObject {
    func authenticate(startURL: URL, callbackScheme: String) async throws -> URL
}

protocol SocialSessionExchanging: AnyObject {
    func exchange(provider: SocialLoginProvider, code: String) async throws -> SocialSessionUser
}

protocol SocialProviderReadinessChecking: AnyObject {
    func requireReady(provider: SocialLoginProvider) async throws
}

extension SocialNativeSessionClient: SocialSessionExchanging {}
extension SocialNativeSessionClient: SocialProviderReadinessChecking {}

enum SocialLoginState: Equatable {
    case idle
    case loading(provider: SocialLoginProvider)
    case cancelled(provider: SocialLoginProvider)
    case signedIn(provider: SocialLoginProvider, userName: String)
    case failed(provider: SocialLoginProvider, message: String)
}

@MainActor
@Observable
final class SocialLoginCoordinator {
    nonisolated static let callbackScheme = "ticketground"

    private let provider: SocialLoginProvider
    private let baseURL: URL
    private let readinessChecker: SocialProviderReadinessChecking
    private let authenticator: SocialWebAuthenticating
    private let sessionExchanger: SocialSessionExchanging
    private(set) var state: SocialLoginState = .idle

    init(
        provider: SocialLoginProvider,
        baseURL: URL,
        readinessChecker: SocialProviderReadinessChecking,
        authenticator: SocialWebAuthenticating,
        sessionExchanger: SocialSessionExchanging
    ) {
        self.provider = provider
        self.baseURL = baseURL
        self.readinessChecker = readinessChecker
        self.authenticator = authenticator
        self.sessionExchanger = sessionExchanger
    }

    func signIn() async {
        state = .loading(provider: provider)
        do {
            let startURL = try Self.startURL(baseURL: baseURL, provider: provider)
            try await readinessChecker.requireReady(provider: provider)
            let callbackURL = try await authenticator.authenticate(
                startURL: startURL,
                callbackScheme: Self.callbackScheme
            )
            let code = try Self.handoffCode(from: callbackURL, provider: provider)
            let user = try await sessionExchanger.exchange(provider: provider, code: code)
            state = .signedIn(provider: provider, userName: user.name)
        } catch SocialLoginError.cancelled {
            state = .cancelled(provider: provider)
        } catch let error as LocalizedError {
            state = .failed(
                provider: provider,
                message: error.errorDescription ?? "\(provider.displayName) 로그인에 실패했습니다."
            )
        } catch {
            state = .failed(provider: provider, message: "\(provider.displayName) 로그인에 실패했습니다.")
        }
    }

    nonisolated static func startURL(
        baseURL: URL,
        provider: SocialLoginProvider
    ) throws -> URL {
        guard baseURL.scheme?.lowercased() == "https",
              let startURL = URL(
                string: "/api/auth/\(provider.rawValue)/start",
                relativeTo: baseURL
              )?.absoluteURL,
              var components = URLComponents(
                url: startURL,
                resolvingAgainstBaseURL: false
              ) else {
            throw SocialLoginError.httpsRequired
        }
        components.queryItems = [URLQueryItem(name: "client", value: "ios")]
        guard let url = components.url else { throw SocialLoginError.httpsRequired }
        return url
    }

    nonisolated static func handoffCode(
        from callbackURL: URL,
        provider: SocialLoginProvider
    ) throws -> String {
        guard callbackURL.scheme?.lowercased() == callbackScheme,
              callbackURL.host?.lowercased() == "auth",
              callbackURL.path == "/social/callback",
              let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false) else {
            throw SocialLoginError.invalidCallback
        }
        let queryItems = components.queryItems ?? []
        let providerValues = queryItems.filter { $0.name == "provider" }
        let codeValues = queryItems.filter { $0.name == "code" }
        let errorValues = queryItems.filter { $0.name == "error" }
        guard queryItems.count == 2, providerValues.count == 1 else {
            throw SocialLoginError.invalidCallback
        }
        guard providerValues[0].value == provider.rawValue else {
            throw SocialLoginError.providerMismatch
        }
        if codeValues.count == 1, errorValues.isEmpty,
           let code = codeValues[0].value, !code.isEmpty {
            return code
        }
        guard codeValues.isEmpty, errorValues.count == 1,
              let error = errorValues[0].value else {
            throw SocialLoginError.invalidCallback
        }
        switch error {
        case "not_configured": throw SocialLoginError.providerNotConfigured(provider)
        case "denied": throw SocialLoginError.providerDenied(provider)
        case "state_invalid": throw SocialLoginError.providerStateInvalid(provider)
        case "callback_failed": throw SocialLoginError.providerCallbackFailed(provider)
        default: throw SocialLoginError.invalidCallback
        }
    }
}

@MainActor
final class SocialWebAuthenticator: NSObject, SocialWebAuthenticating, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func authenticate(startURL: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: startURL,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                self?.session = nil
                if let webError = error as? ASWebAuthenticationSessionError,
                   webError.code == .canceledLogin {
                    continuation.resume(throwing: SocialLoginError.cancelled)
                } else if let callbackURL {
                    continuation.resume(returning: callbackURL)
                } else {
                    continuation.resume(throwing: SocialLoginError.network)
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            guard session.start() else {
                self.session = nil
                continuation.resume(throwing: SocialLoginError.network)
                return
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
