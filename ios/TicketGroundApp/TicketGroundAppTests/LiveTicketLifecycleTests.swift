import XCTest
@testable import TicketGroundApp

final class LiveTicketLifecycleTests: XCTestCase {
    func test_cancellationAndResaleRequireAuthenticatedLifecycleContract() {
        XCTAssertEqual(AppRoute.cancel.classification.connectivity, .externalGate)
        XCTAssertEqual(AppRoute.resale.classification.connectivity, .externalGate)
        XCTAssertEqual(AppRoute.transfer.classification.connectivity, .intentionallyUnsupported)
    }

    func test_resalePriceMustStayInsideOwnedTicketBounds() {
        XCTAssertTrue(LiveLifecycleDisplay.acceptsResalePrice(88_000, minimum: 80_000, maximum: 100_000))
        XCTAssertFalse(LiveLifecycleDisplay.acceptsResalePrice(79_999, minimum: 80_000, maximum: 100_000))
        XCTAssertFalse(LiveLifecycleDisplay.acceptsResalePrice(100_001, minimum: 80_000, maximum: 100_000))
    }

    func test_admissionQRIsVisibleOnlyBeforeItsExpiry() {
        let now = Date(timeIntervalSince1970: 100)
        XCTAssertTrue(LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: "1970-01-01T00:02:00Z", now: now))
        XCTAssertFalse(LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: "1970-01-01T00:01:40Z", now: now))
        XCTAssertFalse(LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: "not-a-date", now: now))
    }

    func test_unknownStaleAndAvailableTicketsFailClosed() throws {
        XCTAssertTrue(LiveLifecycleDisplay.isActionEligible(try ticket(status: "OWNED", available: false)))
        XCTAssertFalse(LiveLifecycleDisplay.isActionEligible(try ticket(status: "FUTURE_STATUS", available: false)))
        XCTAssertFalse(LiveLifecycleDisplay.isActionEligible(try ticket(status: "OWNED", available: true)))
        XCTAssertFalse(LiveLifecycleDisplay.isActionEligible(try ticket(status: "IN_RESALE_POOL", available: false)))
    }

    func test_appAttestProviderKeepsDeviceCredentialEphemeralAndRequiresUserPresence() async throws {
        let attest = TestAppAttestService()
        let presence = TestUserPresenceAuthorizer()
        let provider = LifecycleCredentialProvider(appAttest: attest, userPresence: presence)
        let challenge = LiveAppAttestChallenge(id: "challenge-1", challenge: Data("nonce".utf8).base64EncodedString(), expiresAt: "2099-01-01T00:00:00Z")
        let registration = try await provider.registrationProof(challenge: challenge, deviceID: "device-1")
        XCTAssertEqual(registration.challengeID, "challenge-1")
        XCTAssertEqual(registration.attestationObject, Data("attestation".utf8).base64EncodedString())
        await provider.bindDeviceToken("ephemeral-token")
        let secured = try await provider.qrProof(challenge: challenge)
        XCTAssertEqual(secured.1, "device-1")
        XCTAssertEqual(secured.2, "ephemeral-token")
        let authorizationCount = await presence.authorizationCount
        XCTAssertEqual(authorizationCount, 2)
        await provider.clear()
        do {
            _ = try await provider.qrProof(challenge: challenge)
            XCTFail("cleared credentials must fail closed")
        } catch let error as LifecycleSecurityError {
            XCTAssertEqual(error, .missingEphemeralCredential)
        }
    }

    private func ticket(status: String, available: Bool) throws -> LiveTicket {
        let json = "{\"id\":\"ticket\",\"eventId\":\"event\",\"performanceDateId\":\"performance\",\"zoneId\":\"zone\",\"seatLabel\":\"A1\",\"status\":\"\(status)\",\"available\":\(available),\"faceValue\":10000,\"minPrice\":9000,\"maxPrice\":10000,\"transferCount\":0,\"maxTransferCount\":0}"
        return try JSONDecoder().decode(LiveTicket.self, from: Data(json.utf8))
    }
}

private actor TestAppAttestService: AppAttestServicing {
    nonisolated let isSupported = true
    func generateKey() async throws -> String { "key-1" }
    func attestKey(_ keyID: String, clientDataHash: Data) async throws -> Data { Data("attestation".utf8) }
    func generateAssertion(_ keyID: String, clientDataHash: Data) async throws -> Data { Data("assertion".utf8) }
}

private actor TestUserPresenceAuthorizer: UserPresenceAuthorizing {
    private(set) var authorizationCount = 0
    func authorize(reason: String) async throws { authorizationCount += 1 }
}
