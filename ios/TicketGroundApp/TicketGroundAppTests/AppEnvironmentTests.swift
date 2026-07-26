import XCTest
@testable import TicketGroundApp

private final class LiveAPIURLProtocol: URLProtocol {
    static var responseData = Data()
    static var statusCode = 200
    static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        guard let response = HTTPURLResponse(
            url: request.url ?? URL(string: "http://localhost")!,
            statusCode: Self.statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        ) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.responseData)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private final class RedirectingLiveAPIURLProtocol: URLProtocol {
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
            url: request.url ?? URL(string: "https://ticketground.test")!,
            statusCode: 307,
            httpVersion: nil,
            headerFields: ["Location": redirectURL.absoluteString]
        ) else { return }

        var proposedRequest = URLRequest(url: redirectURL)
        proposedRequest.httpMethod = request.httpMethod
        proposedRequest.setValue(request.value(forHTTPHeaderField: "Accept"), forHTTPHeaderField: "Accept")
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
            url: request.url ?? URL(string: "https://ticketground.test")!,
            statusCode: 200,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        ) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(#"{"ok":true,"data":{"id":"server-user-42"}}"#.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
}

final class AppEnvironmentTests: XCTestCase {
    func testColdStartAndRouteRestore() {
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "server-user"))
        let session = SessionStore(credentialStore: credentials)
        let container = AppContainer(environment: AppEnvironment(
            mode: .fixture,
            apiClient: FixtureAPIClient(),
            sessionStore: session
        ))
        container.navigationPath = [.goods(slug: "ticketground-day")]

        XCTAssertEqual(session.current, NativeSession(userID: "server-user", credential: "native-credential"))
        XCTAssertEqual(RouteResolver.resolve(path: "/goods/ticketground-day"), .goods(slug: "ticketground-day"))
        XCTAssertEqual(container.navigationPath.map(\.id), ["goods:ticketground-day"])
        XCTAssertEqual(container.environment.mode, .fixture)
    }

    func testMalformedLinkAndMissingKeychain() {
        let credentials = InMemoryCredentialStore()
        let session = SessionStore(credentialStore: credentials)
        XCTAssertNil(session.current)
        XCTAssertNil(RouteResolver.resolve(path: "/goods/%ZZ"))
        XCTAssertNil(RouteResolver.resolve(path: "/admin"))

        session.setFixtureUser("demo-user")
        XCTAssertEqual(session.current?.userID, "demo-user")
        session.logout()
        XCTAssertNil(session.current)
        XCTAssertNil(credentials.read())
    }

    func testRouteAliasesAndInventory() {
        XCTAssertEqual(RouteResolver.resolve(path: "/contents/notice"), .open)
        XCTAssertEqual(RouteResolver.resolve(path: "/support/inquiry"), .inquiry)

        let routes: [AppRoute] = [
            .home, .search, .ranking, .genre(name: "concert"), .region, .open,
            .event(slug: "event"), .place(slug: nil), .artist(slug: "artist"),
            .goods(slug: "goods"), .queue(slug: "queue"), .booking(slug: "booking"),
            .checkout(slug: "checkout"), .reservation(id: "reservation"), .login,
            .signup, .mypage, .cancel, .resale, .transfer, .watchlist, .help, .inquiry
        ]
        XCTAssertEqual(Set(routes.map(\.id)).count, routes.count)
        XCTAssertNil(RouteResolver.resolve(path: "/admin"))
        XCTAssertNil(RouteResolver.resolve(path: "/contents/genre/"))
    }

    func testLiveAPIClientUnwrapsBackendEnvelope() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveAPIURLProtocol.self]
        let session = URLSession(configuration: configuration)
        LiveAPIURLProtocol.responseData = Data(#"{"ok":true,"data":{"total":3}}"#.utf8)
        LiveAPIURLProtocol.statusCode = 200

        let client = LiveAPIClient(
            baseURL: URL(string: "http://127.0.0.1:4174/")!,
            assetBaseURL: URL(string: "http://127.0.0.1:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: session
        )

        let response = try await client.data(for: "/api/catalog")
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: response) as? [String: Int])
        XCTAssertEqual(object["total"], 3)
        XCTAssertEqual(client.resolveResource("/assets/poster.jpg"), "http://127.0.0.1:4173/assets/poster.jpg")
    }

    func testLiveAPIClientDoesNotSendBearerCredentialOverHTTP() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveAPIURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "server-user-42"))
        LiveAPIURLProtocol.requests = []
        LiveAPIURLProtocol.responseData = Data(#"{"ok":true,"data":{"total":3}}"#.utf8)
        LiveAPIURLProtocol.statusCode = 200

        let client = LiveAPIClient(
            baseURL: URL(string: "http://127.0.0.1:4174/")!,
            assetBaseURL: URL(string: "http://127.0.0.1:4173/")!,
            credentialStore: credentials,
            session: session
        )

        _ = try await client.data(for: "/api/catalog")
        let request = try XCTUnwrap(LiveAPIURLProtocol.requests.first)

        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }

    func testLiveAPIClientRefusesAuthenticatedRequestOverHTTP() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveAPIURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "server-user-42"))
        LiveAPIURLProtocol.requests = []

        let client = LiveAPIClient(
            baseURL: URL(string: "http://127.0.0.1:4174/")!,
            assetBaseURL: URL(string: "http://127.0.0.1:4173/")!,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await client.data(for: APIRequest(
                method: .get,
                path: "/api/users/server-user-42/session",
                authentication: .required(userID: "server-user-42")
            ))
            XCTFail("Expected insecure credential transport error")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .insecureCredentialTransport)
            XCTAssertEqual(error.localizedDescription, "보안 인증 정보는 HTTPS 연결에서만 전송할 수 있습니다.")
            XCTAssertTrue(LiveAPIURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testLiveAPIClientUsesTypedRequestBoundaryAndIdempotencyHeader() throws {
        let client = LiveAPIClient(
            baseURL: URL(string: "https://127.0.0.1/")!,
            assetBaseURL: URL(string: "https://127.0.0.1/")!,
            credentialStore: InMemoryCredentialStore()
        )
        let body = Data(#"{"ticketId":"ticket-1"}"#.utf8)
        let request = APIRequest(
            method: .post,
            path: "/api/tickets/buy",
            query: [APIRequestQuery(name: "source", value: "mobile app")],
            headers: [APIRequestHeader(name: "X-Trace", value: "trace-1")],
            body: .json(body),
            idempotencyKey: "idempotency-1"
        )

        let emitted = try client.urlRequest(for: request)
        let queryItems = try XCTUnwrap(emitted.url.flatMap {
            URLComponents(url: $0, resolvingAgainstBaseURL: false)
        }?.queryItems)

        XCTAssertEqual(emitted.httpMethod, "POST")
        XCTAssertEqual(queryItems, [URLQueryItem(name: "source", value: "mobile app")])
        XCTAssertEqual(emitted.value(forHTTPHeaderField: "X-Trace"), "trace-1")
        XCTAssertEqual(emitted.value(forHTTPHeaderField: "X-Idempotency-Key"), "idempotency-1")
        XCTAssertEqual(emitted.httpBody, body)
    }

    func testLiveAPIClientMapsTransportFailureToDeterministicError() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FailingLiveAPIURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://127.0.0.1/")!,
            assetBaseURL: URL(string: "https://127.0.0.1/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await client.data(for: "/api/catalog")
            XCTFail("Expected deterministic transport error")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .requestFailed(code: URLError.Code.timedOut.rawValue))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testSessionStoreRestoresServerUserIDPairedWithCredential() {
        let credentials = InMemoryCredentialStore()
        let initial = SessionStore(credentialStore: credentials)

        initial.saveNativeCredential("native-credential", serverUserID: "server-user-42")
        let restored = SessionStore(credentialStore: credentials)

        XCTAssertEqual(
            restored.current,
            NativeSession(userID: "server-user-42", credential: "native-credential")
        )
        XCTAssertEqual(
            credentials.read(),
            StoredCredential(credential: "native-credential", serverUserID: "server-user-42")
        )
    }

    func testAccountCapabilityRequiresLoginWithoutPairedSession() {
        let state = LiveAccountCapabilityState.resolve(
            for: .account,
            capabilityMap: accountCapabilityMap(state: .available),
            session: nil
        )

        XCTAssertEqual(state, .loginRequired)
    }

    func testAccountCapabilityRequiresBothSessionAndTickets() {
        let capabilityMap = LiveCapabilityMap(
            diagnostics: LiveAPIContractDiagnostics(
                expectedResponseVersion: "expected",
                observedResponseVersion: "expected"
            ),
            baseURL: URL(string: "https://ticketground.test/")!,
            states: [
                .session: .available,
                .tickets: .unknown
            ]
        )

        XCTAssertEqual(
            LiveAccountCapabilityState.resolve(
                for: .account,
                capabilityMap: capabilityMap,
                session: NativeSession(userID: "server-user-42", credential: "native-credential")
            ),
            .retry
        )
    }

    func testAccountCapabilityRequiresLoginAfterExpiredOrMismatchedCredential() {
        let capabilityMap = accountCapabilityMap(state: .available)
        let session = NativeSession(userID: "server-user-42", credential: "native-credential")

        XCTAssertEqual(
            LiveAccountCapabilityState.resolve(
                for: .watchlist,
                capabilityMap: capabilityMap,
                session: session,
                requestError: .server(status: 401, code: "UNAUTHORIZED", message: "expired")
            ),
            .loginRequired
        )
        XCTAssertEqual(
            LiveAccountCapabilityState.resolve(
                for: .support,
                capabilityMap: capabilityMap,
                session: session,
                requestError: .credentialOwnerMismatch
            ),
            .loginRequired
        )
    }

    func testAccountCapabilityRequiresHTTPSBeforeAuthenticatedRead() {
        let state = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: accountCapabilityMap(state: .blocked(.requiresHTTPS)),
            session: NativeSession(userID: "server-user-42", credential: "native-credential")
        )

        XCTAssertEqual(state, .httpsRequired)
    }

    func testLogoutClearsPairedCredentialsAndReturnsLoginRequiredCapability() {
        let credentials = InMemoryCredentialStore()
        let session = SessionStore(credentialStore: credentials)
        session.saveNativeCredential("native-credential", serverUserID: "server-user-42")

        session.logout()

        XCTAssertNil(credentials.read())
        XCTAssertEqual(
            LiveAccountCapabilityState.resolve(
                for: .support,
                capabilityMap: accountCapabilityMap(state: .available),
                session: session.current
            ),
            .loginRequired
        )
    }

    func testAccountCapabilityReturnsUnsupportedRetryAndHelpStates() {
        XCTAssertEqual(
            LiveAccountCapabilityState.resolve(
                for: .watchlist,
                capabilityMap: accountCapabilityMap(state: .blocked(.unsupportedMutation)),
                session: NativeSession(userID: "server-user-42", credential: "native-credential")
            ),
            .unsupported
        )
        XCTAssertEqual(
            LiveAccountCapabilityState.resolve(
                for: .support,
                capabilityMap: accountCapabilityMap(state: .unknown),
                session: NativeSession(userID: "server-user-42", credential: "native-credential")
            ),
            .retry
        )
        XCTAssertEqual(
            LiveAccountCapabilityState.resolve(
                for: .account,
                capabilityMap: accountCapabilityMap(
                    state: .incompatible(expected: "expected", observed: "observed")
                ),
                session: NativeSession(userID: "server-user-42", credential: "native-credential")
            ),
            .help
        )
    }

    func testLiveAPIClientSendsBearerCredentialOnlyOverHTTPS() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveAPIURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "server-user-42"))
        LiveAPIURLProtocol.responseData = Data(#"{"ok":true,"data":{"total":3}}"#.utf8)
        LiveAPIURLProtocol.statusCode = 200
        LiveAPIURLProtocol.requests = []

        let client = LiveAPIClient(
            baseURL: URL(string: "https://127.0.0.1/")!,
            assetBaseURL: URL(string: "https://127.0.0.1/")!,
            credentialStore: credentials,
            session: session
        )

        _ = try await client.data(for: APIRequest(
            method: .get,
            path: "/api/users/server-user-42/session",
            authentication: .required(userID: "server-user-42")
        ))
        let request = try XCTUnwrap(LiveAPIURLProtocol.requests.first)

        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer native-credential")
    }

    func testLiveAPIClientFollowsAuthenticatedRedirectOnlyForSameOriginMatchingOwner() async throws {
        let redirectURL = URL(string: "https://ticketground.test/api/users/server-user-42/tickets")!
        let client = authenticatedRedirectClient(to: redirectURL)

        _ = try await client.data(for: authenticatedSessionRequest())
        let requests = RedirectingLiveAPIURLProtocol.capturedRequests()

        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(requests.last?.url, redirectURL)
        XCTAssertEqual(requests.last?.value(forHTTPHeaderField: "Authorization"), "Bearer native-credential")
    }

    func testLiveAPIClientRejectsSameOriginRedirectToAnotherPathOwner() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "https://ticketground.test/api/users/another-user/session")!
        )
    }

    func testLiveAPIClientDoesNotFollowAuthenticatedRedirectToHTTP() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "http://ticketground.test/api/users/server-user-42/session")!
        )
    }

    func testLiveAPIClientDoesNotFollowAuthenticatedRedirectToAnotherOrigin() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "https://credential-capture.test/api/users/server-user-42/session")!
        )
    }

    func testLiveAPIClientRejectsAuthenticatedRedirectToDifferentPort() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "https://ticketground.test:8443/api/users/server-user-42/session")!
        )
    }

    func testLiveAPIClientRejectsRedirectWithEncodedUserRouteOwnerMismatch() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "https://ticketground.test/api/%75sers/another-user/session")!
        )
    }

    func testLiveAPIClientRejectsRedirectWithMalformedPathOwner() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "https://ticketground.test/api/users/%FF/session")!
        )
    }

    func testLiveAPIClientRejectsRedirectWithQueryOwnerMismatch() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "https://ticketground.test/api/support/threads?userId=another-user")!
        )
    }

    func testLiveAPIClientRejectsRedirectWithMissingQueryOwner() async {
        await assertAuthenticatedRedirectRejected(
            to: URL(string: "https://ticketground.test/api/support/threads?userId")!
        )
    }

    func testLiveAPIClientRejectsCredentialOwnerMismatchBeforeSending() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveAPIURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "server-user-42"))
        LiveAPIURLProtocol.requests = []

        let client = LiveAPIClient(
            baseURL: URL(string: "https://127.0.0.1/")!,
            assetBaseURL: URL(string: "https://127.0.0.1/")!,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await client.data(for: APIRequest(
                method: .get,
                path: "/api/users/another-user/session",
                authentication: .required(userID: "another-user")
            ))
            XCTFail("Expected credential owner mismatch")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .credentialOwnerMismatch)
            XCTAssertTrue(LiveAPIURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testLiveAPIClientRejectsAuthenticatedUserPathOwnerMismatchBeforeSending() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveAPIURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "server-user-42"))
        LiveAPIURLProtocol.requests = []
        LiveAPIURLProtocol.responseData = Data(#"{"ok":true,"data":{"id":"another-user"}}"#.utf8)
        LiveAPIURLProtocol.statusCode = 200

        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await client.data(for: APIRequest(
                path: "/api/users/another-user/session",
                authentication: .required(userID: "server-user-42")
            ))
            XCTFail("Expected authenticated user path owner mismatch")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .credentialOwnerMismatch)
            XCTAssertTrue(LiveAPIURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testLiveAPIClientRequiresStoredCredentialForAuthenticatedRequest() {
        let client = LiveAPIClient(
            baseURL: URL(string: "https://127.0.0.1/")!,
            assetBaseURL: URL(string: "https://127.0.0.1/")!,
            credentialStore: InMemoryCredentialStore()
        )

        XCTAssertThrowsError(try client.urlRequest(for: APIRequest(
            method: .get,
            path: "/api/users/server-user-42/session",
            authentication: .required(userID: "server-user-42")
        ))) { error in
            XCTAssertEqual(error as? APIClientError, .missingCredential)
        }
    }

    func testLiveAPIClientRejectsCallerSuppliedAuthorizationHeader() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveAPIURLProtocol.self]
        LiveAPIURLProtocol.requests = []

        let client = LiveAPIClient(
            baseURL: URL(string: "http://127.0.0.1:4174/")!,
            assetBaseURL: URL(string: "http://127.0.0.1:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await client.data(for: APIRequest(
                method: .get,
                path: "/api/catalog",
                headers: [APIRequestHeader(name: "Authorization", value: "Bearer injected")]
            ))
            XCTFail("Expected reserved header error")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .reservedRequestHeader("Authorization"))
            XCTAssertTrue(LiveAPIURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testLiveAPIClientRejectsCallerSuppliedProxyAuthorizationHeaderCaseInsensitively() {
        let client = LiveAPIClient(
            baseURL: URL(string: "http://127.0.0.1:4174/")!,
            assetBaseURL: URL(string: "http://127.0.0.1:4173/")!,
            credentialStore: InMemoryCredentialStore()
        )

        for headerName in ["proxy-authorization", "PROXY-AUTHORIZATION"] {
            XCTAssertThrowsError(try client.urlRequest(for: APIRequest(
                method: .get,
                path: "/api/catalog",
                headers: [APIRequestHeader(name: headerName, value: "Bearer injected")]
            ))) { error in
                XCTAssertEqual(error as? APIClientError, .reservedRequestHeader(headerName))
            }
        }
    }

    private func authenticatedRedirectClient(to redirectURL: URL) -> LiveAPIClient {
        RedirectingLiveAPIURLProtocol.reset(redirectURL: redirectURL)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [RedirectingLiveAPIURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "server-user-42"))
        return LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )
    }

    private func accountCapabilityMap(state: LiveCapabilityState) -> LiveCapabilityMap {
        LiveCapabilityMap(
            diagnostics: LiveAPIContractDiagnostics(
                expectedResponseVersion: "expected",
                observedResponseVersion: "expected"
            ),
            baseURL: URL(string: "https://ticketground.test/")!,
            states: [
                .session: state,
                .tickets: state,
                .watchlist: state,
                .supportThreads: state
            ]
        )
    }

    private func authenticatedSessionRequest() -> APIRequest {
        APIRequest(
            path: "/api/users/server-user-42/session",
            authentication: .required(userID: "server-user-42")
        )
    }

    private func assertAuthenticatedRedirectRejected(
        to redirectURL: URL,
        file: StaticString = #filePath,
        line: UInt = #line
    ) async {
        let client = authenticatedRedirectClient(to: redirectURL)
        do {
            _ = try await client.data(for: authenticatedSessionRequest())
            XCTFail("Expected authenticated redirect to be rejected", file: file, line: line)
        } catch let error as APIClientError {
            guard case .server(let status, _, _) = error else {
                XCTFail("Unexpected API error: \(error)", file: file, line: line)
                return
            }
            XCTAssertEqual(status, 307, file: file, line: line)
        } catch {
            XCTFail("Unexpected error: \(error)", file: file, line: line)
        }

        let requests = RedirectingLiveAPIURLProtocol.capturedRequests()
        XCTAssertEqual(requests.count, 1, file: file, line: line)
        XCTAssertEqual(
            requests.first?.value(forHTTPHeaderField: "Authorization"),
            "Bearer native-credential",
            file: file,
            line: line
        )
    }
}

private final class FailingLiveAPIURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        client?.urlProtocol(self, didFailWithError: URLError(.timedOut))
    }

    override func stopLoading() {}
}
