import Foundation

enum VirtualFixtureDecodeError: Error, Equatable {
    case malformedJSON
    case unknownKey(String)
    case nullRequiredField(String)
    case emptyResponse
    case unauthorized
    case invalidResponse
}

enum VirtualFixtureDecoder {
    static func decode<T: Decodable>(_ data: Data, as type: T.Type) throws -> T {
        guard !data.isEmpty else { throw VirtualFixtureDecodeError.emptyResponse }
        guard let object = try? JSONSerialization.jsonObject(with: data),
              let envelope = object as? [String: Any] else {
            throw VirtualFixtureDecodeError.malformedJSON
        }

        let allowedKeys: Set<String> = [
            "contractId", "fixtureId", "mode", "source", "live", "deterministic", "status", "body"
        ]
        if let key = envelope.keys.first(where: { !allowedKeys.contains($0) }) {
            throw VirtualFixtureDecodeError.unknownKey(key)
        }
        guard let body = envelope["body"] else {
            throw VirtualFixtureDecodeError.nullRequiredField("body")
        }
        guard !(body is NSNull) else {
            throw VirtualFixtureDecodeError.nullRequiredField("body")
        }
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw VirtualFixtureDecodeError.invalidResponse
        }
    }

    static func decodeUnauthorized() throws -> Never {
        throw VirtualFixtureDecodeError.unauthorized
    }
}
