import CryptoKit
import Foundation

enum SimulatorDeviceTrustError: Error {
    case unavailable
    case missingSecret
}

struct SimulatorDeviceTrustClient {
    static var isAvailable: Bool {
#if DEBUG && targetEnvironment(simulator)
        true
#else
        false
#endif
    }

    func proof(nonce: String, deviceID: String, counter: Int, secret: String?) throws -> String {
#if DEBUG && targetEnvironment(simulator)
        guard let secret, !secret.isEmpty else {
            throw SimulatorDeviceTrustError.missingSecret
        }
        let key = SymmetricKey(data: Data(secret.utf8))
        let message = Data("\(nonce):\(deviceID):\(counter)".utf8)
        return HMAC<SHA256>.authenticationCode(for: message, using: key)
            .map { String(format: "%02x", $0) }
            .joined()
#else
        throw SimulatorDeviceTrustError.unavailable
#endif
    }
}
