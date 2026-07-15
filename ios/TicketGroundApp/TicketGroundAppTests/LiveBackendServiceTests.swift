import Foundation
import XCTest
@testable import TicketGroundApp

private final class LiveBackendServiceURLProtocol: URLProtocol {
    static var responses: [String: Data] = [:]
    static var statusCodes: [String: Int] = [:]
    static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        let key = request.url.map { $0.path + ($0.query.map { "?\($0)" } ?? "") } ?? ""
        let data = Self.responses[key] ?? Data(#"{"ok":false,"error":{"code":"MISSING_FIXTURE","message":"Missing test fixture"}}"#.utf8)
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
        LiveBackendServiceURLProtocol.requests = []
    }

    func testGetsTypedPublicReadsThroughTheExistingAPIClient() async throws {
        LiveBackendServiceURLProtocol.responses = [
            "/api/state": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE","sale":{"state":"ON_SALE","label":"예매 가능","bookable":true}}],"venues":[],"users":[],"tickets":[],"resalePools":[],"backendSummary":{"events":1,"tickets":0},"ledger":{"verified":true,"totalEntries":0}}}"#.utf8),
            "/api/catalog": Data(#"{"ok":true,"data":{"events":[{"id":"event-1","slug":"neon-stage","category":"concert","title":"Neon Stage","venue":"Arena","date":"2026-09-19T19:00:00+09:00","period":"2026.09.19","image":null,"pinnedRank":1,"soldCount":4,"sale":{"state":"ON_SALE","label":"예매 가능","note":"공식 판매"}}]}}"#.utf8),
            "/api/seat-map?eventId=event-1": Data(#"{"ok":true,"data":{"event":{"id":"event-1","title":"Neon Stage","venueId":"venue-1","venue":"Arena"},"map":{"title":"Arena map","image":"/assets/map.svg","description":"Seat map"},"zones":[{"id":"zone-vip","name":"VIP","price":99000,"available":2}],"seats":[{"id":"seat-1","label":"A-01","displayCode":"A-01","zoneId":"zone-vip","zoneName":"VIP","price":99000,"status":"ON_SALE","available":true}]}}"#.utf8),
            "/api/users/user-1/session": Data(#"{"ok":true,"data":{"id":"user-1","name":"Tester","status":"ACTIVE","trustScore":90}}"#.utf8),
            "/api/users/user-1/tickets": Data(#"{"ok":true,"data":[{"id":"ticket-1","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-vip","seatLabel":"A-01","status":"OWNED","available":false,"faceValue":99000,"minPrice":49500,"maxPrice":106920,"transferCount":0,"maxTransferCount":1,"issuedAt":"2026-09-19T19:00:00+09:00","virtualQr":{"type":"virtual","issuedAt":"2026-09-19T18:00:00+09:00"}}]}"#.utf8),
            "/api/users/user-1/watchlist": Data(#"{"ok":true,"data":[{"id":"watch-1","eventId":"event-1","channels":["APP_PUSH"],"calendarEnabled":true,"notificationEnabled":true,"event":{"id":"event-1","title":"Neon Stage","venue":"Arena","venueId":"venue-1","category":"concert","saleState":"ON_SALE"},"notificationJobs":[{"id":"job-1","type":"BOOKING_D3","title":"예매 오픈 D-3 알림","status":"SCHEDULED","scheduledAt":"2026-08-19T19:00:00+09:00"}]}]}"#.utf8),
            "/api/support/threads?userId=user-1": Data(#"{"ok":true,"data":[{"id":"thread-1","userId":"user-1","subject":"문의","status":"OPEN","updatedAt":"2026-07-15T00:00:00Z","messages":[{"id":"message-1","actorId":"user-1","role":"CUSTOMER","body":"도와주세요","at":"2026-07-15T00:00:00Z"}]}]}"#.utf8)
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

        let state = try await service.getState()
        let catalog = try await service.getCatalog()
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
        XCTAssertEqual(watchlist.first?.event?.title, "Neon Stage")
        XCTAssertEqual(watchlist.first?.notificationJobs.first?.status, "SCHEDULED")
        XCTAssertEqual(threads.first?.messages.first?.role, .customer)

        let requestPaths: Set<String> = Set(LiveBackendServiceURLProtocol.requests.compactMap { request in
            guard let url = request.url else { return nil }
            return url.path + (url.query.map { "?\($0)" } ?? "")
        })
        XCTAssertEqual(requestPaths, Set(LiveBackendServiceURLProtocol.responses.keys))
        XCTAssertTrue(LiveBackendServiceURLProtocol.requests.allSatisfy { $0.httpMethod == "GET" })
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
            _ = try await LiveBackendService(apiClient: client).getState()
            XCTFail("Expected backend error")
        } catch let error as APIClientError {
            XCTAssertEqual(error, .server(status: 200, code: "BACKEND_DOWN", message: "Backend unavailable"))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
}
