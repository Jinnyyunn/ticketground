import XCTest
@testable import TicketGroundApp

final class TicketGroundAppTests: XCTestCase {
    func testAppTargetLoads() {
        XCTAssertTrue(String(describing: ContentView.self).contains("ContentView"))
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
    private(set) var requests: [APIRequest] = []
    private(set) var revokedSessions: [NativeSession] = []

    init(baseURL: URL, response: Data) {
        self.baseURL = baseURL
        self.response = response
    }

    func data(for request: APIRequest) async throws -> Data {
        requests.append(request)
        return response
    }

    func resolveResource(_ reference: String?) -> String? { reference }

    func revokeNativeSession(_ session: NativeSession) async throws {
        revokedSessions.append(session)
    }
}
