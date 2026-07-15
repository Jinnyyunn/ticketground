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
        credentials.save("native-credential")
        let session = SessionStore(credentialStore: credentials)
        let container = AppContainer(environment: AppEnvironment(
            mode: .fixture,
            apiClient: FixtureAPIClient(),
            sessionStore: session
        ))
        container.navigationPath = [.goods(slug: "ticketground-day")]

        XCTAssertEqual(session.current, NativeSession(userID: "native", credential: "native-credential"))
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
        credentials.save("native-credential")
        LiveAPIURLProtocol.requests = []
        LiveAPIURLProtocol.responseData = Data(#"{"ok":true,"data":{"total":3}}"#.utf8)
        LiveAPIURLProtocol.statusCode = 200

        let client = LiveAPIClient(
            baseURL: URL(string: "http://127.0.0.1:4174/")!,
            assetBaseURL: URL(string: "http://127.0.0.1:4173/")!,
            credentialStore: credentials,
            session: session
        )

        let response = try await client.data(for: "/api/catalog")
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: response) as? [String: Int])
        let request = try XCTUnwrap(LiveAPIURLProtocol.requests.first)

        XCTAssertEqual(object["total"], 3)
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }
}
