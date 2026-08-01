import GoogleSignIn
import Observation
import UIKit

@MainActor
protocol GoogleIdentityProviding: AnyObject {
    func signInIDToken() async throws -> String
    func signOut()
}

protocol GoogleSessionExchanging: AnyObject {
    func exchange(idToken: String) async throws -> GoogleSessionUser
}

extension GoogleNativeSessionClient: GoogleSessionExchanging {}

enum GoogleLoginState: Equatable {
    case idle
    case loading
    case cancelled
    case signedIn(userName: String)
    case failed(message: String)
}

@MainActor
@Observable
final class GoogleLoginCoordinator {
    private let identityProvider: GoogleIdentityProviding
    private let sessionExchanger: GoogleSessionExchanging
    private(set) var state: GoogleLoginState = .idle

    init(
        identityProvider: GoogleIdentityProviding,
        sessionExchanger: GoogleSessionExchanging
    ) {
        self.identityProvider = identityProvider
        self.sessionExchanger = sessionExchanger
    }

    func signIn() async {
        state = .loading
        do {
            let idToken = try await identityProvider.signInIDToken()
            let user = try await sessionExchanger.exchange(idToken: idToken)
            state = .signedIn(userName: user.name)
        } catch GoogleLoginError.cancelled {
            state = .cancelled
        } catch let error as LocalizedError {
            state = .failed(message: error.errorDescription ?? "Google 로그인에 실패했습니다.")
        } catch {
            state = .failed(message: "Google 로그인에 실패했습니다.")
        }
    }

    func signOut() {
        identityProvider.signOut()
        state = .idle
    }
}

@MainActor
final class GoogleSignInProvider: GoogleIdentityProviding {
    static func handle(_ url: URL) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    func signInIDToken() async throws -> String {
        guard let presenter = Self.presentingViewController() else {
            throw GoogleLoginError.missingConfiguration
        }
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let idToken = result.user.idToken?.tokenString, !idToken.isEmpty else {
                throw GoogleLoginError.invalidCredential
            }
            return idToken
        } catch let error as GoogleLoginError {
            throw error
        } catch {
            let nsError = error as NSError
            if nsError.domain == kGIDSignInErrorDomain && nsError.code == -5 {
                throw GoogleLoginError.cancelled
            }
            throw GoogleLoginError.network
        }
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
    }

    private static func presentingViewController() -> UIViewController? {
        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
        return visibleViewController(from: root)
    }

    private static func visibleViewController(from controller: UIViewController?) -> UIViewController? {
        if let presented = controller?.presentedViewController {
            return visibleViewController(from: presented)
        }
        if let navigation = controller as? UINavigationController {
            return visibleViewController(from: navigation.visibleViewController)
        }
        if let tab = controller as? UITabBarController {
            return visibleViewController(from: tab.selectedViewController)
        }
        return controller
    }
}
