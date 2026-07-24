import Foundation

struct PublicMediaOrigin: Hashable {
    let scheme: String
    let host: String
    let port: Int

    init?(url: URL) {
        guard let scheme = url.scheme?.lowercased(),
              let host = url.host?.lowercased(),
              ["http", "https"].contains(scheme),
              url.user == nil,
              url.password == nil else {
            return nil
        }
        self.scheme = scheme
        self.host = host
        self.port = url.port ?? (scheme == "https" ? 443 : 80)
    }
}

enum PublicMediaURLValidator {
    static func absoluteURL(from value: String?) -> URL? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              trimmed.rangeOfCharacter(from: .whitespacesAndNewlines) == nil,
              !trimmed.hasPrefix("//"),
              !trimmed.contains("\\"),
              let components = URLComponents(string: trimmed),
              components.scheme != nil,
              let url = components.url,
              PublicMediaOrigin(url: url) != nil else {
            return nil
        }
        return url
    }
}

struct MediaResourceResolver {
    private let baseURL: URL?
    private let approvedOrigins: Set<PublicMediaOrigin>

    init(baseURL: URL? = nil, approvedOrigins: [URL] = []) {
        self.baseURL = baseURL
        self.approvedOrigins = Set(([baseURL].compactMap { $0 } + approvedOrigins).compactMap(PublicMediaOrigin.init))
    }

    func resolve(_ reference: String?) -> URL? {
        guard let reference else { return nil }
        let trimmed = reference.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              trimmed.rangeOfCharacter(from: .whitespacesAndNewlines) == nil,
              !trimmed.hasPrefix("//"),
              !trimmed.contains("\\") else {
            return nil
        }

        let decodedPath = trimmed.removingPercentEncoding ?? trimmed
        guard !decodedPath.split(separator: "/", omittingEmptySubsequences: false).contains("..") else {
            return nil
        }

        let resolvedURL: URL?
        if let absoluteURL = PublicMediaURLValidator.absoluteURL(from: trimmed) {
            resolvedURL = absoluteURL
        } else if let baseURL {
            resolvedURL = URL(string: trimmed, relativeTo: baseURL)?.absoluteURL
        } else {
            resolvedURL = nil
        }

        guard let resolvedURL,
              let origin = PublicMediaOrigin(url: resolvedURL),
              approvedOrigins.contains(origin) else {
            return nil
        }
        return resolvedURL
    }
}

enum PublicMediaSessionConfiguration {
    static func make() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.urlCredentialStorage = nil
        configuration.urlCache = nil
        configuration.httpShouldSetCookies = false
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 15
        configuration.timeoutIntervalForResource = 30
        configuration.httpAdditionalHeaders = [
            "Accept": "image/avif,image/webp,image/svg+xml,image/png,image/jpeg,image/gif",
            "Accept-Encoding": "identity"
        ]
        return configuration
    }
}

enum PublicMediaRedirectPolicy {
    static func redirectedRequest(from sourceURL: URL, to request: URLRequest) -> URLRequest? {
        guard let destinationURL = request.url,
              let sourceOrigin = PublicMediaOrigin(url: sourceURL),
              let destinationOrigin = PublicMediaOrigin(url: destinationURL),
              sourceOrigin == destinationOrigin else {
            return nil
        }

        var sanitized = request
        sanitized.setValue(nil, forHTTPHeaderField: "Authorization")
        sanitized.setValue(nil, forHTTPHeaderField: "Proxy-Authorization")
        sanitized.setValue(nil, forHTTPHeaderField: "Cookie")
        sanitized.httpShouldHandleCookies = false
        sanitized.cachePolicy = .reloadIgnoringLocalCacheData
        return sanitized
    }
}

final class PublicMediaSessionDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(
        _ session: URLSession,
        task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        guard let sourceURL = response.url else {
            completionHandler(nil)
            return
        }
        completionHandler(PublicMediaRedirectPolicy.redirectedRequest(from: sourceURL, to: request))
    }
}

enum PublicMediaSessionFactory {
    static func make(
        configuration: URLSessionConfiguration = PublicMediaSessionConfiguration.make()
    ) -> URLSession {
        URLSession(
            configuration: configuration,
            delegate: PublicMediaSessionDelegate(),
            delegateQueue: nil
        )
    }
}
