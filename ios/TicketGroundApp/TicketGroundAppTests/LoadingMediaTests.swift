import XCTest
@testable import TicketGroundApp

private final class MediaURLProtocol: URLProtocol {
    struct Stub {
        let data: Data
        let statusCode: Int
        let contentType: String
    }

    static var stubs: [String: Stub] = [:]
    static var requestCount = 0
    static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestCount += 1
        Self.requests.append(request)
        let stub = Self.stubs[request.url?.path ?? ""] ?? Stub(
            data: Data(),
            statusCode: 404,
            contentType: "application/octet-stream"
        )
        guard let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://media.ticketground.test")!,
            statusCode: stub.statusCode,
            httpVersion: nil,
            headerFields: [
                "Content-Type": stub.contentType,
                "Content-Length": "\(stub.data.count)"
            ]
        ) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: stub.data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class LoadingMediaTests: XCTestCase {
    override func setUp() {
        super.setUp()
        MediaURLProtocol.stubs = [:]
        MediaURLProtocol.requestCount = 0
        MediaURLProtocol.requests = []
    }

    func testMediaResolverAcceptsSafeAbsoluteAndRelativeURLs() throws {
        let cdnURL = URL(string: "https://cdn.ticketground.test/")!
        let resolver = MediaResourceResolver(
            baseURL: URL(string: "https://media.ticketground.test/assets/")!,
            approvedOrigins: [cdnURL]
        )

        XCTAssertEqual(
            resolver.resolve("https://cdn.ticketground.test/posters/show.jpg")?.absoluteString,
            "https://cdn.ticketground.test/posters/show.jpg"
        )
        XCTAssertEqual(
            resolver.resolve("/posters/show.jpg")?.absoluteString,
            "https://media.ticketground.test/posters/show.jpg"
        )
        XCTAssertEqual(
            resolver.resolve("seat-maps/main.png")?.absoluteString,
            "https://media.ticketground.test/assets/seat-maps/main.png"
        )
    }

    func testMediaResolverRejectsMissingUnsafeAndEscapingReferences() throws {
        let resolver = MediaResourceResolver(
            baseURL: URL(string: "https://media.ticketground.test/assets/")!
        )

        XCTAssertNil(resolver.resolve(nil))
        XCTAssertNil(resolver.resolve("   "))
        XCTAssertNil(resolver.resolve("javascript:alert(1)"))
        XCTAssertNil(resolver.resolve("file:///tmp/poster.jpg"))
        XCTAssertNil(resolver.resolve("//other-origin.test/poster.jpg"))
        XCTAssertNil(resolver.resolve("../private/poster.jpg"))
        XCTAssertNil(resolver.resolve("poster image.jpg"))
        XCTAssertNil(resolver.resolve("https://unapproved.ticketground.test/poster.jpg"))
        XCTAssertNil(resolver.resolve("http://media.ticketground.test/poster.jpg"))
    }

    func testPublicMediaSessionHasNoCookieCredentialOrCacheStorage() {
        let configuration = PublicMediaSessionConfiguration.make()

        XCTAssertNil(configuration.httpCookieStorage)
        XCTAssertNil(configuration.urlCredentialStorage)
        XCTAssertNil(configuration.urlCache)
        XCTAssertFalse(configuration.httpShouldSetCookies)
        XCTAssertEqual(configuration.requestCachePolicy, .reloadIgnoringLocalCacheData)
    }

    func testRedirectPolicyAllowsOnlySameOriginAndStripsCredentialHeaders() throws {
        let source = URL(string: "https://media.ticketground.test/poster.jpg")!
        var sameOrigin = URLRequest(url: URL(string: "https://media.ticketground.test/final.jpg")!)
        sameOrigin.setValue("secret", forHTTPHeaderField: "Authorization")
        sameOrigin.setValue("session=value", forHTTPHeaderField: "Cookie")

        let sanitized = try XCTUnwrap(
            PublicMediaRedirectPolicy.redirectedRequest(from: source, to: sameOrigin)
        )
        XCTAssertNil(sanitized.value(forHTTPHeaderField: "Authorization"))
        XCTAssertNil(sanitized.value(forHTTPHeaderField: "Cookie"))
        XCTAssertFalse(sanitized.httpShouldHandleCookies)

        let crossOrigin = URLRequest(url: URL(string: "https://other.ticketground.test/final.jpg")!)
        XCTAssertNil(PublicMediaRedirectPolicy.redirectedRequest(from: source, to: crossOrigin))
    }

    func testImageRepositoryCachesOnlySuccessfulDecodedImages() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let repository = TicketgroundImageRepository(session: URLSession(configuration: configuration))
        let url = URL(string: "https://media.ticketground.test/poster.png")!

        MediaURLProtocol.stubs[url.path] = .init(
            data: Self.onePixelPNG,
            statusCode: 200,
            contentType: "image/png"
        )

        _ = try await repository.image(for: url)
        _ = try await repository.image(for: url)

        XCTAssertEqual(MediaURLProtocol.requestCount, 1)
        let cachedImage = await repository.cachedImage(for: url)
        XCTAssertNotNil(cachedImage)
    }

    func testImageRepositoryDoesNotCacheOfflineFailure() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let repository = TicketgroundImageRepository(session: URLSession(configuration: configuration))
        let url = URL(string: "https://media.ticketground.test/offline.png")!

        MediaURLProtocol.stubs[url.path] = .init(
            data: Data(),
            statusCode: 503,
            contentType: "image/png"
        )

        do {
            _ = try await repository.image(for: url)
            XCTFail("Expected the unreachable resource to fail")
        } catch {}

        let failedCacheEntry = await repository.cachedImage(for: url)
        XCTAssertNil(failedCacheEntry)

        MediaURLProtocol.stubs[url.path] = .init(
            data: Self.onePixelPNG,
            statusCode: 200,
            contentType: "image/png"
        )
        _ = try await repository.image(for: url)

        XCTAssertEqual(MediaURLProtocol.requestCount, 2)
    }

    func testSVGSeatMapRendersAndCorruptedSVGFailsWithoutCaching() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let repository = TicketgroundImageRepository(session: URLSession(configuration: configuration))
        let validURL = URL(string: "https://media.ticketground.test/assets/map.svg")!
        let corruptURL = URL(string: "https://media.ticketground.test/assets/corrupt.svg")!
        MediaURLProtocol.stubs = [
            validURL.path: .init(data: Self.validSVG, statusCode: 200, contentType: "image/svg+xml"),
            corruptURL.path: .init(data: Data("<svg><path></svg>".utf8), statusCode: 200, contentType: "image/svg+xml")
        ]

        let rendered = try await repository.image(for: validURL)
        XCTAssertGreaterThan(rendered.size.width, 0)
        XCTAssertGreaterThan(rendered.size.height, 0)
        XCTAssertTrue(Self.containsVisiblePixel(rendered))
        let cachedSVG = await repository.cachedImage(for: validURL)
        XCTAssertNotNil(cachedSVG)

        do {
            _ = try await repository.image(for: corruptURL)
            XCTFail("Expected corrupted SVG to fail")
        } catch {}
        let corruptCache = await repository.cachedImage(for: corruptURL)
        XCTAssertNil(corruptCache)
    }

    func testResponseDecodeAndCacheBoundsAreEnforced() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let repository = TicketgroundImageRepository(
            session: URLSession(configuration: configuration),
            limits: .init(
                maxResponseBytes: Self.onePixelPNG.count,
                maxDecodedBytes: 16,
                maxCacheBytes: 4,
                maxCacheEntries: 1
            )
        )
        let firstURL = URL(string: "https://media.ticketground.test/first.png")!
        let secondURL = URL(string: "https://media.ticketground.test/second.png")!
        let oversizedURL = URL(string: "https://media.ticketground.test/oversized.png")!
        MediaURLProtocol.stubs = [
            firstURL.path: .init(data: Self.onePixelPNG, statusCode: 200, contentType: "image/png"),
            secondURL.path: .init(data: Self.onePixelPNG, statusCode: 200, contentType: "image/png"),
            oversizedURL.path: .init(data: Self.onePixelPNG + Data([0]), statusCode: 200, contentType: "image/png")
        ]

        _ = try await repository.image(for: firstURL)
        _ = try await repository.image(for: secondURL)
        let evictedFirst = await repository.cachedImage(for: firstURL)
        let cachedSecond = await repository.cachedImage(for: secondURL)
        XCTAssertNil(evictedFirst)
        XCTAssertNotNil(cachedSecond)

        do {
            _ = try await repository.image(for: oversizedURL)
            XCTFail("Expected oversized response to fail")
        } catch {}
        let oversizedCache = await repository.cachedImage(for: oversizedURL)
        XCTAssertNil(oversizedCache)

        let decodedBoundRepository = TicketgroundImageRepository(
            session: URLSession(configuration: configuration),
            limits: .init(maxDecodedBytes: 3)
        )
        do {
            _ = try await decodedBoundRepository.image(for: firstURL)
            XCTFail("Expected decoded image bound to reject the image")
        } catch {}
        let decodedBoundCache = await decodedBoundRepository.cachedImage(for: firstURL)
        XCTAssertNil(decodedBoundCache)
    }

    func testRepositoryRequestsNeverCarryCookieOrAuthorizationHeaders() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let repository = TicketgroundImageRepository(session: URLSession(configuration: configuration))
        let url = URL(string: "https://media.ticketground.test/public.png")!
        MediaURLProtocol.stubs[url.path] = .init(data: Self.onePixelPNG, statusCode: 200, contentType: "image/png")

        _ = try await repository.image(for: url)

        let request = try XCTUnwrap(MediaURLProtocol.requests.first)
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
        XCTAssertNil(request.value(forHTTPHeaderField: "Cookie"))
        XCTAssertFalse(request.httpShouldHandleCookies)
    }

    private static let onePixelPNG = Data(base64Encoded:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )!

    private static let validSVG = Data(#"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
      <rect width="320" height="180" rx="16" fill="#f4f4f5"/>
      <path d="M40 140 L160 40 L280 140 Z" fill="#ff334d"/>
      <circle cx="160" cy="104" r="24" fill="#ffffff"/>
    </svg>
    """#.utf8)

    private static func containsVisiblePixel(_ image: UIImage) -> Bool {
        guard let cgImage = image.cgImage else { return false }
        let width = cgImage.width
        let height = cgImage.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return false
        }
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return stride(from: 0, to: pixels.count, by: 4).contains { index in
            pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)
        }
    }
}
