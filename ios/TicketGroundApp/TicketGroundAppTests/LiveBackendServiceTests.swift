import Foundation
import XCTest
@testable import TicketGroundApp

private final class LiveBackendServiceURLProtocol: URLProtocol {
    static var responses: [String: Data] = [:]
    static var statusCodes: [String: Int] = [:]
    static var errors: [String: URLError.Code] = [:]
    static var requests: [URLRequest] = []
    static var requestBodies: [Data?] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        Self.requestBodies.append(Self.readBody(from: request))
        let key = request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") } ?? ""
        let methodKey = "\(request.httpMethod ?? "GET") \(key)"
        if let errorCode = Self.errors[key] {
            client?.urlProtocol(self, didFailWithError: URLError(errorCode))
            return
        }
        let data = Self.responses[methodKey]
            ?? Self.responses[key]
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

    private static func readBody(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            guard count > 0 else { break }
            data.append(contentsOf: buffer.prefix(count))
        }
        return data
    }
}

final class LiveBackendServiceTests: XCTestCase {
    override func setUp() {
        super.setUp()
        LiveBackendServiceURLProtocol.responses = [:]
        LiveBackendServiceURLProtocol.statusCodes = [:]
        LiveBackendServiceURLProtocol.errors = [:]
        LiveBackendServiceURLProtocol.requests = []
        LiveBackendServiceURLProtocol.requestBodies = []
    }

