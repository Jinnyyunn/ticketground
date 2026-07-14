import XCTest
@testable import TicketGroundApp

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
}
