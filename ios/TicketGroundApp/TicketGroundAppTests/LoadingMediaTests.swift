import XCTest
@testable import TicketGroundApp

private final class MediaURLProtocol: URLProtocol {
    static var data = Data()
    static var statusCode = 200
    static var requestCount = 0

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requestCount += 1
        guard let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://media.ticketground.test")!,
            statusCode: Self.statusCode,
            httpVersion: nil,
            headerFields: ["Content-Type": "image/png"]
        ) else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class LoadingMediaTests: XCTestCase {
    func testMediaResolverAcceptsSafeAbsoluteAndRelativeURLs() throws {
        let resolver = MediaResourceResolver(
            baseURL: URL(string: "https://media.ticketground.test/assets/")!
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
    }

    func testImageRepositoryCachesOnlySuccessfulDecodedImages() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let repository = TicketgroundImageRepository(session: URLSession(configuration: configuration))
        let url = URL(string: "https://media.ticketground.test/poster.png")!

        MediaURLProtocol.requestCount = 0
        MediaURLProtocol.statusCode = 200
        MediaURLProtocol.data = Self.onePixelPNG

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

        MediaURLProtocol.requestCount = 0
        MediaURLProtocol.statusCode = 503
        MediaURLProtocol.data = Data()

        do {
            _ = try await repository.image(for: url)
            XCTFail("Expected the unreachable resource to fail")
        } catch {}

        let failedCacheEntry = await repository.cachedImage(for: url)
        XCTAssertNil(failedCacheEntry)

        MediaURLProtocol.statusCode = 200
        MediaURLProtocol.data = Self.onePixelPNG
        _ = try await repository.image(for: url)

        XCTAssertEqual(MediaURLProtocol.requestCount, 2)
    }

    private static let onePixelPNG = Data(base64Encoded:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )!
}
