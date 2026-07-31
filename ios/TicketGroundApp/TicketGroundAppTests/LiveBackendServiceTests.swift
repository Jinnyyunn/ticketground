import Foundation
import XCTest
@testable import TicketGroundApp

private final class LiveBackendServiceURLProtocol: URLProtocol {
    static var responses: [String: Data] = [:]
    static var statusCodes: [String: Int] = [:]
    static var errors: [String: URLError.Code] = [:]
    static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        let key = request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") } ?? ""
        if let errorCode = Self.errors[key] {
            client?.urlProtocol(self, didFailWithError: URLError(errorCode))
            return
        }
        let data = Self.responses[key]
            ?? Self.responses["*"]
            ?? Data(#"{"ok":false,"error":{"code":"MISSING_FIXTURE","message":"Missing test fixture"}}"#.utf8)
        let statusCode = Self.statusCodes[key] ?? 200
        guard let response = HTTPURLResponse(
            url: request.url ?? URL(string: "http://ticketground.test")!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        ) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class LiveBackendServiceTests: XCTestCase {
    override func setUp() {
        super.setUp()
        LiveBackendServiceURLProtocol.responses = [:]
        LiveBackendServiceURLProtocol.statusCodes = [:]
        LiveBackendServiceURLProtocol.errors = [:]
        LiveBackendServiceURLProtocol.requests = []
    }

    func testExplicitlyCompatibleContractDispatchesTypedPublicReads() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/state": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE","sale":{"state":"ON_SALE","label":"예매 가능","bookable":true}}],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":1,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8),
            "/api/catalog": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":"2026-09-19T19:00:00+09:00","period":"2026.09.19","image":null,"pinnedRank":1,"soldCount":4,"sale":{"state":"ON_SALE","label":"예매 가능","note":"공식 판매"}}]}}"#.utf8),
            "/api/seat-map?eventId=event-1&performanceDateId=date-1": Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[{"id":"zone-vip","name":"VIP","price":99000,"available":2}],"seats":[{"id":"seat-1","label":"A-01","displayCode":"A-01","zoneId":"zone-vip","zoneName":"VIP","price":99000,"status":"ON_SALE","available":true}]}}"#.utf8),
            "/api/users/user-1/session": Data(#"{"ok":true,"data":{"id":"user-1","name":"Tester","status":"ACTIVE","trustScore":90}}"#.utf8),
            "/api/users/user-1/tickets": Data(#"{"ok":true,"data":[{"id":"ticket-1","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-vip","seatLabel":"A-01","status":"OWNED","available":false,"faceValue":99000,"minPrice":49500,"maxPrice":106920,"transferCount":0,"maxTransferCount":1,"issuedAt":"2026-09-19T19:00:00+09:00","virtualQr":{"type":"virtual","issuedAt":"2026-09-19T18:00:00+09:00"}}]}"#.utf8),
            "/api/users/user-1/watchlist": Data(#"{"ok":true,"data":[{"id":"watch-1","eventId":"event-1","channels":["APP_PUSH"],"calendarEnabled":true,"notificationEnabled":true,"event":{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE"},"notificationJobs":[{"id":"job-1","type":"BOOKING_D3","title":"예매 오픈 D-3 알림","status":"SCHEDULED","scheduledAt":"2026-08-19T19:00:00+09:00"}]}]}"#.utf8),
            "/api/support/threads?userId=user-1": Data(#"{"ok":true,"data":[{"id":"thread-1","userId":"user-1","subject":"문의","status":"OPEN","updatedAt":"2026-07-15T00:00:00Z","messages":[{"id":"message-1","actorId":"user-1","role":"CUSTOMER","body":"도와주세요","at":"2026-07-15T00:00:00Z"}]}]}"#.utf8)
        ]

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "user-1"))
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )
        let service = compatibleService(for: client, authenticatedReads: true)

        let state = try await service.getState()
        let catalog = try await service.getCatalog()
        let seatMap = try await service.getSeatMap(eventID: "event-1", performanceDateID: "date-1")
        let session = try await service.getSession(userID: "user-1")
        let tickets = try await service.getTickets(userID: "user-1")
        let watchlist = try await service.getWatchlist(userID: "user-1")
        let threads = try await service.getSupportThreads(userID: "user-1")

        XCTAssertEqual(state.events.first?.title, "Neon Stage")
        XCTAssertEqual(catalog.events.first?.slug, "neon-stage")
        XCTAssertEqual(seatMap.seats.first?.displayCode, "A-01")
        XCTAssertEqual(session.name, "Tester")
        XCTAssertEqual(tickets.first?.virtualQR?.type, "virtual")
        XCTAssertEqual(watchlist.first?.event?.title, "Neon Stage")
        XCTAssertEqual(watchlist.first?.notificationJobs.first?.status, "SCHEDULED")
        XCTAssertEqual(threads.first?.messages.first?.role, .customer)

        let requestPaths: Set<String> = Set(LiveBackendServiceURLProtocol.requests.compactMap { request in
            guard let url = request.url else { return nil }
            return url.path + (url.query.map { "?\($0)" } ?? "")
        })
        XCTAssertEqual(requestPaths, Set(LiveBackendServiceURLProtocol.responses.keys))
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy { $0.httpMethod == "GET" })
        let publicPaths: Set<String> = ["/api/state", "/api/catalog", "/api/seat-map"]
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy { request in
            guard let path = request.url?.path else { return false }
            let authorization = request.value(forHTTPHeaderField: "Authorization")
            return publicPaths.contains(path)
                ? authorization == nil
                : authorization == "Bearer native-credential"
        })
    }

    func testDiscoveryEndpointsDecodeVersionedPublicResponses() async throws {
        let event = #"{"id":"event-1","slug":"neon-stage","title":"Neon Stage","venue":"Arena","soldCount":4}"#
        LiveBackendServiceURLProtocol.responses = [
            "/api/discovery/v1/regions": Data(#"{"ok":true,"data":{"version":"1","regions":[{"slug":"seoul","name":"서울","eventCount":1,"events":[\#(event)]}]}}"#.utf8),
            "/api/discovery/v1/artists/iu": Data(#"{"ok":true,"data":{"version":"1","artist":{"slug":"iu","name":"IU"},"events":[\#(event)]}}"#.utf8),
            "/api/discovery/v1/open-calendar": Data(#"{"ok":true,"data":{"version":"1","entries":[{"opensAt":"2026-08-20T10:00:00.000Z","saleState":"OPEN_SOON","event":\#(event)}]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = compatibleService(for: client)

        let regions = try await service.getRegions()
        let artist = try await service.getArtist(slug: "iu")
        let calendar = try await service.getOpenCalendar()

        XCTAssertEqual(regions.version, "1")
        XCTAssertEqual(regions.regions.first?.slug, "seoul")
        XCTAssertEqual(artist.artist.name, "IU")
        XCTAssertEqual(calendar.entries.first?.event.slug, "neon-stage")
        XCTAssertEqual(
            Set(LiveBackendServiceURLProtocol.requests.compactMap(\.url?.path)),
            Set(LiveBackendServiceURLProtocol.responses.keys)
        )
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == nil
        })
    }

    func testDiscoveryEndpointRejectsUnexpectedContractVersion() async {
        LiveBackendServiceURLProtocol.responses["/api/discovery/v1/regions"] =
            Data(#"{"ok":true,"data":{"version":"2","regions":[]}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await compatibleService(for: client).getRegions()
            XCTFail("Expected discovery contract mismatch")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testSurfacesBackendErrorAsAPIClientError() async {
        LiveBackendServiceURLProtocol.responses["/api/state"] = Data(#"{"ok":false,"error":{"code":"BACKEND_DOWN","message":"Backend unavailable"}}"#.utf8)

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await compatibleService(for: client).getState()
            XCTFail("Expected backend error")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .server(status: 200, code: "BACKEND_DOWN", message: "Backend unavailable"))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testRejectsInvalidJSONEnvelope() async {
        LiveBackendServiceURLProtocol.responses["/api/state"] = Data("{".utf8)

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await compatibleService(for: client).getState()
            XCTFail("Expected invalid response")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testMapsUnauthorizedResponseWithBackendEnvelope() async {
        LiveBackendServiceURLProtocol.responses["/api/state"] = Data(#"{"ok":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}"#.utf8)
        LiveBackendServiceURLProtocol.statusCodes["/api/state"] = 401

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await compatibleService(for: client).getState()
            XCTFail("Expected unauthorized response")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .server(status: 401, code: "UNAUTHORIZED", message: "Authentication required"))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testMapsForbiddenResponseWithBackendEnvelope() async {
        LiveBackendServiceURLProtocol.responses["/api/state"] = Data(#"{"ok":false,"error":{"code":"FORBIDDEN","message":"Access denied"}}"#.utf8)
        LiveBackendServiceURLProtocol.statusCodes["/api/state"] = 403

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await compatibleService(for: client).getState()
            XCTFail("Expected forbidden response")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .server(status: 403, code: "FORBIDDEN", message: "Access denied"))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testEncodesAuthenticatedUserIDAsOnePathSegment() async throws {
        let userID = "server/user 한"
        LiveBackendServiceURLProtocol.responses["*"] = Data(#"{"ok":true,"data":{"id":"server/user 한","name":"Tester","status":"ACTIVE","trustScore":90}}"#.utf8)

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: userID))
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )

        _ = try await compatibleService(for: client, authenticatedReads: true).getSession(userID: userID)
        let request = try XCTUnwrap(LiveBackendServiceURLProtocol.requests.first)
        let components = try XCTUnwrap(request.url.flatMap {
            URLComponents(url: $0, resolvingAgainstBaseURL: false)
        })

        XCTAssertEqual(components.percentEncodedPath, "/api/users/server%2Fuser%20%ED%95%9C/session")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer native-credential")
    }

    func testDecodesUnknownSupportStatusAndRoleAsUnknown() throws {
        let data = Data(#"{"id":"thread-1","userId":"user-1","subject":"문의","status":"ESCALATED","updatedAt":"2026-07-15T00:00:00Z","messages":[{"id":"message-1","actorId":"moderator-1","role":"MODERATOR","body":"확인 중입니다","at":"2026-07-15T00:00:00Z"}]}"#.utf8)

        let thread = try JSONDecoder().decode(LiveSupportThread.self, from: data)

        XCTAssertEqual(thread.status, .unknown)
        XCTAssertEqual(thread.messages.first?.role, .unknown)
    }

    func testPublicHTTPReadSendsNoAuthorizationAndExcludesAdminPort() async throws {
        LiveBackendServiceURLProtocol.responses["/api/state"] = Data(#"{"ok":true,"data":{"events":[],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":0,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8)

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://132.145.109.87:4174/")!,
            assetBaseURL: URL(string: "http://132.145.109.87:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        _ = try await compatibleService(for: client).getState()

        let request = try XCTUnwrap(LiveBackendServiceURLProtocol.requests.first)
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        XCTAssertEqual(request.url?.scheme, "http")
        XCTAssertFalse(LiveAPIContract.deployed.publicHost.absoluteString.contains("50084"))
        XCTAssertTrue(LiveAPIEndpoint.known.allSatisfy { !$0.pathTemplate.contains("50084") })
    }

    func testCapabilityMapRejectsUnknownOrIncompatibleContractState() {
        let unknown = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "http://132.145.109.87:4174/")!,
            observedResponseVersion: nil
        )
        XCTAssertEqual(unknown.diagnostics.compatibility, .unknown)
        XCTAssertEqual(unknown.state(for: .state), .unknown)
        XCTAssertEqual(
            unknown.state(for: .unknown(method: .get, path: "/api/unknown")),
            .unknown
        )

        let incompatible = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "http://132.145.109.87:4174/")!,
            observedResponseVersion: "future-contract"
        )
        XCTAssertEqual(
            incompatible.diagnostics.compatibility,
            .incompatible(expected: LiveAPIContract.deployed.expectedResponseVersion, observed: "future-contract")
        )
        XCTAssertEqual(
            incompatible.state(for: .catalog),
            .incompatible(expected: LiveAPIContract.deployed.expectedResponseVersion, observed: "future-contract")
        )

        let legacy = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "http://132.145.109.87:4174/")!,
            observedResponseVersion: "78b3c7c",
            catalogRouteConfirmed: true
        )
        XCTAssertEqual(legacy.diagnostics.compatibility, .compatible)
        XCTAssertEqual(legacy.state(for: .catalog), .available)
        XCTAssertEqual(legacy.state(for: .regions), .unknown)

        let discoveryConfirmed = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "http://132.145.109.87:4174/")!,
            observedResponseVersion: "78b3c7c",
            catalogRouteConfirmed: true,
            discoveryRoutesConfirmed: true
        )
        XCTAssertEqual(discoveryConfirmed.state(for: .regions), .available)
        XCTAssertEqual(discoveryConfirmed.state(for: .artist), .available)
        XCTAssertEqual(discoveryConfirmed.state(for: .openCalendar), .available)
    }

    func testCapabilityMapRequiresExplicitCatalogRouteConfirmation() {
        let map = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "http://132.145.109.87:4174/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion
        )

        XCTAssertEqual(map.state(for: .catalog), .unknown)
    }

    func testCapabilityMapBlocksAuthenticatedReadsUntilServerAuthorizationIsAttested() {
        let map = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            catalogRouteConfirmed: true
        )

        XCTAssertEqual(map.state(for: .session), .blocked(.serverAuthorizationUnverified))
        XCTAssertEqual(map.state(for: .tickets), .blocked(.serverAuthorizationUnverified))
        XCTAssertEqual(map.state(for: .watchlist), .blocked(.serverAuthorizationUnverified))
        XCTAssertEqual(map.state(for: .supportThreads), .blocked(.serverAuthorizationUnverified))
    }

    func testCatalogAdmissionUsesHealthThenBoundedCatalogProbe() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":null,"period":null,"image":null,"pinnedRank":1,"soldCount":4,"sale":null}]}}"#.utf8),
            "/api/discovery/v1/contract": Data(#"{"ok":true,"data":{"version":"1","endpoints":["regions","artists","open-calendar","venues"]}}"#.utf8),
            "/api/catalog": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":null,"period":null,"image":null,"pinnedRank":1,"soldCount":4,"sale":null}]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let service = LiveBackendService(apiClient: client)
        let catalog = try await service.getCatalog()

        XCTAssertEqual(catalog.events.map(\.id), ["event-1"])
        XCTAssertEqual(service.capabilityMap.state(for: .regions), .available)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            ["/api/health", "/api/catalog?limit=1", "/api/discovery/v1/contract", "/api/catalog"]
        )
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == nil
        })
    }

    func testLiveHomeLoadsHealthyCatalogWithoutDependingOnState() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/catalog": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":"2026-09-19","period":null,"image":null,"pinnedRank":1,"soldCount":4,"sale":{"state":"ON_SALE","label":"예매 가능","note":"공식 판매"}}]}}"#.utf8)
        ]
        LiveBackendServiceURLProtocol.errors["/api/state"] = .timedOut
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let result = try await DiscoveryFixtureLoader.loadLive(using: client)

        guard case .catalog(let content) = result else {
            return XCTFail("Expected healthy catalog content")
        }
        XCTAssertEqual(content.featured.title, "Neon Stage")
        XCTAssertEqual(content.featured.date, "2026.09.19")
        XCTAssertEqual(content.featured.cta, "공연 상세 보기")
        XCTAssertEqual(content.rankings.first?.date, "2026.09.19")
        XCTAssertTrue(content.openingSoon.isEmpty)
        XCTAssertTrue(content.calendar.isEmpty)
        XCTAssertEqual(content.shortcuts.first { $0.label == "대학로" }?.route, .place(slug: "대학로"))
        XCTAssertEqual(content.shortcuts.first { $0.label == "VIP석" }?.route, .genre(name: "vip"))
        XCTAssertTrue(Set(content.shortcuts.map(\.label)).isDisjoint(with: ["당일 공연", "지방 공연", "양도", "오픈캘린더"]))
        XCTAssertTrue(Set(content.categories.map(\.label)).isDisjoint(with: ["티켓 양도", "캘린더"]))
        XCTAssertFalse(LiveBackendServiceURLProtocol.requests.contains { $0.url?.path == "/api/state" })
    }

    func testCatalogAdmissionRejectsIncompatibleHealthWithoutCatalogDispatch() async {
        LiveBackendServiceURLProtocol.responses["/api/health"] = Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"future-contract"}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await LiveBackendService(apiClient: client).getCatalog()
            XCTFail("Expected incompatible catalog capability")
        } catch let error as APIClientError {
            XCTAssertEqual(
                error,
                .capabilityUnavailable(
                    endpoint: .catalog,
                    state: .incompatible(expected: LiveAPIContract.deployed.expectedResponseVersion, observed: "future-contract")
                )
            )
            XCTAssertEqual(LiveBackendServiceURLProtocol.requests.compactMap { $0.url?.path }, ["/api/health"])
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testCatalogAdmissionRejectsMalformedProbe() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data("{".utf8)
        ]
        let service = LiveBackendService(apiClient: client)

        do {
            _ = try await service.getCatalog()
            XCTFail("Expected catalog admission rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
            XCTAssertEqual(service.capabilityMap.state(for: .catalog), .unknown)
            XCTAssertEqual(
                LiveBackendServiceURLProtocol.requests.compactMap { request in
                    request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
                },
                ["/api/health", "/api/catalog?limit=1"]
            )
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testCatalogAdmissionAcceptsEmptyProbeAndReturnsEmptyCatalog() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/catalog": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let service = LiveBackendService(apiClient: client)
        let catalog = try await service.getCatalog()

        XCTAssertTrue(catalog.events.isEmpty)
        XCTAssertEqual(service.capabilityMap.state(for: .catalog), .available)
        XCTAssertEqual(service.capabilityMap.state(for: .regions), .unknown)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            ["/api/health", "/api/catalog?limit=1", "/api/discovery/v1/contract", "/api/catalog"]
        )
    }

    func testCatalogAdmissionRejectsHealthTimeoutWithoutCatalogDispatch() async {
        LiveBackendServiceURLProtocol.errors["/api/health"] = .timedOut
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        do {
            _ = try await service.getCatalog()
            XCTFail("Expected health timeout")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .requestFailed(code: URLError.timedOut.rawValue))
            XCTAssertEqual(service.capabilityMap.state(for: .catalog), .unknown)
            XCTAssertEqual(
                LiveBackendServiceURLProtocol.requests.compactMap { request in
                    request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
                },
                ["/api/health"]
            )
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testDecodesCatalogPaginationAndSeatMapMetadata() throws {
        let catalog = try JSONDecoder().decode(
            LiveCatalog.self,
            from: Data(#"{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","shortTitle":"Neon","venueId":"venue-1","venue":"Arena","date":"2026-09-19T19:00:00+09:00","dates":[{"id":"show-1","label":"1회차","startsAt":"2026-09-19T19:00:00+09:00"}],"schedules":[{"label":"토요일","date":"2026-09-19","times":["19:00"]}],"period":"2026.09.19","runtime":"120분","ageLimit":"8세 이상","image":null,"badge":"추천","artistSlug":"neon","summary":"공연 소개","casts":["A"],"notices":["안내"],"prices":[{"grade":"VIP","seat":"A","price":99000}],"saleState":"ON_SALE","saleNote":"공식 판매","pinnedRank":1,"soldCount":4,"sale":null}],"venues":[{"id":"venue-1","name":"Arena","address":"Seoul","mapType":"svg","imageUrl":null}],"nextCursor":"1","total":2}"#.utf8)
        )
        let seatMap = try JSONDecoder().decode(
            LiveSeatMap.self,
            from: Data(#"{"category":"concert","date":"2026-09-19T19:00:00+09:00","event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"id":"arena-map","venue":"Arena","title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[{"id":"vip","name":"VIP","price":99000,"available":2}],"seats":[{"id":"seat-1","label":"A-01","displayCode":"A-01","zoneId":"vip","zoneName":"VIP","price":99000,"status":"ON_SALE","available":true,"mapPosition":{"x":50,"y":52,"width":5.4,"height":7.2,"rotate":90,"shape":"actual-map"}}]}"#.utf8)
        )

        XCTAssertEqual(catalog.nextCursor, "1")
        XCTAssertEqual(catalog.total, 2)
        XCTAssertEqual(catalog.venues?.first?.imageURL, nil)
        XCTAssertEqual(catalog.events.first?.dates?.first?.startsAt, "2026-09-19T19:00:00+09:00")
        XCTAssertEqual(catalog.events.first?.schedules?.first?.times, ["19:00"])
        XCTAssertEqual(catalog.events.first?.prices?.first?.price, 99000)
        XCTAssertEqual(seatMap.map.id, "arena-map")
        XCTAssertEqual(seatMap.seats.first?.mapPosition?.shape, "actual-map")
    }

    func testDecodesEventVenueSeatMapRoute() async throws {
        LiveBackendServiceURLProtocol.responses["/api/events/event-1/seat-map"] = Data(#"{"ok":true,"data":{"eventId":"event-1","venueId":"venue-1","venue":"Arena","address":"Seoul","type":"svg","imageUrl":"/assets/map.svg","imageSource":"venue-map","stage":"STAGE","helper":"좌석 안내","labels":[{"text":"VIP","x":50,"y":38}],"seats":[{"zoneId":"vip","seatLabel":"VIP-01","number":1,"x":34,"y":58,"section":"VIP"}]}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = compatibleService(for: client)

        let map = try await service.getVenueSeatMap(eventID: "event-1")

        XCTAssertEqual(map.eventID, "event-1")
        XCTAssertEqual(map.imageURL, "/assets/map.svg")
        XCTAssertEqual(map.labels?.first?.text, "VIP")
        XCTAssertEqual(map.seats.first?.seatLabel, "VIP-01")
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests.compactMap { $0.url?.path }, ["/api/events/event-1/seat-map"])
    }

    func testPlaceRouteMatchesCatalogVenueIdentifier() throws {
        let catalog = try JSONDecoder().decode(
            LiveCatalog.self,
            from: Data(#"{"events":[{"id":"event-1","slug":"neon-stage","title":"Neon Stage","venueId":"venue-1","venue":"Arena","soldCount":4},{"id":"venue-1-preview","slug":"venue-1-preview","title":"Venue 1 Preview","venueId":"venue-2","venue":"Hall","soldCount":1}],"venues":[{"id":"venue-1","name":"Arena"},{"id":"venue-2","name":"Hall"}]}"#.utf8)
        )

        let events = LiveCatalogRouteMatcher.placeEvents(slug: "venue-1", in: catalog)

        XCTAssertEqual(events.map(\.id), ["event-1"])
    }

    func testDetailRoutePrefersExactIdentifierOverTitleFallback() throws {
        let catalog = try JSONDecoder().decode(
            LiveCatalog.self,
            from: Data(#"{"events":[{"id":"earlier-event","slug":"earlier-event","title":"target-event","venue":"Hall","soldCount":4},{"id":"target-event","slug":"target-event","title":"Actual Target","venue":"Arena","soldCount":1}]}"#.utf8)
        )

        XCTAssertEqual(
            LiveCatalogRouteMatcher.detailEvents(slug: "target-event", in: catalog).map(\.id),
            ["target-event"]
        )
    }

    func testPlaceRouteMatchesDaehakroVenueName() throws {
        let catalog = try JSONDecoder().decode(
            LiveCatalog.self,
            from: Data(#"{"events":[{"id":"daehakro","title":"소극장 신작","venue":"대학로 자유극장","soldCount":4},{"id":"other-musical","title":"대형 뮤지컬","venue":"LG아트센터","soldCount":8}]}"#.utf8)
        )

        XCTAssertEqual(
            LiveCatalogRouteMatcher.placeEvents(slug: "대학로", in: catalog).map(\.id),
            ["daehakro"]
        )
    }

    func testSearchMatchesCastAndArtistSlug() throws {
        let catalog = try JSONDecoder().decode(
            LiveCatalog.self,
            from: Data(#"{"events":[{"id":"event-1","slug":"elizabeth","title":"엘리자벳","venue":"블루스퀘어","artistSlug":"ok-joo-hyun","casts":["옥주현"],"soldCount":4}]}"#.utf8)
        )
        let event = try XCTUnwrap(catalog.events.first)

        XCTAssertTrue(LiveCatalogRouteMatcher.matchesSearch(query: "옥주현", event: event))
        XCTAssertTrue(LiveCatalogRouteMatcher.matchesSearch(query: "ok-joo-hyun", event: event))
        XCTAssertFalse(LiveCatalogRouteMatcher.matchesSearch(query: "다른 배우", event: event))
    }

    func testPriceGradeMatcherExcludesNonVIPCatalogEvents() throws {
        let catalog = try JSONDecoder().decode(
            LiveCatalog.self,
            from: Data(#"{"events":[{"id":"vip-event","title":"VIP Concert","venue":"Arena","prices":[{"grade":"VIP","seat":"VIP석","price":190000}],"soldCount":4},{"id":"pass-event","title":"Standing Festival","venue":"Park","prices":[{"grade":"PASS","seat":"일반 입장","price":99000}],"soldCount":2}]}"#.utf8)
        )

        XCTAssertTrue(LiveCatalogRouteMatcher.hasPriceGrade("vip", event: catalog.events[0]))
        XCTAssertFalse(LiveCatalogRouteMatcher.hasPriceGrade("vip", event: catalog.events[1]))
    }

    func testAccountStatusTextDoesNotExposeBackendUserIdentifier() {
        let session = LiveSession(
            id: "server-user-42",
            name: "민서",
            status: "ACTIVE",
            trustScore: 92
        )

        let statusText = LiveAccountDisplay.statusText(for: session)

        XCTAssertEqual(statusText, "계정 상태 ACTIVE")
        XCTAssertFalse(statusText.contains(session.id))
    }

    func testRejectsInvalidCatalogIdentityAndMalformedSeatMap() {
        XCTAssertThrowsError(
            try JSONDecoder().decode(
                LiveCatalog.self,
                from: Data(#"{"events":[{"slug":"missing-id","title":"Broken","venue":"Arena","soldCount":0}]}"#.utf8)
            )
        )
        XCTAssertNoThrow(
            try JSONDecoder().decode(
                LiveCatalog.self,
                from: Data(#"{"events":[]}"#.utf8)
            )
        )
        XCTAssertNoThrow(
            try JSONDecoder().decode(
                LiveCatalog.self,
                from: Data(#"{"events":[{"id":"event-1","title":"Unknown sale","venue":"Arena","soldCount":0,"saleState":"FUTURE_STATE"}]}"#.utf8)
            )
        )
        XCTAssertThrowsError(
            try JSONDecoder().decode(
                LiveSeatMap.self,
                from: Data(#"{"event":{"id":"event-1","title":"Broken","venueId":"venue-1","venue":"Arena"},"map":{"title":"Map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[{"id":"seat-1","label":"A-01","displayCode":"A-01","zoneId":"vip","zoneName":"VIP","price":99000,"status":"ON_SALE"}]}"#.utf8)
            )
        )
    }

    func testIncompatibleValidatedStateDoesNotReopenStateCapability() {
        let map = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "http://132.145.109.87:4174/")!,
            observedResponseVersion: "future-contract",
            validatedStateResponse: true,
            catalogRouteConfirmed: false
        )

        XCTAssertEqual(
            map.state(for: .state),
            .incompatible(expected: LiveAPIContract.deployed.expectedResponseVersion, observed: "future-contract")
        )
    }

    func testMutationContractMatchesDeployedRouterPaths() {
        XCTAssertEqual(LiveAPIEndpoint.supportMessages.method, .post)
        XCTAssertEqual(LiveAPIEndpoint.supportMessages.pathTemplate, "/api/support/messages")
        XCTAssertEqual(LiveAPIEndpoint.watchlistMutation.method, .post)
        XCTAssertEqual(LiveAPIEndpoint.watchlistMutation.pathTemplate, "/api/watchlist")
        XCTAssertEqual(LiveAPIEndpoint.ticketPurchase.method, .post)
        XCTAssertEqual(LiveAPIEndpoint.ticketPurchase.pathTemplate, "/api/tickets/buy")
    }

    func testAuthenticatedActionSendsOwnerBoundJSONAndIdempotencyKeyOverHTTPS() async throws {
        LiveBackendServiceURLProtocol.responses["/api/watchlist"] = Data(#"{"ok":true,"data":{"watchlist":{"id":"watch-1","userId":"user-1","eventId":"event-1"}}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "user-1"))
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: nil,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )

        let action = LiveAuthenticatedAction.watchlist(
            userID: "user-1",
            eventID: "event-1",
            idempotencyKey: "watchlist-1"
        )
        let emitted = try client.urlRequest(for: action.request())
        let emittedBody = try XCTUnwrap(emitted.httpBody.flatMap {
            try? JSONSerialization.jsonObject(with: $0) as? [String: Any]
        })
        let receipt = try await mutationReadyService(for: client).perform(action)
        let request = try XCTUnwrap(LiveBackendServiceURLProtocol.requests.first)

        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.url?.path, "/api/watchlist")
        XCTAssertEqual(emittedBody["eventId"] as? String, "event-1")
        XCTAssertEqual(emittedBody["userId"] as? String, "user-1")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer native-credential")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Idempotency-Key"), "watchlist-1")
        XCTAssertEqual(receipt.payload, .object(["watchlist": .object([
            "id": .string("watch-1"),
            "userId": .string("user-1"),
            "eventId": .string("event-1")
        ])]))
    }

    func testAuthenticatedActionRejectsMissingIdentityAndHTTPBeforeDispatch() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let action = LiveAuthenticatedAction.ticketPurchase(
            userID: "user-1",
            ticketID: "ticket-1",
            idempotencyKey: "purchase-1"
        )
        let secureClient = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: nil,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await mutationReadyService(for: secureClient).perform(action)
            XCTFail("Expected missing paired credential")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .missingCredential)
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }

        let insecureClient = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: nil,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        do {
            _ = try await mutationReadyService(for: insecureClient).perform(action)
            XCTFail("Expected HTTPS capability denial")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .insecureCredentialTransport)
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testAuthenticatedActionSurfacesMutationStatusErrorsAndRejectsEmptyInput() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "user-1"))
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: nil,
            credentialStore: credentials,
            session: URLSession(configuration: configuration)
        )

        for status in [401, 403, 409, 422, 429] {
            let code = "ACTION_\(status)"
            let message = "Mutation rejected: \(status)"
            LiveBackendServiceURLProtocol.responses["/api/support/messages"] = Data(#"{"ok":false,"error":{"code":"\#(code)","message":"\#(message)"}}"#.utf8)
            LiveBackendServiceURLProtocol.statusCodes["/api/support/messages"] = status

            do {
                _ = try await mutationReadyService(for: client).perform(.supportMessage(
                    userID: "user-1",
                    threadID: "thread-1",
                    message: "문의 내용",
                    idempotencyKey: "message-\(status)"
                ))
                XCTFail("Expected backend status error \(status)")
            } catch let error as APIClientError {
                XCTAssertEqual(error, .server(status: status, code: code, message: message))
            } catch {
                XCTFail("Unexpected error: \(error)")
            }
        }

        XCTAssertThrowsError(try LiveAuthenticatedAction.watchlist(
            userID: "user-1",
            eventID: "",
            idempotencyKey: "watchlist-2"
        ).request()) { error in
            XCTAssertEqual(error as? APIClientError, .invalidResponse)
        }
    }

    func testAuthenticatedActionDefinitionsMatchDocumentedPathsAndOwners() throws {
        let actions: [(LiveAuthenticatedAction, String, String)] = [
            (.supportThread(userID: "user-1", message: "문의", idempotencyKey: "thread"), "/api/support/threads", "userId"),
            (.supportMessage(userID: "user-1", threadID: "thread-1", message: "답변", idempotencyKey: "message"), "/api/support/messages", "actorId"),
            (.watchlist(userID: "user-1", eventID: "event-1", idempotencyKey: "watch"), "/api/watchlist", "userId"),
            (.watchlistNotification(userID: "user-1", eventID: "event-1", idempotencyKey: "notify"), "/api/watchlist/notify", "userId"),
            (.ticketPurchase(userID: "user-1", ticketID: "ticket-1", idempotencyKey: "purchase"), "/api/tickets/buy", "userId"),
            (.identityStart(userID: "user-1", phone: "01012345678", idempotencyKey: "identity-start"), "/api/identity/portone-danal/start", "userId"),
            (.identityConfirm(userID: "user-1", phone: "01012345678", verificationID: "identity-1", idempotencyKey: "identity-confirm"), "/api/identity/portone-danal/confirm", "userId"),
            (.trustDevice(userID: "user-1", deviceID: "device-1", attestation: "attestation", idempotencyKey: "trust"), "/api/devices/trust", "userId"),
            (.pushToken(userID: "user-1", token: "push-token", idempotencyKey: "push"), "/api/devices/push-token", "userId"),
            (.admissionQR(userID: "user-1", ticketID: "ticket-1", deviceID: "device-1", attestation: "attestation", idempotencyKey: "qr"), "/api/tickets/qr", "userId"),
            (.virtualQR(userID: "user-1", ticketID: "ticket-1", idempotencyKey: "virtual-qr"), "/api/tickets/virtual-qr", "userId")
        ]

        for (action, path, ownerField) in actions {
            let request = try action.request()
            let body = try XCTUnwrap(request.body.jsonObject)
            XCTAssertEqual(request.method, .post)
            XCTAssertEqual(request.path, path)
            XCTAssertEqual(request.idempotencyKey?.isEmpty, false)
            XCTAssertEqual(request.authentication, .required(userID: "user-1"))
            XCTAssertEqual(request.ownerBinding, .jsonField(ownerField))
            XCTAssertEqual(body[ownerField] as? String, "user-1")
        }
    }

    func testServiceRejectsUnknownIncompatibleAndBlockedCapabilitiesBeforeDispatch() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://132.145.109.87:4174/")!,
            assetBaseURL: URL(string: "http://132.145.109.87:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let contract = LiveAPIContract.deployed
        let maps = [
            contract.capabilityMap(
                for: URL(string: "http://132.145.109.87:4174/")!,
                observedResponseVersion: nil
            ),
            contract.capabilityMap(
                for: URL(string: "http://132.145.109.87:4174/")!,
                observedResponseVersion: "future-contract"
            )
        ]

        for map in maps {
            LiveBackendServiceURLProtocol.requests = []
            let service = LiveBackendService(apiClient: client, initialCapabilityMap: map)

            do {
                _ = try await service.getState()
                XCTFail("Expected capability dispatch rejection for \(map.state(for: .state))")
            } catch let error as APIClientError {
                XCTAssertEqual(error, .capabilityUnavailable(endpoint: .state, state: map.state(for: .state)))
                XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
            } catch {
                XCTFail("Unexpected error: \(error)")
            }
        }

        let blockedMap = contract.capabilityMap(
            for: URL(string: "http://132.145.109.87:4174/")!,
            observedResponseVersion: contract.expectedResponseVersion
        )
        let blockedService = LiveBackendService(apiClient: client, initialCapabilityMap: blockedMap)
        LiveBackendServiceURLProtocol.requests = []

        do {
            _ = try await blockedService.getSession(userID: "server-user-42")
            XCTFail("Expected HTTPS capability dispatch rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(
                error,
                .capabilityUnavailable(endpoint: .session, state: .blocked(.requiresHTTPS))
            )
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testDefaultLiveCatalogBootstrapFailsClosedWithoutVersionOrRouteProof() async {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":null}}"#.utf8),
            "/api/state": Data(#"{"ok":true,"data":{"events":[],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":0,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://132.145.109.87:4174/")!,
            assetBaseURL: URL(string: "http://132.145.109.87:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let service = LiveBackendService(apiClient: client)
        do {
            _ = try await service.getCatalog()
            XCTFail("Expected versionless contract to remain unknown")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .catalog, state: .unknown))
            XCTAssertEqual(service.capabilityMap.diagnostics.compatibility, .unknown)
            XCTAssertEqual(service.capabilityMap.state(for: .state), .available)
            XCTAssertEqual(service.capabilityMap.state(for: .catalog), .unknown)
            XCTAssertEqual(
                LiveBackendServiceURLProtocol.requests.compactMap { $0.url?.path },
                ["/api/health", "/api/state"]
            )
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testLiveHomeKeepsTypedStateWhenCatalogRouteIsUnconfirmed() async throws {
        LiveBackendServiceURLProtocol.responses["/api/health"] = Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":null}}"#.utf8)
        LiveBackendServiceURLProtocol.responses["/api/state"] = Data(#"{"ok":true,"data":{"events":[{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE","sale":{"state":"ON_SALE","label":"예매 가능","bookable":true}}],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":1,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://132.145.109.87:4174/")!,
            assetBaseURL: URL(string: "http://132.145.109.87:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let home = try await DiscoveryFixtureLoader.loadLive(using: client)

        guard case .stateOnly(let state) = home else {
            return XCTFail("Expected state-only Home when catalog has no route proof")
        }
        XCTAssertEqual(state.events.first?.title, "Neon Stage")
        XCTAssertEqual(state.backendSummary.events, 1)
        XCTAssertEqual(state.ledger.verified, true)
        XCTAssertFalse(
            LiveBackendServiceURLProtocol.requests.contains { $0.url?.path == "/api/catalog" },
            "확인되지 않은 catalog route는 요청하지 않아야 합니다."
        )
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { $0.url?.path },
            ["/api/health", "/api/state"]
        )
    }

    func testLiveHomeSurfacesTransientCatalogFailureAfterSuccessfulAdmission() async {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/state": Data(#"{"ok":true,"data":{"events":[],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":0,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8)
        ]
        LiveBackendServiceURLProtocol.errors["/api/catalog"] = .timedOut
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await DiscoveryFixtureLoader.loadLive(using: client)
            XCTFail("Expected the transient catalog failure to remain retryable")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .requestFailed(code: URLError.timedOut.rawValue))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testDefaultLiveCatalogBootstrapFailureDoesNotDispatchCatalog() async {
        LiveBackendServiceURLProtocol.responses["/api/health"] = Data(#"{"ok":false,"error":{"code":"BOOTSTRAP_DOWN","message":"Bootstrap unavailable"}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://132.145.109.87:4174/")!,
            assetBaseURL: URL(string: "http://132.145.109.87:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await LiveBackendService(apiClient: client).getCatalog()
            XCTFail("Expected bootstrap failure")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .server(status: 200, code: "BOOTSTRAP_DOWN", message: "Bootstrap unavailable"))
            XCTAssertEqual(
                LiveBackendServiceURLProtocol.requests.compactMap { $0.url?.path },
                ["/api/health"]
            )
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testContractProbeKeepsVersionlessStatePublicOnly() async throws {
        LiveBackendServiceURLProtocol.responses["/api/health"] = Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":null}}"#.utf8)
        LiveBackendServiceURLProtocol.responses["/api/state"] = Data(#"{"ok":true,"data":{"events":[],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":0,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8)

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://132.145.109.87:4174/")!,
            assetBaseURL: URL(string: "http://132.145.109.87:4173/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let probe = try await LiveBackendService(apiClient: client).diagnosePublicContract()

        XCTAssertEqual(probe.diagnostics.compatibility, .unknown)
        XCTAssertEqual(probe.capabilities.state(for: .state), .available)
        XCTAssertEqual(probe.capabilities.state(for: .catalog), .unknown)
        XCTAssertEqual(probe.capabilities.state(for: .session), .unknown)
        XCTAssertEqual(probe.capabilities.state(for: .ticketPurchase), .unknown)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.first?.value(forHTTPHeaderField: "Authorization"),
            nil
        )
    }

    private func compatibleService(
        for client: LiveAPIClient,
        authenticatedReads: Bool = false
    ) -> LiveBackendService {
        let map = LiveAPIContract.deployed.capabilityMap(
            for: client.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            catalogRouteConfirmed: true,
            discoveryRoutesConfirmed: true
        )
        let states = authenticatedReads
            ? Dictionary(uniqueKeysWithValues: LiveAPIEndpoint.known.map { endpoint in
                (endpoint, endpoint.access == .authenticatedRead ? .available : map.state(for: endpoint))
            })
            : map.states
        return LiveBackendService(
            apiClient: client,
            initialCapabilityMap: LiveCapabilityMap(
                diagnostics: map.diagnostics,
                baseURL: map.baseURL,
                states: states
            )
        )
    }

    private func mutationReadyService(for client: LiveAPIClient) -> LiveBackendService {
        let compatible = LiveAPIContract.deployed.capabilityMap(
            for: client.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            catalogRouteConfirmed: true
        )
        let states = Dictionary(uniqueKeysWithValues: LiveAPIEndpoint.known.map { endpoint in
            (endpoint, endpoint.access == .mutation ? .available : compatible.state(for: endpoint))
        })
        return LiveBackendService(
            apiClient: client,
            initialCapabilityMap: LiveCapabilityMap(
                diagnostics: compatible.diagnostics,
                baseURL: compatible.baseURL,
                states: states
            )
        )
    }
}

private extension APIRequestBody {
    var jsonObject: [String: Any]? {
        guard case .json(let data) = self else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}