    func testExplicitlyCompatibleContractDispatchesTypedPublicReads() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/state": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE","sale":{"state":"ON_SALE","label":"예매 가능","bookable":true}}],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":1,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8),
            "/api/catalog?limit=50": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":"2026-09-19T19:00:00+09:00","period":"2026.09.19","image":null,"pinnedRank":1,"soldCount":4,"sale":{"state":"ON_SALE","label":"예매 가능","note":"공식 판매"}}]}}"#.utf8),
            "/api/seat-map?eventId=event-1": Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[{"id":"zone-vip","name":"VIP","price":99000,"available":2}],"seats":[{"id":"seat-1","label":"A-01","displayCode":"A-01","zoneId":"zone-vip","zoneName":"VIP","price":99000,"status":"ON_SALE","available":true}]}}"#.utf8),
            "/api/me": Data(#"{"ok":true,"data":{"id":"user-1","name":"Tester","status":"ACTIVE","trustScore":90}}"#.utf8),
            "/api/me/tickets": Data(#"{"ok":true,"data":[{"id":"ticket-1","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-vip","seatLabel":"A-01","status":"OWNED","available":false,"faceValue":99000,"minPrice":49500,"maxPrice":106920,"transferCount":0,"maxTransferCount":1,"issuedAt":"2026-09-19T19:00:00+09:00","virtualQr":{"type":"virtual","issuedAt":"2026-09-19T18:00:00+09:00"},"event":{"id":"event-1","title":"Neon Stage","venue":"Arena","performance":{"id":"date-1","label":"9월 19일 공연","startsAt":"2026-09-19T19:00:00+09:00"}},"payment":{"amount":105000,"method":"CREDIT_CARD","status":"CAPTURED"}}]}"#.utf8),
            "/api/me/watchlist": Data(#"{"ok":true,"data":[{"id":"watch-1","eventId":"event-1","channels":["APP_PUSH"],"calendarEnabled":true,"notificationEnabled":true,"event":{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE"},"notificationJobs":[{"id":"job-1","type":"BOOKING_D3","title":"예매 오픈 D-3 알림","status":"SCHEDULED","scheduledAt":"2026-08-19T19:00:00+09:00"}]}]}"#.utf8),
            "/api/me/support/threads": Data(#"{"ok":true,"data":[{"id":"thread-1","subject":"문의","status":"OPEN","updatedAt":"2026-07-15T00:00:00Z","messages":[{"id":"message-1","role":"CUSTOMER","body":"도와주세요","at":"2026-07-15T00:00:00Z"}]}]}"#.utf8)
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
        _ = try await service.diagnoseSeatMap(eventID: "event-1")
        let seatMap = try await service.getSeatMap(eventID: "event-1")
        let session = try await service.getSession(userID: "user-1")
        let tickets = try await service.getTickets(userID: "user-1")
        let watchlist = try await service.getWatchlist(userID: "user-1")
        let threads = try await service.getSupportThreads(userID: "user-1")

        XCTAssertEqual(state.events.first?.title, "Neon Stage")
        XCTAssertEqual(catalog.events.first?.slug, "neon-stage")
        XCTAssertEqual(seatMap.seats.first?.displayCode, "A-01")
        XCTAssertEqual(session.name, "Tester")
        XCTAssertEqual(tickets.first?.virtualQR?.type, "virtual")
        XCTAssertEqual(tickets.first?.event?.performance?.id, "date-1")
        XCTAssertEqual(tickets.first?.payment?.amount, 105_000)
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
        let calendar = try await service.getOpenCalendar()

        XCTAssertEqual(regions.version, "1")
        XCTAssertEqual(regions.regions.first?.slug, "seoul")
        XCTAssertEqual(calendar.entries.first?.event.slug, "neon-stage")
        XCTAssertEqual(
            Set(LiveBackendServiceURLProtocol.requests.compactMap(\.url?.path)),
            Set(LiveBackendServiceURLProtocol.responses.keys)
        )
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == nil
        })
    }

    func testExplicitPublicContractDiagnosisAdmitsVersionedDiscoveryReads() async throws {
        let event = #"{"id":"event-1","slug":"neon-stage","title":"Neon Stage","venue":"Arena","soldCount":4}"#
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c"}}"#.utf8),
            "/api/state": Data(#"{"ok":true,"data":{"events":[],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":0,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/discovery/v1/contract": Data(#"{"ok":true,"data":{"version":"1","endpoints":["regions","artists","open-calendar"]}}"#.utf8),
            "/api/discovery/v1/regions": Data(#"{"ok":true,"data":{"version":"1","regions":[{"slug":"seoul","name":"서울","eventCount":1,"events":[\#(event)]}]}}"#.utf8),
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
        let service = LiveBackendService(apiClient: client)

        _ = try await service.diagnosePublicContract()
        let regions = try await service.getRegions()
        let calendar = try await service.getOpenCalendar()

        XCTAssertEqual(regions.regions.first?.name, "서울")
        XCTAssertEqual(calendar.entries.first?.event.id, "event-1")
        XCTAssertEqual(service.capabilityMap.state(for: .artist), .available)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            [
                "/api/health",
                "/api/state",
                "/api/discovery/v1/contract",
                "/api/catalog?limit=1",
                "/api/discovery/v1/regions",
                "/api/discovery/v1/open-calendar"
            ]
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

    func testNativeAccountRequestDoesNotExposeUserIDInURL() async throws {
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

        XCTAssertEqual(components.percentEncodedPath, "/api/me")
        XCTAssertNil(components.percentEncodedQuery)
        XCTAssertFalse(request.url?.absoluteString.contains("server") ?? true)
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer native-credential")
    }

    func testNativeProfileUpdateUsesBearerPrincipalAndAllowlistedBody() async throws {
        LiveBackendServiceURLProtocol.responses["/api/me/profile"] = Data(#"{"ok":true,"data":{"id":"user-1","name":"새닉네임","status":"ACTIVE","trustScore":90}}"#.utf8)
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

        let profile = try await compatibleService(for: client, authenticatedReads: true)
            .updateProfile(userID: "user-1", name: "새닉네임")
        let request = try XCTUnwrap(LiveBackendServiceURLProtocol.requests.first)

        XCTAssertEqual(profile.name, "새닉네임")
        XCTAssertEqual(request.url?.path, "/api/me/profile")
        XCTAssertEqual(request.httpMethod, "PATCH")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer native-credential")
    }

    func testSupportProbeAndPublicContentDoNotDependOnCatalog() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c","capabilities":["native-account-v1","native-support-v1"]}}"#.utf8),
            "/api/support/public": Data(#"{"ok":true,"data":{"version":"1","faqs":[{"id":"booking","question":"예매 내역은 어디에서 확인하나요?","answer":"마이페이지에서 확인합니다."}],"notices":[{"id":"secure","title":"안전한 문의","body":"본인 문의만 확인할 수 있습니다."}]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: nil,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        let probe = try await service.diagnoseSupportContract()
        let content = try await service.getPublicSupport()

        XCTAssertEqual(probe.capabilities.state(for: .publicSupport), .available)
        XCTAssertEqual(probe.capabilities.state(for: .supportThreads), .available)
        XCTAssertEqual(probe.capabilities.state(for: .supportMessages), .available)
        XCTAssertEqual(content.faqs.first?.id, "booking")
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap(\.url?.path),
            ["/api/health", "/api/support/public"]
        )
    }

    func testWatchlistProbeDoesNotDependOnCatalog() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c","capabilities":["native-watchlist-v1"]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: nil,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let probe = try await LiveBackendService(apiClient: client).diagnoseWatchlistContract()

        XCTAssertEqual(probe.capabilities.state(for: .watchlist), .available)
        XCTAssertEqual(probe.capabilities.state(for: .watchlistUpsert), .available)
        XCTAssertEqual(probe.capabilities.state(for: .watchlistDelete), .available)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap(\.url?.path),
            ["/api/health"]
        )
    }

    func testNativeSupportRequestsUseBearerPrincipalAndIdempotency() async throws {
        let thread = #"{"id":"thread-1","subject":"결제 문의","status":"OPEN","category":"PAYMENT","createdAt":"2026-08-02T00:00:00Z","updatedAt":"2026-08-02T00:00:00Z","messages":[{"id":"message-1","role":"CUSTOMER","body":"확인해주세요.","at":"2026-08-02T00:00:00Z"}]}"#
        LiveBackendServiceURLProtocol.responses = [
            "GET /api/me/support/threads": Data(#"{"ok":true,"data":[\#(thread)]}"#.utf8),
            "POST /api/me/support/threads": Data(#"{"ok":true,"data":\#(thread)}"#.utf8),
            "POST /api/me/support/messages": Data(#"{"ok":true,"data":\#(thread)}"#.utf8)
        ]
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
        let map = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            nativeSupportRoutesConfirmed: true
        )
        let service = LiveBackendService(apiClient: client, initialCapabilityMap: map)

        _ = try await service.getSupportThreads(userID: "user-1")
        _ = try await service.createSupportThread(
            userID: "user-1",
            subject: "결제 문의",
            message: "확인해주세요.",
            idempotencyKey: "support-create"
        )
        _ = try await service.addSupportMessage(
            userID: "user-1",
            threadID: "thread-1",
            message: "추가 문의",
            idempotencyKey: "support-reply"
        )

        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap(\.url?.path),
            ["/api/me/support/threads", "/api/me/support/threads", "/api/me/support/messages"]
        )
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == "Bearer native-credential"
        })
        XCTAssertNil(LiveBackendServiceURLProtocol.requests[1].url?.query)
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests[1].value(forHTTPHeaderField: "X-Idempotency-Key"), "support-create")
        XCTAssertNil(LiveBackendServiceURLProtocol.requests[2].url?.query)
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests[2].value(forHTTPHeaderField: "X-Idempotency-Key"), "support-reply")
    }

    func testDecodesUnknownSupportStatusAndRoleAsUnknown() throws {
        let data = Data(#"{"id":"thread-1","userId":"user-1","subject":"문의","status":"ESCALATED","updatedAt":"2026-07-15T00:00:00Z","messages":[{"id":"message-1","actorId":"moderator-1","role":"MODERATOR","body":"확인 중입니다","at":"2026-07-15T00:00:00Z"}]}"#.utf8)

        let thread = try JSONDecoder().decode(LiveSupportThread.self, from: data)

        XCTAssertEqual(thread.status, .unknown)
        XCTAssertEqual(thread.messages.first?.role, .unknown)
    }

    func testNativeWatchlistUsesBearerPrincipalForReadUpdateAndDelete() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "GET /api/me/watchlist": Data(#"{"ok":true,"data":[]}"#.utf8),
            "PUT /api/me/watchlist/event-1": Data(#"{"ok":true,"data":{"id":"watch-1","eventId":"event-1","channels":["APP_PUSH"],"calendarEnabled":false,"notificationEnabled":true,"event":{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE"},"notificationJobs":[]}}"#.utf8),
            "DELETE /api/me/watchlist/event-1": Data(#"{"ok":true,"data":{"deleted":true,"eventId":"event-1"}}"#.utf8)
        ]
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
        let map = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            nativeWatchlistRoutesConfirmed: true
        )
        let service = LiveBackendService(apiClient: client, initialCapabilityMap: map)

        let initial = try await service.getWatchlist(userID: "user-1")
        XCTAssertEqual(initial, [])
        let updated = try await service.upsertWatchlist(
            userID: "user-1",
            eventID: "event-1",
            channels: ["APP_PUSH"],
            calendarEnabled: false,
            notificationEnabled: true
        )
        XCTAssertEqual(updated.eventId, "event-1")
        let deleted = try await service.deleteWatchlist(userID: "user-1", eventID: "event-1")
        XCTAssertEqual(deleted.eventId, "event-1")

        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { "\(request.httpMethod ?? "") \($0.path)" }
            },
            ["GET /api/me/watchlist", "PUT /api/me/watchlist/event-1", "DELETE /api/me/watchlist/event-1"]
        )
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == "Bearer native-credential"
        })
        let updateBody = try XCTUnwrap(LiveBackendServiceURLProtocol.requestBodies[1])
        let updateJSON = try XCTUnwrap(JSONSerialization.jsonObject(with: updateBody) as? [String: Any])
        XCTAssertNil(updateJSON["userId"])
        XCTAssertEqual(updateJSON["notificationEnabled"] as? Bool, true)
    }

    func testNativeBookingHoldsUsesBearerPrincipalAcrossQueueHoldAndDraft() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "POST /api/me/queue-entries": Data(#"{"ok":true,"data":{"id":"queue-1","performanceDateId":"perf-1","status":"ADMITTED","position":0,"admittedAt":"2026-08-05T10:00:00.000Z","admissionExpiresAt":"2026-08-05T10:10:00.000Z","enteredAt":"2026-08-05T09:59:00.000Z"}}"#.utf8),
            "GET /api/me/queue-entries/queue-1": Data(#"{"ok":true,"data":{"id":"queue-1","performanceDateId":"perf-1","status":"ADMITTED","position":0,"admittedAt":"2026-08-05T10:00:00.000Z","admissionExpiresAt":"2026-08-05T10:10:00.000Z","enteredAt":"2026-08-05T09:59:00.000Z"}}"#.utf8),
            "DELETE /api/me/queue-entries/queue-1": Data(#"{"ok":true,"data":{"id":"queue-1","status":"LEFT"}}"#.utf8),
            "POST /api/me/seat-holds": Data(#"{"ok":true,"data":{"id":"hold-1","status":"ACTIVE","performanceDateId":"perf-1","ticketIds":["ticket-1"],"expiresAt":"2026-08-05T10:05:00.000Z","extensionsUsed":0}}"#.utf8),
            "GET /api/me/seat-holds/hold-1": Data(#"{"ok":true,"data":{"id":"hold-1","status":"ACTIVE","performanceDateId":"perf-1","ticketIds":["ticket-1"],"expiresAt":"2026-08-05T10:05:00.000Z","extensionsUsed":0}}"#.utf8),
            "PATCH /api/me/seat-holds/hold-1/extend": Data(#"{"ok":true,"data":{"id":"hold-1","status":"ACTIVE","performanceDateId":"perf-1","ticketIds":["ticket-1"],"expiresAt":"2026-08-05T10:10:00.000Z","extensionsUsed":1}}"#.utf8),
            "POST /api/me/reservation-drafts": Data(#"{"ok":true,"data":{"id":"draft-1","status":"PENDING_PAYMENT","performanceDateId":"perf-1","ticketIds":["ticket-1"],"amount":{"faceValueTotal":88000,"serviceFee":2000,"total":90000},"expiresAt":"2026-08-05T10:15:00.000Z"}}"#.utf8),
            "GET /api/me/reservation-drafts/draft-1": Data(#"{"ok":true,"data":{"id":"draft-1","status":"PENDING_PAYMENT","performanceDateId":"perf-1","ticketIds":["ticket-1"],"amount":{"faceValueTotal":88000,"serviceFee":2000,"total":90000},"expiresAt":"2026-08-05T10:15:00.000Z"}}"#.utf8),
            "DELETE /api/me/reservation-drafts/draft-1": Data(#"{"ok":true,"data":{"id":"draft-1","status":"CANCELLED","performanceDateId":"perf-1","ticketIds":["ticket-1"],"amount":{"faceValueTotal":88000,"serviceFee":2000,"total":90000},"expiresAt":"2026-08-05T10:15:00.000Z"}}"#.utf8)
        ]
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
        let map = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            nativeBookingHoldsRoutesConfirmed: true
        )
        let service = LiveBackendService(apiClient: client, initialCapabilityMap: map)

        let entry = try await service.enterQueue(userID: "user-1", performanceDateID: "perf-1")
        XCTAssertEqual(entry.status, .admitted)
        let fetchedEntry = try await service.getQueueEntry(userID: "user-1", entryID: entry.id)
        XCTAssertEqual(fetchedEntry.id, "queue-1")
        let leftEntry = try await service.leaveQueue(userID: "user-1", entryID: entry.id)
        XCTAssertEqual(leftEntry.status, .left)

        let hold = try await service.createSeatHold(
            userID: "user-1",
            performanceDateID: "perf-1",
            ticketIDs: ["ticket-1"],
            idempotencyKey: "hold-key-1"
        )
        XCTAssertEqual(hold.status, .active)
        let fetchedHold = try await service.getSeatHold(userID: "user-1", holdID: hold.id)
        XCTAssertEqual(fetchedHold.ticketIds, ["ticket-1"])
        let extended = try await service.extendSeatHold(userID: "user-1", holdID: hold.id)
        XCTAssertEqual(extended.extensionsUsed, 1)

        let draft = try await service.createReservationDraft(userID: "user-1", holdID: hold.id, idempotencyKey: "draft-key-1")
        XCTAssertEqual(draft.status, .pendingPayment)
        XCTAssertEqual(draft.amount.total, 90000)
        let fetchedDraft = try await service.getReservationDraft(userID: "user-1", draftID: draft.id)
        XCTAssertEqual(fetchedDraft.id, "draft-1")
        let cancelledDraft = try await service.cancelReservationDraft(userID: "user-1", draftID: draft.id)
        XCTAssertEqual(cancelledDraft.status, .cancelled)

        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { "\(request.httpMethod ?? "") \($0.path)" }
            },
            [
                "POST /api/me/queue-entries",
                "GET /api/me/queue-entries/queue-1",
                "DELETE /api/me/queue-entries/queue-1",
                "POST /api/me/seat-holds",
                "GET /api/me/seat-holds/hold-1",
                "PATCH /api/me/seat-holds/hold-1/extend",
                "POST /api/me/reservation-drafts",
                "GET /api/me/reservation-drafts/draft-1",
                "DELETE /api/me/reservation-drafts/draft-1"
            ]
        )
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == "Bearer native-credential"
        })
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests[3].value(forHTTPHeaderField: "X-Idempotency-Key"), "hold-key-1")
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests[6].value(forHTTPHeaderField: "X-Idempotency-Key"), "draft-key-1")

        let holdRequestBody = try XCTUnwrap(LiveBackendServiceURLProtocol.requestBodies[3])
        let holdRequestJSON = try XCTUnwrap(JSONSerialization.jsonObject(with: holdRequestBody) as? [String: Any])
        XCTAssertEqual(holdRequestJSON["performanceDateId"] as? String, "perf-1")
        XCTAssertEqual(holdRequestJSON["ticketIds"] as? [String], ["ticket-1"])
    }

    func testBookingHoldsCapabilityRequiresConfirmedRoutesAndHTTPS() async throws {
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
        let unconfirmedMap = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion
        )
        let service = LiveBackendService(apiClient: client, initialCapabilityMap: unconfirmedMap)

        do {
            _ = try await service.enterQueue(userID: "user-1", performanceDateID: "perf-1")
            XCTFail("Expected booking-hold mutation to remain unavailable without server confirmation")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .queueEntryEnter, state: .blocked(.unsupportedMutation)))
        }
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests.count, 0)
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

    func testSeatMapAdmissionMatchesOnlyEventIDOnlyRoute() {
        let admission = LiveSeatMapAdmission(eventID: "event-1", performanceDateID: nil)

        XCTAssertTrue(admission.matches(eventID: "event-1", performanceDateID: nil))
        XCTAssertFalse(admission.matches(eventID: "event-2", performanceDateID: nil))
        XCTAssertFalse(admission.matches(eventID: "event-1", performanceDateID: "date-1"))
    }

    func testSeatMapEventIDOnlyDiagnosisAndMatchingReadUseOneRequest() async throws {
        LiveBackendServiceURLProtocol.responses["/api/seat-map?eventId=event-1"] = Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        _ = try await service.diagnoseSeatMap(eventID: "event-1")
        let seatMap = try await service.getSeatMap(eventID: "event-1")

        XCTAssertEqual(seatMap.event.id, "event-1")
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests.count, 1)
        let request = try XCTUnwrap(LiveBackendServiceURLProtocol.requests.first)
        XCTAssertEqual(request.url?.path, "/api/seat-map")
        XCTAssertEqual(request.url?.query, "eventId=event-1")
        XCTAssertNil(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first {
            $0.name == "performanceDateId"
        })
    }

    func testSeatMapDiagnosisRejectsEmptyEventIDWithoutDispatch() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await LiveBackendService(apiClient: client).diagnoseSeatMap(eventID: "   ")
            XCTFail("Expected empty event ID rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testFailedSeatMapReprobeRejectsReturnedIdentityAndClearsPriorAdmission() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/seat-map?eventId=event-1": Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8),
            "/api/seat-map?eventId=event-2": Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Stale Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        _ = try await service.diagnoseSeatMap(eventID: "event-1")
        do {
            _ = try await service.diagnoseSeatMap(eventID: "event-2")
            XCTFail("Expected returned event identity mismatch")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
            XCTAssertEqual(service.capabilityMap.state(for: .seatMap), .unknown)
        }

        let requestCount = LiveBackendServiceURLProtocol.requests.count
        do {
            _ = try await service.getSeatMap(eventID: "event-1")
            XCTFail("Expected prior admission to be cleared")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .seatMap, state: .unknown))
            XCTAssertEqual(LiveBackendServiceURLProtocol.requests.count, requestCount)
        }
    }

    func testSeatMapDiagnosisRejectsEmptyReturnedEventID() async {
        LiveBackendServiceURLProtocol.responses["/api/seat-map?eventId=event-1"] = Data(#"{"ok":true,"data":{"event":{"id":"","title":"Unknown","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        do {
            _ = try await service.diagnoseSeatMap(eventID: "event-1")
            XCTFail("Expected empty returned event ID rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
            XCTAssertEqual(service.capabilityMap.state(for: .seatMap), .unknown)
            XCTAssertEqual(LiveBackendServiceURLProtocol.requests.count, 1)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testSeatMapCacheFailsClosedAfterCapabilityBecomesUnknown() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/seat-map?eventId=event-1": Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8),
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/discovery/v1/contract": Data(#"{"ok":true,"data":{"version":"1","endpoints":["regions","artists","open-calendar"]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        _ = try await service.diagnoseSeatMap(eventID: "event-1")
        let probe = try await service.diagnosePublicContract()
        XCTAssertEqual(probe.capabilities.state(for: .seatMap), .unknown)
        LiveBackendServiceURLProtocol.requests = []

        do {
            _ = try await service.getSeatMap(eventID: "event-1")
            XCTFail("Expected stale cached seat map rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .seatMap, state: .unknown))
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testSeatMapCacheFailsClosedAfterCapabilityBecomesIncompatible() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/seat-map?eventId=event-1": Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8),
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"future-contract"}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        _ = try await service.diagnoseSeatMap(eventID: "event-1")
        let probe = try await service.diagnosePublicContract()
        let state = LiveCapabilityState.incompatible(
            expected: LiveAPIContract.deployed.expectedResponseVersion,
            observed: "future-contract"
        )
        XCTAssertEqual(probe.capabilities.state(for: .seatMap), state)
        LiveBackendServiceURLProtocol.requests = []

        do {
            _ = try await service.getSeatMap(eventID: "event-1")
            XCTFail("Expected stale cached seat map rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .seatMap, state: state))
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testIncompatibleSeatMapDiagnosisFailsClosedWithoutDispatch() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let map = LiveAPIContract.deployed.capabilityMap(
            for: client.baseURL!,
            observedResponseVersion: "future-contract"
        )
        let service = LiveBackendService(apiClient: client, initialCapabilityMap: map)

        do {
            _ = try await service.diagnoseSeatMap(eventID: "event-1")
            XCTFail("Expected incompatible seat-map diagnosis rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(
                error,
                .capabilityUnavailable(endpoint: .seatMap, state: map.state(for: .seatMap))
            )
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testSeatMapAdmissionRejectsDifferentEventAndPerformanceDateWithoutDispatch() async throws {
        LiveBackendServiceURLProtocol.responses["/api/seat-map?eventId=event-1"] = Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        _ = try await service.diagnoseSeatMap(eventID: "event-1")
        LiveBackendServiceURLProtocol.requests = []

        do {
            _ = try await service.getSeatMap(eventID: "event-2")
            XCTFail("Expected different event seat-map rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .seatMap, state: .unknown))
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        }

        do {
            _ = try await service.getSeatMap(eventID: "event-1", performanceDateID: "date-1")
            XCTFail("Expected performance-date seat-map rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .seatMap, state: .unknown))
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        }
    }

    func testSeatMapAdmissionDoesNotAuthorizeVenueRoute() async throws {
        LiveBackendServiceURLProtocol.responses["/api/seat-map?eventId=event-1"] = Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[],"seats":[]}}"#.utf8)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        _ = try await service.diagnoseSeatMap(eventID: "event-1")
        LiveBackendServiceURLProtocol.requests = []

        do {
            _ = try await service.getVenueSeatMap(eventID: "event-1")
            XCTFail("Expected unproved venue seat-map route rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .seatMap, state: .unknown))
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testDefaultSeatMapUnknownDoesNotDispatchWithoutExplicitDiagnosis() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        do {
            _ = try await service.getSeatMap(eventID: "event-1")
            XCTFail("Expected unknown seat-map capability rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .seatMap, state: .unknown))
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testStateProofKeepsUnknownCatalogUndispatched() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let map = LiveAPIContract.deployed.capabilityMap(
            for: client.baseURL!,
            observedResponseVersion: nil,
            provenPublicEndpoints: [.state]
        )
        let service = LiveBackendService(apiClient: client, initialCapabilityMap: map)

        do {
            _ = try await service.getCatalog()
            XCTFail("Expected unproved catalog capability rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .catalog, state: .unknown))
            XCTAssertEqual(map.state(for: .state), .available)
            XCTAssertEqual(map.state(for: .catalog), .unknown)
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testDefaultCatalogUnknownDoesNotDispatchDiagnosticOrCatalogRequest() async {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/catalog": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        do {
            _ = try await service.getCatalog()
            XCTFail("Expected unknown catalog capability rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .catalog, state: .unknown))
            XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
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
            provenPublicEndpoints: [.regions, .openCalendar],
            catalogRouteConfirmed: true
        )
        XCTAssertEqual(discoveryConfirmed.state(for: .regions), .available)
        XCTAssertEqual(discoveryConfirmed.state(for: .artist), .unknown)
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

        let attested = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            catalogRouteConfirmed: true,
            nativeAccountRoutesConfirmed: true
        )
        XCTAssertEqual(attested.state(for: .session), .available)
        XCTAssertEqual(attested.state(for: .tickets), .available)
        XCTAssertEqual(attested.state(for: .watchlist), .blocked(.serverAuthorizationUnverified))

        let watchlistAttested = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            nativeWatchlistRoutesConfirmed: true
        )
        XCTAssertEqual(watchlistAttested.state(for: .watchlist), .available)
        XCTAssertEqual(watchlistAttested.state(for: .watchlistUpsert), .available)
        XCTAssertEqual(watchlistAttested.state(for: .watchlistDelete), .available)
    }

    func testCatalogAdmissionUsesHealthThenBoundedCatalogProbe() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":null,"period":null,"image":null,"pinnedRank":1,"soldCount":4,"sale":null}]}}"#.utf8),
            "/api/discovery/v1/contract": Data(#"{"ok":true,"data":{"version":"1","endpoints":["regions","artists","open-calendar","venues"]}}"#.utf8),
            "/api/catalog?limit=50": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":null,"period":null,"image":null,"pinnedRank":1,"soldCount":4,"sale":null}]}}"#.utf8)
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
        _ = try await service.diagnosePublicContract()
        let catalog = try await service.getCatalog()

        XCTAssertEqual(catalog.events.map(\.id), ["event-1"])
        XCTAssertEqual(service.capabilityMap.state(for: .regions), .available)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            ["/api/health", "/api/state", "/api/discovery/v1/contract", "/api/catalog?limit=1", "/api/catalog?limit=50"]
        )
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == nil
        })
    }

    func testCatalogRejectsOutOfRangeLimitWithoutDispatch() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = compatibleService(for: client)

        for limit in [0, 101] {
            do {
                _ = try await service.getCatalog(limit: limit)
                XCTFail("Expected local limit rejection for \(limit)")
            } catch let error as APIClientError {
                XCTAssertEqual(error, .invalidResponse)
            } catch {
                XCTFail("Unexpected error: \(error)")
            }
        }
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)
    }

    func testCatalogAggregatesPagesUsingOnlyServerIssuedCursors() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/catalog?limit=2": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","title":"One","venue":"Arena","soldCount":1},{"id":"event-2","title":"Two","venue":"Arena","soldCount":2}],"nextCursor":"server-page-2","total":3}}"#.utf8),
            "/api/catalog?limit=2&cursor=server-page-2": Data(#"{"ok":true,"data":{"events":[{"id":"event-3","title":"Three","venue":"Arena","soldCount":3}],"total":3}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let catalog = try await compatibleService(for: client).getCatalog(limit: 2)

        XCTAssertEqual(catalog.events.map(\.id), ["event-1", "event-2", "event-3"])
        XCTAssertNil(catalog.nextCursor)
        XCTAssertEqual(catalog.total, 3)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { $0.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") } },
            ["/api/catalog?limit=2", "/api/catalog?limit=2&cursor=server-page-2"]
        )
    }

    func testCatalogRejectsRepeatedCursorWithoutLooping() async {
        LiveBackendServiceURLProtocol.responses = [
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[],"nextCursor":"repeat"}}"#.utf8),
            "/api/catalog?limit=1&cursor=repeat": Data(#"{"ok":true,"data":{"events":[],"nextCursor":"repeat"}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await compatibleService(for: client).getCatalog(limit: 1)
            XCTFail("Expected repeated cursor rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
            XCTAssertEqual(LiveBackendServiceURLProtocol.requests.count, 2)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testCatalogStopsAtFinitePageLimit() async {
        for index in 0..<20 {
            let key = index == 0
                ? "/api/catalog?limit=1"
                : "/api/catalog?limit=1&cursor=server-\(index)"
            LiveBackendServiceURLProtocol.responses[key] = Data(
                #"{"ok":true,"data":{"events":[],"nextCursor":"server-\#(index + 1)"}}"#.utf8
            )
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        do {
            _ = try await compatibleService(for: client).getCatalog(limit: 1)
            XCTFail("Expected finite aggregation rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .invalidResponse)
            XCTAssertEqual(LiveBackendServiceURLProtocol.requests.count, 20)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testCompatibleDiagnosisKeepsStateAndDiscoveryIndependentFromCatalogFailure() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c"}}"#.utf8),
            "/api/state": Data(#"{"ok":true,"data":{"events":[],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":0,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8),
            "/api/catalog?limit=1": Data("{".utf8),
            "/api/discovery/v1/contract": Data(#"{"ok":true,"data":{"version":"1","endpoints":["regions","artists","open-calendar"]}}"#.utf8),
            "/api/discovery/v1/regions": Data(#"{"ok":true,"data":{"version":"1","regions":[]}}"#.utf8),
            "/api/discovery/v1/open-calendar": Data(#"{"ok":true,"data":{"version":"1","entries":[]}}"#.utf8),
            "/api/discovery/v1/artists/iu": Data(#"{"ok":true,"data":{"version":"1","artist":{"slug":"iu","name":"IU"},"events":[]}}"#.utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )
        let service = LiveBackendService(apiClient: client)

        let probe = try await service.diagnosePublicContract()
        XCTAssertEqual(probe.capabilities.state(for: .state), .available)
        XCTAssertEqual(probe.capabilities.state(for: .catalog), .unknown)
        XCTAssertEqual(probe.capabilities.state(for: .regions), .available)
        XCTAssertEqual(probe.capabilities.state(for: .openCalendar), .available)
        XCTAssertEqual(probe.capabilities.state(for: .artist), .available)
        _ = try await service.getRegions()
        _ = try await service.getOpenCalendar()

        let requestCount = LiveBackendServiceURLProtocol.requests.count
        let artist = try await service.getArtist(slug: "iu")
        XCTAssertEqual(artist.artist.name, "IU")
        XCTAssertEqual(LiveBackendServiceURLProtocol.requests.count, requestCount + 1)
    }

    func testLiveHomeFallsBackToIndependentlyProvenStateWhenCatalogProbeFails() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c"}}"#.utf8),
            "/api/state": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE","sale":{"state":"ON_SALE","label":"예매 가능","bookable":true}}],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":1,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8),
            "/api/catalog?limit=1": Data("{".utf8)
        ]
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "https://ticketground.test/")!,
            assetBaseURL: URL(string: "https://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let result = try await DiscoveryFixtureLoader.loadLive(using: client)

        guard case .stateOnly(let state) = result else {
            return XCTFail("Expected state fallback")
        }
        XCTAssertEqual(state.events.first?.id, "event-1")
    }

    func testLiveHomeExplicitDiagnosisLoadsHealthyCatalogWhenStateProbeFails() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/catalog?limit=50": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":"2026-09-19","period":null,"image":null,"pinnedRank":1,"soldCount":4,"sale":{"state":"ON_SALE","label":"예매 가능","note":"공식 판매"}}]}}"#.utf8)
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
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.contains { $0.url?.path == "/api/state" })
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            ["/api/health", "/api/state", "/api/discovery/v1/contract", "/api/catalog?limit=1", "/api/catalog?limit=50"]
        )
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

        let service = LiveBackendService(apiClient: client)
        do {
            _ = try await service.diagnosePublicContract()
            _ = try await service.getCatalog()
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

        let probe = try? await service.diagnosePublicContract()

        XCTAssertEqual(probe?.capabilities.state(for: .catalog), .unknown)
        XCTAssertEqual(service.capabilityMap.state(for: .catalog), .unknown)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            ["/api/health", "/api/state", "/api/discovery/v1/contract", "/api/catalog?limit=1"]
        )
    }

    func testCatalogAdmissionAcceptsEmptyProbeAndReturnsEmptyCatalog() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/catalog?limit=50": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8)
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
        _ = try await service.diagnosePublicContract()
        let catalog = try await service.getCatalog()

        XCTAssertTrue(catalog.events.isEmpty)
        XCTAssertEqual(service.capabilityMap.state(for: .catalog), .available)
        XCTAssertEqual(service.capabilityMap.state(for: .regions), .unknown)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            ["/api/health", "/api/state", "/api/discovery/v1/contract", "/api/catalog?limit=1", "/api/catalog?limit=50"]
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
            _ = try await service.diagnosePublicContract()
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

    func testDecodesEventVenueSeatMapModel() throws {
        let map = try JSONDecoder().decode(
            LiveVenueSeatMap.self,
            from: Data(#"{"eventId":"event-1","venueId":"venue-1","venue":"Arena","address":"Seoul","type":"svg","imageUrl":"/assets/map.svg","imageSource":"venue-map","stage":"STAGE","helper":"좌석 안내","labels":[{"text":"VIP","x":50,"y":38}],"seats":[{"zoneId":"vip","seatLabel":"VIP-01","number":1,"x":34,"y":58,"section":"VIP"}]}"#.utf8)
        )

        XCTAssertEqual(map.eventID, "event-1")
        XCTAssertEqual(map.imageURL, "/assets/map.svg")
        XCTAssertEqual(map.labels?.first?.text, "VIP")
        XCTAssertEqual(map.seats.first?.seatLabel, "VIP-01")
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
        XCTAssertEqual(LiveAPIEndpoint.supportMessages.pathTemplate, "/api/me/support/messages")
        XCTAssertEqual(LiveAPIEndpoint.watchlistMutation.method, .post)
        XCTAssertEqual(LiveAPIEndpoint.watchlistMutation.pathTemplate, "/api/watchlist")
        XCTAssertEqual(LiveAPIEndpoint.watchlistUpsert.method, .put)
        XCTAssertEqual(LiveAPIEndpoint.watchlistUpsert.pathTemplate, "/api/me/watchlist/{eventId}")
        XCTAssertEqual(LiveAPIEndpoint.watchlistDelete.method, .delete)
        XCTAssertEqual(LiveAPIEndpoint.ticketPurchase.method, .post)
        XCTAssertEqual(LiveAPIEndpoint.ticketPurchase.pathTemplate, "/api/tickets/buy")
        XCTAssertEqual(LiveAPIEndpoint.session.pathTemplate, "/api/me")
        XCTAssertEqual(LiveAPIEndpoint.tickets.pathTemplate, "/api/me/tickets")
    }

    func testAuthenticatedActionSendsOwnerBoundJSONAndIdempotencyKeyOverHTTPS() async throws {
        LiveBackendServiceURLProtocol.responses["/api/me/watchlist/event-1"] = Data(#"{"ok":true,"data":{"id":"watch-1","eventId":"event-1"}}"#.utf8)
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

        XCTAssertEqual(request.httpMethod, "PUT")
        XCTAssertEqual(request.url?.path, "/api/me/watchlist/event-1")
        XCTAssertEqual(emittedBody["notificationEnabled"] as? Bool, true)
        XCTAssertNil(emittedBody["userId"])
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer native-credential")
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Idempotency-Key"), "watchlist-1")
        XCTAssertEqual(receipt.payload, .object([
            "id": .string("watch-1"),
            "eventId": .string("event-1")
        ]))
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
            LiveBackendServiceURLProtocol.responses["/api/me/support/messages"] = Data(#"{"ok":false,"error":{"code":"\#(code)","message":"\#(message)"}}"#.utf8)
            LiveBackendServiceURLProtocol.statusCodes["/api/me/support/messages"] = status

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
        let actions: [(LiveAuthenticatedAction, APIRequestMethod, String, String)] = [
            (.supportThread(userID: "user-1", message: "문의", idempotencyKey: "thread"), .post, "/api/me/support/threads", "__bearer__"),
            (.supportMessage(userID: "user-1", threadID: "thread-1", message: "답변", idempotencyKey: "message"), .post, "/api/me/support/messages", "__bearer__"),
            (.watchlist(userID: "user-1", eventID: "event-1", idempotencyKey: "watch"), .put, "/api/me/watchlist/event-1", "__bearer__"),
            (.watchlistNotification(userID: "user-1", eventID: "event-1", idempotencyKey: "notify"), .put, "/api/me/watchlist/event-1", "__bearer__"),
            (.ticketPurchase(userID: "user-1", ticketID: "ticket-1", idempotencyKey: "purchase"), .post, "/api/tickets/buy", "userId"),
            (.identityStart(userID: "user-1", phone: "01012345678", idempotencyKey: "identity-start"), .post, "/api/identity/portone-danal/start", "userId"),
            (.identityConfirm(userID: "user-1", phone: "01012345678", verificationID: "identity-1", idempotencyKey: "identity-confirm"), .post, "/api/identity/portone-danal/confirm", "userId"),
            (.trustDevice(userID: "user-1", deviceID: "device-1", attestation: "attestation", idempotencyKey: "trust"), .post, "/api/devices/trust", "userId"),
            (.pushToken(userID: "user-1", token: "push-token", idempotencyKey: "push"), .post, "/api/devices/push-token", "userId"),
            (.admissionQR(userID: "user-1", ticketID: "ticket-1", deviceID: "device-1", attestation: "attestation", idempotencyKey: "qr"), .post, "/api/tickets/qr", "userId"),
            (.virtualQR(userID: "user-1", ticketID: "ticket-1", idempotencyKey: "virtual-qr"), .post, "/api/tickets/virtual-qr", "userId")
        ]

        for (action, method, path, ownerField) in actions {
            let request = try action.request()
            let body = try XCTUnwrap(request.body.jsonObject)
            XCTAssertEqual(request.method, method)
            XCTAssertEqual(request.path, path)
            XCTAssertEqual(request.idempotencyKey?.isEmpty, false)
            XCTAssertEqual(request.authentication, .required(userID: "user-1"))
            if ownerField == "__bearer__" {
                XCTAssertEqual(request.ownerBinding, .bearerPrincipal)
                XCTAssertNil(body["userId"])
                XCTAssertNil(body["actorId"])
            } else {
                XCTAssertEqual(request.ownerBinding, .jsonField(ownerField))
                XCTAssertEqual(body[ownerField] as? String, "user-1")
            }
        }
    }

    func testNativeLifecycleUsesBearerPrincipalForTypedRoutesAndDecodesSafeResponses() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "GET /api/me/resale-pools": Data(#"{"ok":true,"data":[{"id":"pool-1","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-vip","ticketId":"ticket-1","showSlug":"neon-stage","price":99000,"buyerFee":1000,"buyerTotal":100000,"sellerSettlement":98000,"buyerCount":1,"status":"OPEN","createdAt":"2026-08-12T09:00:00Z","matchedAt":null}]}"#.utf8),
            "POST /api/me/resale-pools": Data(#"{"ok":true,"data":{"id":"pool-2","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-vip","ticketId":"ticket-2","showSlug":null,"price":88000,"buyerFee":1000,"buyerTotal":89000,"sellerSettlement":87000,"buyerCount":0,"status":"OPEN","createdAt":"2026-08-12T09:01:00Z","matchedAt":null}}"#.utf8),
            "POST /api/me/resale-pools/pool-1/join": Data(#"{"ok":true,"data":{"id":"pool-1","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-vip","ticketId":"ticket-1","showSlug":"neon-stage","price":99000,"buyerFee":1000,"buyerTotal":100000,"sellerSettlement":98000,"buyerCount":1,"status":"MATCHED","createdAt":"2026-08-12T09:00:00Z","matchedAt":"2026-08-12T09:02:00Z"}}"#.utf8),
            "DELETE /api/me/resale-pools/pool-2": Data(#"{"ok":true,"data":{"id":"pool-2","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-vip","ticketId":"ticket-2","showSlug":null,"price":88000,"buyerFee":1000,"buyerTotal":89000,"sellerSettlement":87000,"buyerCount":0,"status":"CANCELED","createdAt":"2026-08-12T09:01:00Z","matchedAt":null}}"#.utf8),
            "GET /api/me/cancellation-requests": Data(#"{"ok":true,"data":[{"id":"cancel-1","ticketId":"ticket-1","reason":"일정 변경","refundAcknowledged":true,"status":"PENDING_REVIEW","createdAt":"2026-08-12T09:00:00Z","updatedAt":"2026-08-12T09:00:00Z"}]}"#.utf8),
            "POST /api/me/cancellation-requests": Data(#"{"ok":true,"data":{"id":"cancel-2","ticketId":"ticket-2","reason":"공연 취소","refundAcknowledged":true,"status":"PENDING_REVIEW","createdAt":"2026-08-12T09:03:00Z","updatedAt":"2026-08-12T09:03:00Z"}}"#.utf8),
            "GET /api/me/devices": Data(#"{"ok":true,"data":[{"id":"device-1","deviceId":"iphone-1","deviceName":"테스터 iPhone","platform":"iOS","status":"TRUSTED","createdAt":"2026-08-12T09:00:00Z","lastVerifiedAt":"2026-08-12T09:00:00Z","revokedAt":null}]}"#.utf8),
            "DELETE /api/me/devices/device-1": Data(#"{"ok":true,"data":{"id":"device-1","deviceId":"iphone-1","deviceName":"테스터 iPhone","platform":"iOS","status":"REVOKED","createdAt":"2026-08-12T09:00:00Z","lastVerifiedAt":"2026-08-12T09:00:00Z","revokedAt":"2026-08-12T09:04:00Z"}}"#.utf8),
            "GET /api/me/push-tokens": Data(#"{"ok":true,"data":[{"platform":"ios","status":"ACTIVE","suffix":"cdef","createdAt":"2026-08-12T09:00:00Z","updatedAt":"2026-08-12T09:00:00Z"}]}"#.utf8),
            "POST /api/me/push-tokens": Data(#"{"ok":true,"data":{"platform":"ios","status":"ACTIVE","suffix":"cdef","createdAt":"2026-08-12T09:00:00Z","updatedAt":"2026-08-12T09:05:00Z"}}"#.utf8),
            "POST /api/devices/trust": Data(#"{"ok":true,"data":{"device":{"id":"device-2","userId":"user-1","deviceId":"iphone-2","deviceName":"새 iPhone","platform":"iOS","status":"TRUSTED","lastVerifiedAt":"2026-08-12T09:06:00Z"},"deviceToken":"trusted-device-token"}}"#.utf8),
            "POST /api/tickets/virtual-qr": Data(#"{"ok":true,"data":{"type":"VIRTUAL_TICKET","ticketId":"ticket-1","issuedAt":"2026-08-12T09:07:00Z","eventTitle":"Neon Stage","seatLabel":"A-01","performanceStartsAt":"2026-09-19T19:00:00Z","qrPreparedAt":"2026-09-18T19:00:00Z","realQrAvailableAt":"2026-09-19T16:00:00Z","admissionCredentialStatus":"VIRTUAL_READY","admissionChannel":"APP_ONLY"}}"#.utf8),
            "POST /api/tickets/qr": Data(#"{"ok":true,"data":{"type":"ADMISSION","ticketId":"ticket-1","ownerId":"user-1","expiresAt":"2026-08-12T09:08:20Z","nonce":"nonce-1","signature":"signature-1","issuedAt":"2026-08-12T09:08:00Z","performanceStartsAt":"2026-09-19T19:00:00Z","preparedAt":"2026-09-18T19:00:00Z","activeAt":"2026-09-19T16:00:00Z","ttlSeconds":20,"traceCode":"TRACE123","channel":"APP","emergencyReason":null}}"#.utf8)
        ]
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
        let map = LiveAPIContract.deployed.capabilityMap(
            for: URL(string: "https://ticketground.test/")!,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            nativeLifecycleRoutesConfirmed: true
        )
        let service = LiveBackendService(apiClient: client, initialCapabilityMap: map)

        let pools = try await service.getResalePools(userID: "user-1")
        let listed = try await service.createResalePool(userID: "user-1", ticketID: "ticket-2", price: 88_000, showSlug: nil, idempotencyKey: "list-key")
        let joined = try await service.joinResalePool(userID: "user-1", poolID: "pool-1", idempotencyKey: "join-key")
        let cancelledPool = try await service.cancelResalePool(userID: "user-1", poolID: "pool-2")
        let cancellations = try await service.getCancellationRequests(userID: "user-1")
        let requestedCancellation = try await service.createCancellationRequest(userID: "user-1", ticketID: "ticket-2", reason: "공연 취소", refundAcknowledged: true, idempotencyKey: "cancel-key")
        let devices = try await service.getTrustedDevices(userID: "user-1")
        let revoked = try await service.revokeTrustedDevice(userID: "user-1", deviceID: "device-1")
        let tokens = try await service.getPushTokens(userID: "user-1")
        let registeredToken = try await service.registerPushToken(userID: "user-1", platform: .ios, token: "apns-token-cdef", idempotencyKey: "push-key")
        let trust = try await service.trustDevice(userID: "user-1", deviceID: "iphone-2", deviceName: "새 iPhone", platform: "iOS", attestation: "attestation")
        let virtualTicket = try await service.getVirtualTicketQR(userID: "user-1", ticketID: "ticket-1")
        let admission = try await service.issueAdmissionQR(userID: "user-1", ticketID: "ticket-1", deviceID: "iphone-2", deviceToken: trust.deviceToken, attestation: "attestation")

        XCTAssertEqual(pools.first?.id, "pool-1")
        XCTAssertEqual(listed.status, .open)
        XCTAssertEqual(joined.status, .matched)
        XCTAssertEqual(cancelledPool.status, .cancelled)
        XCTAssertEqual(cancellations.first?.status, .pendingReview)
        XCTAssertEqual(requestedCancellation.refundAcknowledged, true)
        XCTAssertEqual(devices.first?.status, .trusted)
        XCTAssertEqual(revoked.status, .revoked)
        XCTAssertEqual(tokens.first?.suffix, "cdef")
        XCTAssertEqual(registeredToken.platform, .ios)
        XCTAssertEqual(trust.device.deviceID, "iphone-2")
        XCTAssertEqual(virtualTicket.admissionChannel, "APP_ONLY")
        XCTAssertEqual(admission.ttlSeconds, 20)

        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") == "Bearer native-credential"
        })
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy { request in
            request.url?.query == nil
        })
        for index in [1, 2, 5, 9] {
            XCTAssertNotNil(LiveBackendServiceURLProtocol.requests[index].value(forHTTPHeaderField: "X-Idempotency-Key"))
        }
        for index in [1, 2, 5, 9, 10, 11, 12] {
            let body = try XCTUnwrap(LiveBackendServiceURLProtocol.requestBodies[index])
            let json = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
            XCTAssertNil(json["userId"])
            XCTAssertNil(json["ownerId"])
        }
    }

    func testNativeLifecycleCapabilityFailsClosedAndMapsServerError() async throws {
        let baseURL = URL(string: "https://ticketground.test/")!
        let absent = LiveAPIContract.deployed.capabilityMap(
            for: baseURL,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion
        )
        XCTAssertEqual(absent.state(for: .resalePools), .blocked(.serverAuthorizationUnverified))
        XCTAssertEqual(absent.state(for: .resalePoolList), .blocked(.unsupportedMutation))

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let credentials = InMemoryCredentialStore()
        credentials.save(StoredCredential(credential: "native-credential", serverUserID: "user-1"))
        let client = LiveAPIClient(baseURL: baseURL, assetBaseURL: nil, credentialStore: credentials, session: URLSession(configuration: configuration))
        let unavailable = LiveBackendService(apiClient: client, initialCapabilityMap: absent)
        do {
            _ = try await unavailable.getResalePools(userID: "user-1")
            XCTFail("Expected native lifecycle capability rejection")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .capabilityUnavailable(endpoint: .resalePools, state: .blocked(.serverAuthorizationUnverified)))
        }
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.isEmpty)

        LiveBackendServiceURLProtocol.responses = [
            "GET /api/health": Data(#"{"ok":true,"data":{"status":"UP","version":"78b3c7c","capabilities":["native-lifecycle-v1"]}}"#.utf8),
            "GET /api/me/resale-pools": Data(#"{"ok":false,"error":{"code":"NOT_OWNER","message":"ownership required"}}"#.utf8)
        ]
        LiveBackendServiceURLProtocol.statusCodes["/api/me/resale-pools"] = 403
        let service = LiveBackendService(apiClient: client)
        _ = try await service.diagnosePublicContract()
        XCTAssertEqual(service.capabilityMap.state(for: .resalePools), .available)

        do {
            _ = try await service.getResalePools(userID: "user-1")
            XCTFail("Expected mapped lifecycle server error")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .server(status: 403, code: "NOT_OWNER", message: "ownership required"))
        }
    }

    func testNativeLifecycleModelsRejectLeakedDeviceAndPushSecrets() throws {
        let leakedDevice = Data(#"{"id":"device-1","deviceId":"iphone-1","deviceName":"테스터 iPhone","platform":"iOS","status":"TRUSTED","createdAt":"2026-08-12T09:00:00Z","lastVerifiedAt":"2026-08-12T09:00:00Z","revokedAt":null,"tokenHash":"secret-hash"}"#.utf8)
        let leakedPushToken = Data(#"{"platform":"ios","status":"ACTIVE","suffix":"cdef","createdAt":"2026-08-12T09:00:00Z","updatedAt":"2026-08-12T09:00:00Z","tokenDigest":"secret-digest"}"#.utf8)

        XCTAssertThrowsError(try JSONDecoder().decode(LiveTrustedDevice.self, from: leakedDevice))
        XCTAssertThrowsError(try JSONDecoder().decode(LivePushToken.self, from: leakedPushToken))
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
            _ = try await service.diagnosePublicContract()
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

    func testLiveHomeExplicitDiagnosisKeepsTypedStateWhenCatalogRouteIsUnconfirmed() async throws {
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

    func testLiveHomeExplicitDiagnosisFallsBackToStateAfterTransientCatalogFailure() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/health": Data(#"{"ok":true,"data":{"status":"UP","time":"2026-07-28T00:00:00Z","version":"78b3c7c"}}"#.utf8),
            "/api/catalog?limit=1": Data(#"{"ok":true,"data":{"events":[]}}"#.utf8),
            "/api/state": Data(#"{"ok":true,"data":{"events":[],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":0,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8)
        ]
        LiveBackendServiceURLProtocol.errors["/api/catalog?limit=50"] = .timedOut
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [LiveBackendServiceURLProtocol.self]
        let client = LiveAPIClient(
            baseURL: URL(string: "http://ticketground.test/")!,
            assetBaseURL: URL(string: "http://ticketground.test/")!,
            credentialStore: InMemoryCredentialStore(),
            session: URLSession(configuration: configuration)
        )

        let result = try await DiscoveryFixtureLoader.loadLive(using: client)

        guard case .stateOnly(let state) = result else {
            return XCTFail("Expected independently proven state fallback")
        }
        XCTAssertEqual(state.backendSummary.events, 0)
        XCTAssertEqual(
            LiveBackendServiceURLProtocol.requests.compactMap { request in
                request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") }
            },
            ["/api/health", "/api/state", "/api/discovery/v1/contract", "/api/catalog?limit=1", "/api/catalog?limit=50"]
        )
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

        let service = LiveBackendService(apiClient: client)
        do {
            _ = try await service.diagnosePublicContract()
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
            provenPublicEndpoints: [.state, .catalog, .seatMap, .regions, .openCalendar],
            catalogRouteConfirmed: true
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
