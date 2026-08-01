import XCTest
@testable import TicketGroundApp

private final class HandoffRedirectURLProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var redirectIssued = false
    private static var redirectURL: URL?
    private static var requests: [URLRequest] = []

    private let stateLock = NSLock()
    private var stopped = false

    static func reset(redirectURL: URL) {
        lock.lock()
        defer { lock.unlock() }
        self.redirectURL = redirectURL
        redirectIssued = false
        requests = []
    }

    static func capturedRequests() -> [URLRequest] {
        lock.lock()
        defer { lock.unlock() }
        return requests
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let redirect = Self.record(request)
        guard redirect.shouldRedirect, let redirectURL = redirect.url else {
            respondWithSuccess()
            return
        }
        guard let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://api.ticketground.test")!,
            statusCode: 307,
            httpVersion: nil,
            headerFields: ["Location": redirectURL.absoluteString]
        ) else { return }
        var proposedRequest = request
        proposedRequest.url = redirectURL
        client?.urlProtocol(self, wasRedirectedTo: proposedRequest, redirectResponse: response)

        DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) { [weak self] in
            self?.finishRejectedRedirect(with: response)
        }
    }

    override func stopLoading() {
        stateLock.lock()
        stopped = true
        stateLock.unlock()
    }

    private static func record(_ request: URLRequest) -> (shouldRedirect: Bool, url: URL?) {
        lock.lock()
        defer { lock.unlock() }
        requests.append(request)
        guard !redirectIssued else { return (false, redirectURL) }
        redirectIssued = true
        return (true, redirectURL)
    }

    private func finishRejectedRedirect(with response: HTTPURLResponse) {
        stateLock.lock()
        guard !stopped else {
            stateLock.unlock()
            return
        }
        stopped = true
        stateLock.unlock()

        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocolDidFinishLoading(self)
    }

    private func respondWithSuccess() {
        guard let response = HTTPURLResponse(
            url: request.url ?? URL(string: "http://credential-capture.test")!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        ) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(#"{"ok":true,"data":{"user":{"id":"captured","name":"Captured","status":"ACTIVE","trustScore":0,"profileConfirmed":false},"session":{"credential":"captured","expiresAt":"2026-09-01T00:00:00.000Z"}}}"#.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
}

final class TicketGroundAppTests: XCTestCase {
    func testAppTargetLoads() {
        XCTAssertTrue(String(describing: ContentView.self).contains("ContentView"))
    }

    func testSupportLoadGenerationRejectsCancelledAndExpiredSession() {
        let generation = LiveSupportLoadGeneration(userID: "user-1", reloadID: 4)

        XCTAssertTrue(generation.isCurrent(userID: "user-1", reloadID: 4, isCancelled: false))
        XCTAssertFalse(generation.isCurrent(userID: nil, reloadID: 4, isCancelled: false))
        XCTAssertFalse(generation.isCurrent(userID: "user-1", reloadID: 5, isCancelled: false))
        XCTAssertFalse(generation.isCurrent(userID: "user-1", reloadID: 4, isCancelled: true))
    }

    func testSupportRequestStageInvalidatesOnlyPrivateUnauthorizedResponse() {
        XCTAssertFalse(LiveSupportRequestStage.publicProbe.invalidatesSession(status: 401))
        XCTAssertTrue(LiveSupportRequestStage.privateThreads.invalidatesSession(status: 401))
        XCTAssertFalse(LiveSupportRequestStage.privateThreads.invalidatesSession(status: 503))
    }

    func testSupportThreadInsertionPreservesLatestCurrentThreads() {
        let current = LiveSupportThread(
            id: "current",
            subject: "현재 문의",
            status: .answered,
            category: nil,
            createdAt: nil,
            updatedAt: "2026-08-02T00:03:00Z",
            messages: []
        )
        let created = LiveSupportThread(
            id: "created",
            subject: "새 문의",
            status: .open,
            category: nil,
            createdAt: nil,
            updatedAt: "2026-08-02T00:04:00Z",
            messages: []
        )

        let merged = puttingSupportThreadFirst(created, in: [current])

        XCTAssertEqual(merged.map(\.id), ["created", "current"])
        XCTAssertEqual(merged[1].updatedAt, "2026-08-02T00:03:00Z")
        XCTAssertEqual(merged[1].status, .answered)
    }

    func testContentSizeOverrideIsLimitedToExplicitUITestValues() {
        XCTAssertNil(TicketGroundApp.requestedSizeCategory(environment: [:]))
        XCTAssertNil(TicketGroundApp.requestedSizeCategory(environment: [
            "TICKETGROUND_UI_CONTENT_SIZE": "large"
        ]))
        XCTAssertEqual(
            TicketGroundApp.requestedSizeCategory(environment: [
                "TICKETGROUND_UI_CONTENT_SIZE": "accessibilityExtraExtraExtraLarge"
            ]),
            .accessibilityExtraExtraExtraLarge
        )
    }

    func testJuly2026CalendarStartsOnWednesday() {
        XCTAssertEqual(DiscoveryCalendarLayout.leadingEmptyDays(year: 2026, month: 7), 2)
    }

    func testGoogleNativeExchangeStoresServerCredential() async throws {
        let apiClient = GoogleExchangeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test")!,
            response: Data(#"{"user":{"id":"google_user_1","name":"Google 사용자","status":"ACTIVE","trustScore":90,"profileConfirmed":false},"session":{"credential":"native-session-credential","expiresAt":"2026-09-01T00:00:00.000Z"}}"#.utf8)
        )
        let credentials = InMemoryCredentialStore()
        let sessionStore = SessionStore(credentialStore: credentials)
        let client = GoogleNativeSessionClient(apiClient: apiClient, sessionStore: sessionStore)

        let user = try await client.exchange(idToken: "google-id-token")

        XCTAssertEqual(user.id, "google_user_1")
        XCTAssertEqual(
            sessionStore.current,
            NativeSession(userID: "google_user_1", credential: "native-session-credential")
        )
        XCTAssertEqual(apiClient.requests.count, 1)
        XCTAssertEqual(apiClient.requests.first?.path, "/api/auth/google/native")

        try await client.logout()
        XCTAssertNil(sessionStore.current)
        XCTAssertEqual(apiClient.revokedSessions.count, 1)
    }

    func testGoogleNativeExchangeRejectsHTTPBeforeSendingToken() async {
        let apiClient = GoogleExchangeAPIClient(
            baseURL: URL(string: "http://localhost:5501")!,
            response: Data()
        )
        let client = GoogleNativeSessionClient(
            apiClient: apiClient,
            sessionStore: SessionStore(credentialStore: InMemoryCredentialStore())
        )

        do {
            _ = try await client.exchange(idToken: "google-id-token")
            XCTFail("Expected insecure transport rejection")
        } catch let error as GoogleLoginError {
            XCTAssertEqual(error, .httpsRequired)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
        XCTAssertTrue(apiClient.requests.isEmpty)
    }

    func testRestoredSessionRequiresServerValidationAndClearsOnlyInvalidCredential() async {
        let validCredentials = InMemoryCredentialStore()
        validCredentials.save(StoredCredential(
            credential: "restored-credential",
            serverUserID: "google_user_1"
        ))
        let validStore = SessionStore(credentialStore: validCredentials)
        let validAPI = GoogleExchangeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test")!,
            response: Data()
        )
        let validClient = GoogleNativeSessionClient(apiClient: validAPI, sessionStore: validStore)

        XCTAssertNil(validStore.current)
        await validClient.validateRestoredSession()
        XCTAssertEqual(
            validStore.current,
            NativeSession(userID: "google_user_1", credential: "restored-credential")
        )
        XCTAssertEqual(validAPI.validatedSessions.count, 1)

        let invalidCredentials = InMemoryCredentialStore()
        invalidCredentials.save(StoredCredential(
            credential: "revoked-credential",
            serverUserID: "google_user_1"
        ))
        let invalidStore = SessionStore(credentialStore: invalidCredentials)
        let invalidAPI = GoogleExchangeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test")!,
            response: Data(),
            validationError: .server(
                status: 401,
                code: "NATIVE_SESSION_INVALID",
                message: "invalid"
            )
        )

        await GoogleNativeSessionClient(
            apiClient: invalidAPI,
            sessionStore: invalidStore
        ).validateRestoredSession()
        XCTAssertNil(invalidStore.current)
        XCTAssertNil(invalidCredentials.read())

        let offlineCredentials = InMemoryCredentialStore()
        offlineCredentials.save(StoredCredential(
            credential: "offline-credential",
            serverUserID: "google_user_1"
        ))
        let offlineStore = SessionStore(credentialStore: offlineCredentials)
        let offlineAPI = GoogleExchangeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test")!,
            response: Data(),
            validationError: .requestFailed(code: URLError.notConnectedToInternet.rawValue)
        )

        await GoogleNativeSessionClient(
            apiClient: offlineAPI,
            sessionStore: offlineStore
        ).validateRestoredSession()
        XCTAssertNil(offlineStore.current)
        XCTAssertEqual(offlineCredentials.read()?.credential, "offline-credential")
    }

    @MainActor
    func testGoogleCoordinatorSeparatesCancellationFromSuccess() async {
        let cancelled = GoogleLoginCoordinator(
            identityProvider: StubGoogleIdentityProvider(result: .failure(.cancelled)),
            sessionExchanger: StubGoogleSessionExchanger()
        )
        await cancelled.signIn()
        XCTAssertEqual(cancelled.state, .cancelled)

        let exchanger = StubGoogleSessionExchanger()
        let signedIn = GoogleLoginCoordinator(
            identityProvider: StubGoogleIdentityProvider(result: .success("google-id-token")),
            sessionExchanger: exchanger
        )
        await signedIn.signIn()
        XCTAssertEqual(signedIn.state, .signedIn(userName: "Google 사용자"))
        XCTAssertEqual(exchanger.receivedTokens, ["google-id-token"])
    }

    func testSocialStartURLRequiresHTTPS() throws {
        let secureURL = try SocialLoginCoordinator.startURL(
            baseURL: URL(string: "https://api.ticketground.test")!,
            provider: .kakao
        )
        XCTAssertEqual(secureURL.absoluteString, "https://api.ticketground.test/api/auth/kakao/start?client=ios")

        XCTAssertThrowsError(try SocialLoginCoordinator.startURL(
            baseURL: URL(string: "http://localhost:5501")!,
            provider: .naver
        )) { error in
            XCTAssertEqual(error as? SocialLoginError, .httpsRequired)
        }
    }

    func testSocialCallbackRequiresFixedTupleAndMatchingProvider() throws {
        let valid = URL(string: "ticketground://auth/social/callback?provider=kakao&code=one-use-code")!
        XCTAssertEqual(
            try SocialLoginCoordinator.handoffCode(from: valid, provider: .kakao),
            "one-use-code"
        )

        let wrongProvider = URL(string: "ticketground://auth/social/callback?provider=naver&code=one-use-code")!
        XCTAssertThrowsError(try SocialLoginCoordinator.handoffCode(from: wrongProvider, provider: .kakao)) { error in
            XCTAssertEqual(error as? SocialLoginError, .providerMismatch)
        }

        let wrongPath = URL(string: "ticketground://auth/other?provider=kakao&code=one-use-code")!
        XCTAssertThrowsError(try SocialLoginCoordinator.handoffCode(from: wrongPath, provider: .kakao)) { error in
            XCTAssertEqual(error as? SocialLoginError, .invalidCallback)
        }

        for (errorCode, expectedError) in [
            ("not_configured", SocialLoginError.providerNotConfigured(.kakao)),
            ("denied", SocialLoginError.providerDenied(.kakao)),
            ("state_invalid", SocialLoginError.providerStateInvalid(.kakao)),
            ("callback_failed", SocialLoginError.providerCallbackFailed(.kakao))
        ] {
            let failure = URL(
                string: "ticketground://auth/social/callback?provider=kakao&error=\(errorCode)"
            )!
            XCTAssertThrowsError(
                try SocialLoginCoordinator.handoffCode(from: failure, provider: .kakao)
            ) { error in
                XCTAssertEqual(error as? SocialLoginError, expectedError)
            }
        }
    }

    @MainActor
    func testSocialCoordinatorReportsMissingConfigurationBeforeBrowserStarts() async {
        let readiness = StubSocialReadinessChecker(
            result: .failure(.providerNotConfigured(.naver))
        )
        let authenticator = StubSocialWebAuthenticator(
            result: .success(URL(
                string: "ticketground://auth/social/callback?provider=naver&code=unused"
            )!)
        )
        let coordinator = SocialLoginCoordinator(
            provider: .naver,
            baseURL: URL(string: "https://api.ticketground.test")!,
            readinessChecker: readiness,
            authenticator: authenticator,
            sessionExchanger: StubSocialSessionExchanger()
        )

        await coordinator.signIn()

        XCTAssertEqual(readiness.providers, [.naver])
        XCTAssertTrue(authenticator.startURLs.isEmpty)
        XCTAssertEqual(
            coordinator.state,
            .failed(
                provider: .naver,
                message: SocialLoginError.providerNotConfigured(.naver).localizedDescription
            )
        )
    }

    @MainActor
    func testSocialCoordinatorMapsAppFailureCallbackWithoutExchangingSession() async {
        let readiness = StubSocialReadinessChecker(result: .success(()))
        let authenticator = StubSocialWebAuthenticator(
            result: .success(URL(
                string: "ticketground://auth/social/callback?provider=kakao&error=denied"
            )!)
        )
        let exchanger = StubSocialSessionExchanger()
        let coordinator = SocialLoginCoordinator(
            provider: .kakao,
            baseURL: URL(string: "https://api.ticketground.test")!,
            readinessChecker: readiness,
            authenticator: authenticator,
            sessionExchanger: exchanger
        )

        await coordinator.signIn()

        XCTAssertEqual(
            coordinator.state,
            .failed(
                provider: .kakao,
                message: SocialLoginError.providerDenied(.kakao).localizedDescription
            )
        )
        XCTAssertTrue(exchanger.exchanges.isEmpty)
    }

    func testSocialReadinessClientMapsUnavailableProvider() async {
        let apiClient = GoogleExchangeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test")!,
            response: Data(#"{"provider":"kakao","ready":false}"#.utf8)
        )
        let client = SocialNativeSessionClient(
            apiClient: apiClient,
            sessionStore: SessionStore(credentialStore: InMemoryCredentialStore())
        )

        do {
            try await client.requireReady(provider: .kakao)
            XCTFail("Expected missing Kakao configuration")
        } catch let error as SocialLoginError {
            XCTAssertEqual(error, .providerNotConfigured(.kakao))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
        XCTAssertEqual(apiClient.requests.map(\.path), ["/api/auth/kakao/preflight"])
    }

    @MainActor
    func testSocialCoordinatorCancellationPreservesCurrentSession() async {
        let credentials = InMemoryCredentialStore()
        let sessionStore = SessionStore(credentialStore: credentials)
        sessionStore.saveNativeCredential("existing-native-session", serverUserID: "existing-user")
        let exchanger = StubSocialSessionExchanger()
        let coordinator = SocialLoginCoordinator(
            provider: .kakao,
            baseURL: URL(string: "https://api.ticketground.test")!,
            readinessChecker: StubSocialReadinessChecker(result: .success(())),
            authenticator: StubSocialWebAuthenticator(result: .failure(.cancelled)),
            sessionExchanger: exchanger
        )

        await coordinator.signIn()

        XCTAssertEqual(coordinator.state, .cancelled(provider: .kakao))
        XCTAssertEqual(
            sessionStore.current,
            NativeSession(userID: "existing-user", credential: "existing-native-session")
        )
        XCTAssertTrue(exchanger.exchanges.isEmpty)
    }

    func testSocialNativeExchangeStoresServerCredentialAndProviderBody() async throws {
        let apiClient = GoogleExchangeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test")!,
            response: Data(#"{"user":{"id":"kakao_user_1","name":"카카오 사용자","status":"ACTIVE","trustScore":85,"profileConfirmed":false},"session":{"credential":"social-native-session","expiresAt":"2026-09-01T00:00:00.000Z"}}"#.utf8)
        )
        let credentials = InMemoryCredentialStore()
        let sessionStore = SessionStore(credentialStore: credentials)
        let client = SocialNativeSessionClient(apiClient: apiClient, sessionStore: sessionStore)

        let user = try await client.exchange(provider: .kakao, code: "one-use-code")

        XCTAssertEqual(user.id, "kakao_user_1")
        XCTAssertEqual(
            sessionStore.current,
            NativeSession(userID: "kakao_user_1", credential: "social-native-session")
        )
        XCTAssertEqual(apiClient.requests.count, 1)
        XCTAssertEqual(apiClient.requests.first?.path, "/api/auth/native/handoff")
        guard case .json(let body) = apiClient.requests.first?.body else {
            return XCTFail("Expected JSON exchange body")
        }
        let payload = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: String])
        XCTAssertEqual(payload, ["provider": "kakao", "code": "one-use-code"])
    }

    func testSocialNativeExchangeMapsProviderMismatchWithoutPersisting() async {
        let apiClient = SocialExchangeFailingAPIClient(
            error: .server(status: 401, code: "NATIVE_HANDOFF_INVALID", message: "invalid")
        )
        let credentials = InMemoryCredentialStore()
        let sessionStore = SessionStore(credentialStore: credentials)
        let client = SocialNativeSessionClient(apiClient: apiClient, sessionStore: sessionStore)

        do {
            _ = try await client.exchange(provider: .naver, code: "wrong-provider-code")
            XCTFail("Expected provider-bound handoff rejection")
        } catch let error as SocialLoginError {
            XCTAssertEqual(error, .invalidHandoff)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
        XCTAssertNil(sessionStore.current)
        XCTAssertNil(credentials.read())
    }

    func testSocialNativeExchangeDoesNotForwardHandoffCodeAcrossRedirect() async throws {
        let redirectURL = URL(string: "http://credential-capture.test/handoff")!
        HandoffRedirectURLProtocol.reset(redirectURL: redirectURL)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [HandoffRedirectURLProtocol.self]
        let apiClient = LiveAPIClient(
            baseURL: URL(string: "https://api.ticketground.test")!,
            assetBaseURL: nil,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let client = SocialNativeSessionClient(
            apiClient: apiClient,
            sessionStore: SessionStore(credentialStore: InMemoryCredentialStore())
        )

        do {
            _ = try await client.exchange(provider: .naver, code: "one-use-code")
            XCTFail("Expected redirect rejection")
        } catch let error as SocialLoginError {
            XCTAssertEqual(error, .network)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        let requests = HandoffRedirectURLProtocol.capturedRequests()
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.url?.scheme, "https")
        XCTAssertFalse(requests.contains { $0.url == redirectURL })
    }
}

@MainActor
private final class StubSocialWebAuthenticator: SocialWebAuthenticating {
    private let result: Result<URL, SocialLoginError>
    private(set) var startURLs: [URL] = []

    init(result: Result<URL, SocialLoginError>) { self.result = result }
    func authenticate(startURL: URL, callbackScheme: String) async throws -> URL {
        startURLs.append(startURL)
        return try result.get()
    }
}

private final class StubSocialReadinessChecker: SocialProviderReadinessChecking {
    private let result: Result<Void, SocialLoginError>
    private(set) var providers: [SocialLoginProvider] = []

    init(result: Result<Void, SocialLoginError>) { self.result = result }

    func requireReady(provider: SocialLoginProvider) async throws {
        providers.append(provider)
        try result.get()
    }
}

private final class StubSocialSessionExchanger: SocialSessionExchanging {
    private(set) var exchanges: [(SocialLoginProvider, String)] = []

    func exchange(provider: SocialLoginProvider, code: String) async throws -> SocialSessionUser {
        exchanges.append((provider, code))
        return SocialSessionUser(
            id: "social_user_1",
            name: "소셜 사용자",
            status: "ACTIVE",
            trustScore: 80,
            profileConfirmed: false
        )
    }
}

private final class SocialExchangeFailingAPIClient: APIClient {
    let mode: APIDataMode = .live
    let baseURL = URL(string: "https://api.ticketground.test")
    private let error: APIClientError

    init(error: APIClientError) { self.error = error }
    func data(for request: APIRequest) async throws -> Data { throw error }
    func resolveResource(_ reference: String?) -> String? { reference }
}

private final class StubGoogleIdentityProvider: GoogleIdentityProviding {
    private let result: Result<String, GoogleLoginError>

    init(result: Result<String, GoogleLoginError>) { self.result = result }
    func signInIDToken() async throws -> String { try result.get() }
    func signOut() {}
}

private final class StubGoogleSessionExchanger: GoogleSessionExchanging {
    private(set) var receivedTokens: [String] = []

    func exchange(idToken: String) async throws -> GoogleSessionUser {
        receivedTokens.append(idToken)
        return GoogleSessionUser(
            id: "google_user_1",
            name: "Google 사용자",
            status: "ACTIVE",
            trustScore: 90,
            profileConfirmed: false
        )
    }
}

private final class GoogleExchangeAPIClient: APIClient {
    let mode: APIDataMode = .live
    let baseURL: URL?
    private let response: Data
    private let validationError: APIClientError?
    private(set) var requests: [APIRequest] = []
    private(set) var revokedSessions: [NativeSession] = []
    private(set) var validatedSessions: [NativeSession] = []

    init(baseURL: URL, response: Data, validationError: APIClientError? = nil) {
        self.baseURL = baseURL
        self.response = response
        self.validationError = validationError
    }

    func data(for request: APIRequest) async throws -> Data {
        requests.append(request)
        return response
    }

    func resolveResource(_ reference: String?) -> String? { reference }

    func revokeNativeSession(_ session: NativeSession) async throws {
        revokedSessions.append(session)
    }

    func validateNativeSession(_ session: NativeSession) async throws {
        validatedSessions.append(session)
        if let validationError { throw validationError }
    }
}
