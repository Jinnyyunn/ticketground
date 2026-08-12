import CryptoKit
@preconcurrency import DeviceCheck
import Foundation
import LocalAuthentication
import UIKit
import UserNotifications

enum LifecycleSecurityError: LocalizedError, Equatable {
    case appAttestUnavailable
    case userPresenceUnavailable
    case userPresenceRejected
    case invalidChallenge
    case missingEphemeralCredential
    case pushRegistrationFailed

    var errorDescription: String? {
        switch self {
        case .appAttestUnavailable: return "App Attest를 사용할 수 없는 기기에서는 등록할 수 없습니다."
        case .userPresenceUnavailable: return "기기 잠금 또는 생체 인증을 먼저 설정해 주세요."
        case .userPresenceRejected: return "사용자 확인이 완료되지 않아 작업을 중단했습니다."
        case .invalidChallenge: return "서버 보안 요청을 확인할 수 없습니다. 다시 시도해 주세요."
        case .missingEphemeralCredential: return "이 실행에서 등록한 신뢰 기기 정보가 없습니다. 기기를 다시 등록해 주세요."
        case .pushRegistrationFailed: return "APNs 기기 토큰을 발급받지 못했습니다."
        }
    }
}

struct LifecycleAttestationProof: Equatable {
    let deviceID: String
    let challengeID: String
    let keyID: String
    let attestationObject: String
}

struct LifecycleAssertionProof: Equatable {
    let challengeID: String
    let keyID: String
    let assertion: String
}

protocol AppAttestServicing: Sendable {
    var isSupported: Bool { get }
    func generateKey() async throws -> String
    func attestKey(_ keyID: String, clientDataHash: Data) async throws -> Data
    func generateAssertion(_ keyID: String, clientDataHash: Data) async throws -> Data
}

struct SystemAppAttestService: AppAttestServicing {
    private let service = DCAppAttestService.shared
    var isSupported: Bool { service.isSupported }
    func generateKey() async throws -> String { try await service.generateKey() }
    func attestKey(_ keyID: String, clientDataHash: Data) async throws -> Data {
        try await service.attestKey(keyID, clientDataHash: clientDataHash)
    }
    func generateAssertion(_ keyID: String, clientDataHash: Data) async throws -> Data {
        try await service.generateAssertion(keyID, clientDataHash: clientDataHash)
    }
}

protocol UserPresenceAuthorizing: Sendable {
    func authorize(reason: String) async throws
}

struct LocalUserPresenceAuthorizer: UserPresenceAuthorizing {
    func authorize(reason: String) async throws {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            throw LifecycleSecurityError.userPresenceUnavailable
        }
        guard try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) else {
            throw LifecycleSecurityError.userPresenceRejected
        }
    }
}

actor LifecycleCredentialProvider {
    static let shared = LifecycleCredentialProvider()
    private let appAttest: AppAttestServicing
    private let userPresence: UserPresenceAuthorizing
    private var keyID: String?
    private var deviceID: String?
    private var deviceToken: String?

    init(
        appAttest: AppAttestServicing = SystemAppAttestService(),
        userPresence: UserPresenceAuthorizing = LocalUserPresenceAuthorizer()
    ) {
        self.appAttest = appAttest
        self.userPresence = userPresence
    }

    func registrationProof(challenge: LiveAppAttestChallenge, deviceID: String) async throws -> LifecycleAttestationProof {
        guard appAttest.isSupported else { throw LifecycleSecurityError.appAttestUnavailable }
        try await userPresence.authorize(reason: "이 기기를 Ticketground 신뢰 기기로 등록합니다.")
        let keyID = try await appAttest.generateKey()
        let hash = try clientDataHash(challenge)
        let object = try await appAttest.attestKey(keyID, clientDataHash: hash)
        self.keyID = keyID
        self.deviceID = deviceID
        return LifecycleAttestationProof(
            deviceID: deviceID,
            challengeID: challenge.id,
            keyID: keyID,
            attestationObject: object.base64EncodedString()
        )
    }

    func bindDeviceToken(_ token: String) {
        deviceToken = token
    }

    func qrProof(challenge: LiveAppAttestChallenge) async throws -> (LifecycleAssertionProof, String, String) {
        guard appAttest.isSupported else { throw LifecycleSecurityError.appAttestUnavailable }
        guard let keyID, let deviceID, let deviceToken else { throw LifecycleSecurityError.missingEphemeralCredential }
        try await userPresence.authorize(reason: "입장 QR을 발급합니다.")
        let assertion = try await appAttest.generateAssertion(keyID, clientDataHash: try clientDataHash(challenge))
        return (
            LifecycleAssertionProof(challengeID: challenge.id, keyID: keyID, assertion: assertion.base64EncodedString()),
            deviceID,
            deviceToken
        )
    }

    func clear() {
        keyID = nil
        deviceID = nil
        deviceToken = nil
    }

    private func clientDataHash(_ challenge: LiveAppAttestChallenge) throws -> Data {
        guard let value = Data(base64Encoded: challenge.challenge), !value.isEmpty else {
            throw LifecycleSecurityError.invalidChallenge
        }
        return Data(SHA256.hash(data: value))
    }
}

@MainActor
final class PushRegistrationCoordinator {
    static let shared = PushRegistrationCoordinator()
    private var continuation: CheckedContinuation<Data, Error>?

    func requestToken() async throws -> Data {
        guard continuation == nil else { throw LifecycleSecurityError.pushRegistrationFailed }
        let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
        guard granted else { throw LifecycleSecurityError.pushRegistrationFailed }
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            UIApplication.shared.registerForRemoteNotifications()
        }
    }

    func didRegister(token: Data) {
        continuation?.resume(returning: token)
        continuation = nil
    }

    func didFail(error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }
}

final class TicketGroundAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { @MainActor in PushRegistrationCoordinator.shared.didRegister(token: deviceToken) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in PushRegistrationCoordinator.shared.didFail(error: error) }
    }
}
