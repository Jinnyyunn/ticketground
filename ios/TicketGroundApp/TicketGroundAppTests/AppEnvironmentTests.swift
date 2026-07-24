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

    func testLiveAPIClientDoesNotFollowAuthenticatedRedirectToHTTP() throws {
        let redirectedRequest = try authenticatedRedirectResult(
            to: URL(string: "http://ticketground.test/api/users/server-user-42/session")!
        )

        XCTAssertNil(redirectedRequest)
    }

    func testLiveAPIClientDoesNotFollowAuthenticatedRedirectToAnotherOrigin() throws {
        let redirectedRequest = try authenticatedRedirectResult(
            to: URL(string: "https://credential-capture.test/api/users/server-user-42/session")!
        )

        XCTAssertNil(redirectedRequest)
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

    private func authenticatedRedirectResult(to redirectURL: URL) throws -> URLRequest? {
        var originalRequest = URLRequest(
            url: URL(string: "https://ticketground.test/api/users/server-user-42/session")!
        )
        originalRequest.setValue("Bearer native-credential", forHTTPHeaderField: "Authorization")
        var proposedRequest = originalRequest
        proposedRequest.url = redirectURL

        let session = URLSession(configuration: .ephemeral)
        let task = session.dataTask(with: originalRequest)
        let response = try XCTUnwrap(HTTPURLResponse(
            url: originalRequest.url!,
            statusCode: 307,
            httpVersion: nil,
            headerFields: ["Location": redirectURL.absoluteString]
        ))
        let delegate = AuthenticatedRedirectDelegate(originalRequest: originalRequest)
        var completed = false
        var result: URLRequest?

        delegate.urlSession(
            session,
            task: task,
            willPerformHTTPRedirection: response,
            newRequest: proposedRequest
        ) {
            completed = true
            result = $0
        }

        XCTAssertTrue(completed)
        return result
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
