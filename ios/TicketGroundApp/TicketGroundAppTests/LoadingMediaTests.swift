import ImageIO
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

private final class RedirectMediaURLProtocol: URLProtocol {
    static var destinationURL: URL?
    static var requests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.requests.append(request)
        guard request.url?.path == "/start", let destinationURL = Self.destinationURL else {
            guard let response = HTTPURLResponse(
                url: request.url ?? URL(string: "https://media.ticketground.test")!,
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "image/png"]
            ) else { return }
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: LoadingMediaTests.onePixelPNG)
            client?.urlProtocolDidFinishLoading(self)
            return
        }

        guard let response = HTTPURLResponse(
            url: request.url ?? URL(string: "https://media.ticketground.test/start")!,
            statusCode: 302,
            httpVersion: nil,
            headerFields: ["Location": destinationURL.absoluteString]
        ) else { return }
        var redirectRequest = URLRequest(url: destinationURL)
        redirectRequest.setValue("secret", forHTTPHeaderField: "Authorization")
        redirectRequest.setValue("session=value", forHTTPHeaderField: "Cookie")
        client?.urlProtocol(self, wasRedirectedTo: redirectRequest, redirectResponse: response)
    }

    override func stopLoading() {}
}

final class LoadingMediaTests: XCTestCase {
    override func setUp() {
        super.setUp()
        MediaURLProtocol.stubs = [:]
        MediaURLProtocol.requestCount = 0
        MediaURLProtocol.requests = []
        RedirectMediaURLProtocol.destinationURL = nil
        RedirectMediaURLProtocol.requests = []
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

    func testPublicMediaSessionEnforcesRedirectPolicyOnActualRequests() async throws {
        let configuration = PublicMediaSessionConfiguration.make()
        configuration.protocolClasses = [RedirectMediaURLProtocol.self]
        configuration.timeoutIntervalForRequest = 1
        configuration.timeoutIntervalForResource = 1
        let session = PublicMediaSessionFactory.make(configuration: configuration)
        let sourceURL = URL(string: "https://media.ticketground.test/start")!

        RedirectMediaURLProtocol.destinationURL = URL(string: "https://media.ticketground.test/final.png")!
        let repository = TicketgroundImageRepository(session: session)
        _ = try await repository.image(for: sourceURL)

        XCTAssertEqual(RedirectMediaURLProtocol.requests.count, 2)
        let redirectedRequest = try XCTUnwrap(RedirectMediaURLProtocol.requests.last)
        XCTAssertNil(redirectedRequest.value(forHTTPHeaderField: "Authorization"))
        XCTAssertNil(redirectedRequest.value(forHTTPHeaderField: "Cookie"))
        XCTAssertFalse(redirectedRequest.httpShouldHandleCookies)
        XCTAssertNil(session.configuration.httpCookieStorage)
        XCTAssertNil(session.configuration.urlCredentialStorage)
        XCTAssertNil(session.configuration.urlCache)

        for blockedURL in [
            URL(string: "https://other.ticketground.test/final.png")!,
            URL(string: "https://media.ticketground.test:444/final.png")!,
            URL(string: "http://media.ticketground.test/final.png")!
        ] {
            RedirectMediaURLProtocol.requests = []
            RedirectMediaURLProtocol.destinationURL = blockedURL
            let blockedRepository = TicketgroundImageRepository(session: session)
            do {
                _ = try await blockedRepository.image(for: sourceURL)
                XCTFail("Expected redirect to \(blockedURL) to be blocked")
            } catch {}
            XCTAssertEqual(RedirectMediaURLProtocol.requests.count, 1)
        }
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
        let intrinsicURL = URL(string: "https://media.ticketground.test/assets/intrinsic.svg")!
        let corruptURL = URL(string: "https://media.ticketground.test/assets/corrupt.svg")!
        let caseCollisionURL = URL(string: "https://media.ticketground.test/assets/case-collision.svg")!
        let unsupportedSizeURL = URL(string: "https://media.ticketground.test/assets/unsupported-size.svg")!
        let blankURL = URL(string: "https://media.ticketground.test/assets/blank.svg")!
        MediaURLProtocol.stubs = [
            validURL.path: .init(data: Self.validSVG, statusCode: 200, contentType: "image/svg+xml"),
            intrinsicURL.path: .init(data: Self.intrinsicSVG, statusCode: 200, contentType: "image/svg+xml"),
            corruptURL.path: .init(data: Data("<svg><path></svg>".utf8), statusCode: 200, contentType: "image/svg+xml"),
            caseCollisionURL.path: .init(data: Self.caseCollisionSVG, statusCode: 200, contentType: "image/svg+xml"),
            unsupportedSizeURL.path: .init(data: Self.unsupportedSizeSVG, statusCode: 200, contentType: "image/svg+xml"),
            blankURL.path: .init(data: Self.blankSVG, statusCode: 200, contentType: "image/svg+xml")
        ]

        let rendered = try await repository.image(for: validURL)
        XCTAssertGreaterThan(rendered.size.width, 0)
        XCTAssertGreaterThan(rendered.size.height, 0)
        XCTAssertTrue(Self.containsVisiblePixel(rendered))
        let cachedSVG = await repository.cachedImage(for: validURL)
        XCTAssertNotNil(cachedSVG)

        let intrinsicRendered = try await repository.image(for: intrinsicURL)
        XCTAssertEqual(intrinsicRendered.size.width, 384, accuracy: 1)
        XCTAssertEqual(intrinsicRendered.size.height, 192, accuracy: 1)
        XCTAssertTrue(Self.containsVisiblePixel(intrinsicRendered))

        for rejectedURL in [corruptURL, caseCollisionURL, unsupportedSizeURL, blankURL] {
            do {
                _ = try await repository.image(for: rejectedURL)
                XCTFail("Expected \(rejectedURL.lastPathComponent) to fail")
            } catch {}
            let rejectedCache = await repository.cachedImage(for: rejectedURL)
            XCTAssertNil(rejectedCache)
        }
    }

    func testSVGWithoutViewBoxUsesIntrinsicDimensionsAndTimesOutSafely() async throws {
        let widthOnly = try SafeSVGDocument(data: Self.widthOnlySVG)
        XCTAssertEqual(widthOnly.renderSize.width, 640, accuracy: 0.01)
        XCTAssertEqual(widthOnly.renderSize.height, 150, accuracy: 0.01)

        let absoluteUnits = try SafeSVGDocument(data: Self.intrinsicSVG)
        XCTAssertEqual(absoluteUnits.renderSize.width, 384, accuracy: 0.01)
        XCTAssertEqual(absoluteUnits.renderSize.height, 192, accuracy: 0.01)
        XCTAssertThrowsError(try SafeSVGDocument(data: Self.unsupportedSizeSVG))

        do {
            _ = try await TicketgroundSVGRenderer().render(absoluteUnits, timeoutNanoseconds: 1)
            XCTFail("Expected SVG rasterization timeout")
        } catch TicketgroundSVGRendererError.timedOut {
        } catch {
            XCTFail("Unexpected timeout error: \(error)")
        }
    }

    func testRasterMetadataRejectsPixelAndFrameBombsBeforeDecode() async throws {
        XCTAssertLessThan(Self.compressedPixelBomb.count, 4_096)
        XCTAssertThrowsError(
            try BoundedRasterImageDecoder.metadata(
                for: Self.compressedPixelBomb,
                maxDecodedBytes: 32 * 1_024 * 1_024,
                maxFrameCount: 60
            )
        ) { error in
            guard case TicketgroundImageRepositoryError.decodedImageTooLarge = error else {
                return XCTFail("Unexpected pixel-bound error: \(error)")
            }
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let bombURL = URL(string: "https://media.ticketground.test/pixel-bomb.png")!
        MediaURLProtocol.stubs[bombURL.path] = .init(
            data: Self.compressedPixelBomb,
            statusCode: 200,
            contentType: "image/png"
        )
        let repository = TicketgroundImageRepository(
            session: URLSession(configuration: configuration),
            limits: .init(
                maxResponseBytes: 4_096,
                maxDecodedBytes: 32 * 1_024 * 1_024
            )
        )
        do {
            _ = try await repository.image(for: bombURL)
            XCTFail("Expected compressed pixel bomb to be rejected")
        } catch {}
        let cachedBomb = await repository.cachedImage(for: bombURL)
        XCTAssertNil(cachedBomb)

        let frameBomb = try XCTUnwrap(Self.animatedGIF(frameCount: 2))
        XCTAssertThrowsError(
            try BoundedRasterImageDecoder.metadata(
                for: frameBomb,
                maxDecodedBytes: 32,
                maxFrameCount: 1
            )
        ) { error in
            guard case TicketgroundImageRepositoryError.decodedImageTooLarge = error else {
                return XCTFail("Unexpected frame-bound error: \(error)")
            }
        }
    }

    func testNonByteAlignedAndHighBitDepthRasterUsesOutputLayoutCosts() async throws {
        let decoded = try BoundedRasterImageDecoder.decode(
            Self.highBitDepthPNG,
            maxDecodedBytes: 16,
            maxFrameCount: 1
        )
        let cgImage = try XCTUnwrap(decoded.cgImage)
        XCTAssertEqual(cgImage.bitsPerComponent, 16)
        XCTAssertEqual(cgImage.bytesPerRow * cgImage.height, 16)

        XCTAssertThrowsError(
            try BoundedRasterImageDecoder.metadata(
                for: Self.highBitDepthPNG,
                maxDecodedBytes: 15,
                maxFrameCount: 1
            )
        ) { error in
            guard case TicketgroundImageRepositoryError.decodedImageTooLarge = error else {
                return XCTFail("Unexpected high-bit-depth error: \(error)")
            }
        }
        let metadata = try BoundedRasterImageDecoder.metadata(
            for: Self.highBitDepthPNG,
            maxDecodedBytes: 16,
            maxFrameCount: 1
        )
        XCTAssertEqual(metadata.decodedByteCount, 16)

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let url = URL(string: "https://media.ticketground.test/high-bit-depth.png")!
        MediaURLProtocol.stubs[url.path] = .init(
            data: Self.highBitDepthPNG,
            statusCode: 200,
            contentType: "image/png"
        )
        let repository = TicketgroundImageRepository(
            session: URLSession(configuration: configuration),
            limits: .init(maxDecodedBytes: 15)
        )
        do {
            _ = try await repository.image(for: url)
            XCTFail("Expected high-bit-depth image to exceed the decode budget")
        } catch {}
        let cachedImage = await repository.cachedImage(for: url)
        XCTAssertNil(cachedImage)

        for (fixture, expectedDepth) in [(Self.tenBitRGBTIFF, 10), (Self.twelveBitRGBTIFF, 12)] {
            let source = try XCTUnwrap(CGImageSourceCreateWithData(fixture as CFData, nil))
            let properties = try XCTUnwrap(
                CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
            )
            XCTAssertEqual((properties[kCGImagePropertyDepth] as? NSNumber)?.intValue, expectedDepth)

            XCTAssertThrowsError(
                try BoundedRasterImageDecoder.metadata(
                    for: fixture,
                    maxDecodedBytes: 63,
                    maxFrameCount: 1
                )
            ) { error in
                guard case TicketgroundImageRepositoryError.decodedImageTooLarge = error else {
                    return XCTFail("Unexpected \(expectedDepth)-bit layout error: \(error)")
                }
            }

            let metadata = try BoundedRasterImageDecoder.metadata(
                for: fixture,
                maxDecodedBytes: 64,
                maxFrameCount: 1
            )
            XCTAssertEqual(metadata.decodedByteCount, 64)

            let decoded = try BoundedRasterImageDecoder.decode(
                fixture,
                maxDecodedBytes: 64,
                maxFrameCount: 1
            )
            let image = try XCTUnwrap(decoded.cgImage)
            XCTAssertEqual(image.bytesPerRow * image.height, 64)
        }

        let tenBitURL = URL(string: "https://media.ticketground.test/ten-bit.tiff")!
        MediaURLProtocol.stubs[tenBitURL.path] = .init(
            data: Self.tenBitRGBTIFF,
            statusCode: 200,
            contentType: "image/tiff"
        )
        let nonByteAlignedRepository = TicketgroundImageRepository(
            session: URLSession(configuration: configuration),
            limits: .init(maxDecodedBytes: 63)
        )
        do {
            _ = try await nonByteAlignedRepository.image(for: tenBitURL)
            XCTFail("Expected the padded 10-bit output layout to exceed the decode budget")
        } catch {}
        let cachedTenBitImage = await nonByteAlignedRepository.cachedImage(for: tenBitURL)
        XCTAssertNil(cachedTenBitImage)
    }

    func testResponseDecodeAndCacheBoundsAreEnforced() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MediaURLProtocol.self]
        let repository = TicketgroundImageRepository(
            session: URLSession(configuration: configuration),
            limits: .init(
                maxResponseBytes: Self.onePixelPNG.count,
                maxDecodedBytes: 16,
                maxCacheBytes: 16,
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

    fileprivate static let onePixelPNG = Data(base64Encoded:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )!

    private static let highBitDepthPNG = Data(base64Encoded:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABEAYAAABPhRjKAAAAEUlEQVR4nGNgYGRgYmD+/x8AAyACBS+HMtIAAAAASUVORK5CYII="
    )!

    private static let tenBitRGBTIFF = Data(base64Encoded:
        "SUkqAAgAAAAKAAABBAABAAAAAwAAAAEBBAABAAAAAgAAAAIBAwADAAAAhgAAAAMBAwABAAAAAQAAAAYBAwABAAAAAgAAABEBBAABAAAAjAAAABUBAwABAAAAAwAAABYBBAABAAAAAgAAABcBBAABAAAAGAAAABwBAwABAAAAAQAAAAAAAAAKAAoACgAAP/gBAMAED/wAgAAgGAEAAP/QDAIAIAA="
    )!

    private static let twelveBitRGBTIFF = Data(base64Encoded:
        "SUkqAAgAAAAKAAABBAABAAAAAwAAAAEBBAABAAAAAgAAAAIBAwADAAAAhgAAAAMBAwABAAAAAQAAAAYBAwABAAAAAgAAABEBBAABAAAAjAAAABUBAwABAAAAAwAAABYBBAABAAAAAgAAABcBBAABAAAAHAAAABwBAwABAAAAAQAAAAAAAAAMAAwADAAAD/+ABADAAQD/8ACAACAGABAAAP/0AMAIACAA"
    )!

    private static let compressedPixelBomb = Data(base64Encoded:
        "iVBORw0KGgoAAAANSUhEUgAAEAAAABAAAQAAAADa2Bm6AAAIC0lEQVR42u3BMQEAAADCoPVPbQo/oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAvgYR4AABQLeI0QAAAABJRU5ErkJggg=="
    )!

    private static let validSVG = Data(#"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
      <rect width="320" height="180" rx="16" fill="#f4f4f5"/>
      <path d="M40 140 L160 40 L280 140 Z" fill="#ff334d"/>
      <circle cx="160" cy="104" r="24" fill="#ffffff"/>
    </svg>
    """#.utf8)

    private static let intrinsicSVG = Data(#"""
    <svg xmlns="http://www.w3.org/2000/svg" width="4in" height="2in">
      <rect width="100%" height="100%" fill="#f4f4f5"/>
      <circle cx="192" cy="96" r="64" fill="#ff334d"/>
    </svg>
    """#.utf8)

    private static let widthOnlySVG = Data(#"""
    <svg xmlns="http://www.w3.org/2000/svg" width="640px">
      <rect width="640" height="150" fill="#ff334d"/>
    </svg>
    """#.utf8)

    private static let unsupportedSizeSVG = Data(#"""
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="auto">
      <rect width="100%" height="100%" fill="#ff334d"/>
    </svg>
    """#.utf8)

    private static let caseCollisionSVG = Data(#"""
    <svg xmlns="http://www.w3.org/2000/svg" width="640px" WIDTH="320px" height="360px">
      <rect width="640" height="360" fill="#ff334d"/>
    </svg>
    """#.utf8)

    private static let blankSVG = Data(#"""
    <svg xmlns="http://www.w3.org/2000/svg" width="320px" height="180px"></svg>
    """#.utf8)

    private static func animatedGIF(frameCount: Int) -> Data? {
        guard let image = UIImage(data: onePixelPNG)?.cgImage else { return nil }
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(
            data,
            "com.compuserve.gif" as CFString,
            frameCount,
            nil
        ) else { return nil }
        let properties = [
            kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 0.1]
        ] as CFDictionary
        for _ in 0..<frameCount {
            CGImageDestinationAddImage(destination, image, properties)
        }
        guard CGImageDestinationFinalize(destination) else { return nil }
        return data as Data
    }

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
