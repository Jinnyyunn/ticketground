import XCTest
@testable import TicketGroundApp

private final class TosspaymentsFakeAPIClient: APIClient {
    let mode: APIDataMode = .live
    let baseURL: URL?
    private let response: Data
    private let error: APIClientError?
    private(set) var requests: [APIRequest] = []

    init(baseURL: URL?, response: Data = Data(), error: APIClientError? = nil) {
        self.baseURL = baseURL
        self.response = response
        self.error = error
    }

    func data(for request: APIRequest) async throws -> Data {
        requests.append(request)
        if let error { throw error }
        return response
    }

    func resolveResource(_ reference: String?) -> String? { reference }
}

final class TosspaymentsClientTests: XCTestCase {
    func testFetchConfigRejectsHTTPBeforeSendingAnyRequest() async {
        let apiClient = TosspaymentsFakeAPIClient(baseURL: URL(string: "http://localhost:5501"))
        let client = TosspaymentsClient(apiClient: apiClient, sessionStore: SessionStore(credentialStore: InMemoryCredentialStore()))

        do {
            _ = try await client.fetchConfig()
            XCTFail("Expected insecure transport rejection")
        } catch let error as TosspaymentsError {
            XCTAssertEqual(error, .httpsRequired)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
        XCTAssertTrue(apiClient.requests.isEmpty)
    }

    func testFetchConfigDecodesUnconfiguredState() async throws {
        let apiClient = TosspaymentsFakeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test"),
            response: Data(#"{"configured":false,"clientKey":""}"#.utf8)
        )
        let client = TosspaymentsClient(apiClient: apiClient, sessionStore: SessionStore(credentialStore: InMemoryCredentialStore()))

        let config = try await client.fetchConfig()
        XCTAssertEqual(config, TosspaymentsConfig(configured: false, clientKey: ""))
        XCTAssertEqual(apiClient.requests.first?.path, "/api/payments/tosspayments/config")
    }

    func testFetchTicketFindsMatchingTicketAndReportsMissingOnesDistinctly() async throws {
        let apiClient = TosspaymentsFakeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test"),
            response: Data(#"""
            {"events":[],"venues":[],"users":[],"tickets":[
              {"id":"tk_1","eventId":"ev_1","performanceDateId":"pd_1","zoneId":"z_1","seatLabel":"VIP A1",
               "status":"ON_SALE","available":true,"faceValue":120000,"minPrice":120000,"maxPrice":120000,
               "transferCount":0,"maxTransferCount":3}
            ],"resalePools":[],"backendSummary":{"events":1,"tickets":1},"ledger":{"verified":true,"totalEntries":0}}
            """#.utf8)
        )
        let client = TosspaymentsClient(apiClient: apiClient, sessionStore: SessionStore(credentialStore: InMemoryCredentialStore()))

        let ticket = try await client.fetchTicket(ticketID: "tk_1")
        XCTAssertEqual(ticket.id, "tk_1")
        XCTAssertEqual(ticket.faceValue, 120000)

        do {
            _ = try await client.fetchTicket(ticketID: "tk_missing")
            XCTFail("Expected ticketNotFound")
        } catch let error as TosspaymentsError {
            XCTAssertEqual(error, .ticketNotFound)
        }
    }

    func testConfirmPurchaseRejectsWithoutASessionBeforeSendingAnyRequest() async {
        let apiClient = TosspaymentsFakeAPIClient(baseURL: URL(string: "https://api.ticketground.test"))
        let client = TosspaymentsClient(apiClient: apiClient, sessionStore: SessionStore(credentialStore: InMemoryCredentialStore()))

        do {
            _ = try await client.confirmPurchase(ticketID: "tk_1", paymentMethod: "CREDIT_CARD", tossPaymentKey: "toss_key", idempotencyKey: "idem-1")
            XCTFail("Expected missingSession rejection")
        } catch let error as TosspaymentsError {
            XCTAssertEqual(error, .missingSession)
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
        XCTAssertTrue(apiClient.requests.isEmpty)
    }

    func testConfirmPurchaseSendsBearerAuthAndIdempotencyKeyForTheSignedInUser() async throws {
        let apiClient = TosspaymentsFakeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test"),
            response: Data(#"""
            {
              "ticket":{"id":"tk_1","seatLabel":"VIP A1"},
              "event":{"id":"ev_1","title":"공연","venue":"홀"},
              "performanceDate":{},"payment":{},"admission":{},
              "tosspayments":{"tossPaymentKey":"toss_key","method":"카드","mock":true}
            }
            """#.utf8)
        )
        let sessionStore = SessionStore(credentialStore: InMemoryCredentialStore())
        sessionStore.saveNativeCredential("cred-1", serverUserID: "user_1")
        let client = TosspaymentsClient(apiClient: apiClient, sessionStore: sessionStore)

        let result = try await client.confirmPurchase(ticketID: "tk_1", paymentMethod: "CREDIT_CARD", tossPaymentKey: "toss_key", idempotencyKey: "idem-1")

        XCTAssertEqual(result.ticket.id, "tk_1")
        XCTAssertEqual(result.ticket.seatLabel, "VIP A1")
        let sent = try XCTUnwrap(apiClient.requests.first)
        XCTAssertEqual(sent.method, .post)
        XCTAssertEqual(sent.path, "/api/payments/tosspayments/purchase")
        XCTAssertEqual(sent.idempotencyKey, "idem-1")
        XCTAssertEqual(sent.authentication, .required(userID: "user_1"))
        XCTAssertEqual(sent.ownerBinding, .jsonField("userId"))
    }

    func testConfirmPurchaseMapsServerAmountMismatchIntoAReadableMessage() async {
        let apiClient = TosspaymentsFakeAPIClient(
            baseURL: URL(string: "https://api.ticketground.test"),
            error: .server(status: 409, code: "TOSSPAYMENTS_AMOUNT_MISMATCH", message: "토스페이먼츠 승인 금액이 티켓 금액과 일치하지 않습니다.")
        )
        let sessionStore = SessionStore(credentialStore: InMemoryCredentialStore())
        sessionStore.saveNativeCredential("cred-1", serverUserID: "user_1")
        let client = TosspaymentsClient(apiClient: apiClient, sessionStore: sessionStore)

        do {
            _ = try await client.confirmPurchase(ticketID: "tk_1", paymentMethod: "CREDIT_CARD", tossPaymentKey: "toss_key", idempotencyKey: "idem-1")
            XCTFail("Expected server error to propagate")
        } catch let error as TosspaymentsError {
            XCTAssertEqual(error, .server(code: "TOSSPAYMENTS_AMOUNT_MISMATCH", message: "토스페이먼츠 승인 금액이 티켓 금액과 일치하지 않습니다."))
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }
}
