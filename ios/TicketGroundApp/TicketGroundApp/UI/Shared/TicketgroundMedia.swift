import Foundation
import ImageIO
import SwiftUI
import UIKit

enum TicketgroundImageRepositoryError: Error {
    case invalidResponse
    case invalidImage
    case unapprovedRedirect
    case responseTooLarge
    case decodedImageTooLarge
}

enum BoundedRasterImageDecoder {
    struct Metadata: Equatable {
        let frameCount: Int
        let decodedByteCount: Int
    }

    private struct PreparedFrames {
        let images: [CGImage]
        let metadata: Metadata
    }

    static func metadata(
        for data: Data,
        maxDecodedBytes: Int,
        maxFrameCount: Int,
        thumbnailCreationObserver: (() -> Void)? = nil
    ) throws -> Metadata {
        guard let source = CGImageSourceCreateWithData(
            data as CFData,
            [kCGImageSourceShouldCache: false] as CFDictionary
        ) else {
            throw TicketgroundImageRepositoryError.invalidImage
        }
        return try prepareFrames(
            for: source,
            maxDecodedBytes: maxDecodedBytes,
            maxFrameCount: maxFrameCount,
            thumbnailCreationObserver: thumbnailCreationObserver
        ).metadata
    }

    static func decode(
        _ data: Data,
        maxDecodedBytes: Int,
        maxFrameCount: Int
    ) throws -> UIImage {
        guard let source = CGImageSourceCreateWithData(
            data as CFData,
            [kCGImageSourceShouldCache: false] as CFDictionary
        ) else {
            throw TicketgroundImageRepositoryError.invalidImage
        }
        let prepared = try prepareFrames(
            for: source,
            maxDecodedBytes: maxDecodedBytes,
            maxFrameCount: maxFrameCount,
            thumbnailCreationObserver: nil
        )

        var frames: [UIImage] = []
        frames.reserveCapacity(prepared.metadata.frameCount)
        var duration: TimeInterval = 0
        for (index, image) in prepared.images.enumerated() {
            frames.append(UIImage(cgImage: image))
            duration += frameDuration(of: source, at: index)
        }

        guard let first = frames.first else {
            throw TicketgroundImageRepositoryError.invalidImage
        }
        if frames.count == 1 {
            return first
        }
        guard let animated = UIImage.animatedImage(with: frames, duration: duration) else {
            throw TicketgroundImageRepositoryError.invalidImage
        }
        return animated
    }

    private static func prepareFrames(
        for source: CGImageSource,
        maxDecodedBytes: Int,
        maxFrameCount: Int,
        thumbnailCreationObserver: (() -> Void)?
    ) throws -> PreparedFrames {
        let frameCount = CGImageSourceGetCount(source)
        guard maxDecodedBytes > 0,
              maxFrameCount > 0,
              frameCount > 0,
              frameCount <= maxFrameCount else {
            throw TicketgroundImageRepositoryError.decodedImageTooLarge
        }
        let thumbnailMaxPixelSizes = try preflightThumbnailSizes(
            for: source,
            frameCount: frameCount,
            maxDecodedBytes: maxDecodedBytes
        )

        var images: [CGImage] = []
        images.reserveCapacity(frameCount)
        var decodedByteCount = 0
        for (index, maxPixelSize) in thumbnailMaxPixelSizes.enumerated() {
            let image = try lazyThumbnail(
                of: source,
                at: index,
                maxPixelSize: maxPixelSize,
                creationObserver: thumbnailCreationObserver
            )
            guard image.width > 0,
                  image.height > 0,
                  image.bytesPerRow > 0 else {
                throw TicketgroundImageRepositoryError.invalidImage
            }
            let (outputBytes, outputOverflow) = image.bytesPerRow.multipliedReportingOverflow(by: image.height)
            let (pixelCount, pixelOverflow) = image.width.multipliedReportingOverflow(by: image.height)
            let (rgbaBytes, rgbaOverflow) = pixelCount.multipliedReportingOverflow(by: 4)
            let frameBytes = max(outputBytes, rgbaBytes)
            let (totalBytes, totalOverflow) = decodedByteCount.addingReportingOverflow(frameBytes)
            guard !outputOverflow,
                  !pixelOverflow,
                  !rgbaOverflow,
                  !totalOverflow,
                  totalBytes <= maxDecodedBytes else {
                throw TicketgroundImageRepositoryError.decodedImageTooLarge
            }
            images.append(image)
            decodedByteCount = totalBytes
        }
        return PreparedFrames(
            images: images,
            metadata: Metadata(frameCount: frameCount, decodedByteCount: decodedByteCount)
        )
    }

    private static func preflightThumbnailSizes(
        for source: CGImageSource,
        frameCount: Int,
        maxDecodedBytes: Int
    ) throws -> [Int] {
        var maxPixelSizes: [Int] = []
        maxPixelSizes.reserveCapacity(frameCount)
        var totalRGBABytes = 0
        for index in 0..<frameCount {
            guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
                  let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue,
                  let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue,
                  width > 0,
                  height > 0 else {
                throw TicketgroundImageRepositoryError.invalidImage
            }
            let (pixelCount, pixelOverflow) = width.multipliedReportingOverflow(by: height)
            let (rgbaBytes, rgbaOverflow) = pixelCount.multipliedReportingOverflow(by: 4)
            let (nextTotal, totalOverflow) = totalRGBABytes.addingReportingOverflow(rgbaBytes)
            guard !pixelOverflow,
                  !rgbaOverflow,
                  !totalOverflow,
                  nextTotal <= maxDecodedBytes else {
                throw TicketgroundImageRepositoryError.decodedImageTooLarge
            }
            maxPixelSizes.append(max(width, height))
            totalRGBABytes = nextTotal
        }
        return maxPixelSizes
    }

    private static func lazyThumbnail(
        of source: CGImageSource,
        at index: Int,
        maxPixelSize: Int,
        creationObserver: (() -> Void)?
    ) throws -> CGImage {
        let options = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
            kCGImageSourceShouldCache: false,
            kCGImageSourceShouldCacheImmediately: false
        ] as CFDictionary
        creationObserver?()
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, index, options) else {
            throw TicketgroundImageRepositoryError.invalidImage
        }
        return image
    }

    private static func frameDuration(of source: CGImageSource, at index: Int) -> TimeInterval {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
              let gif = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any] else {
            return 0.1
        }
        let duration = (gif[kCGImagePropertyGIFUnclampedDelayTime] as? NSNumber)?.doubleValue
            ?? (gif[kCGImagePropertyGIFDelayTime] as? NSNumber)?.doubleValue
            ?? 0.1
        return max(duration, 0.02)
    }
}

actor TicketgroundImageRepository {
    struct Limits {
        let maxResponseBytes: Int
        let maxDecodedBytes: Int
        let maxCacheBytes: Int
        let maxCacheEntries: Int
        let maxFrameCount: Int

        init(
            maxResponseBytes: Int = 4 * 1_024 * 1_024,
            maxDecodedBytes: Int = 32 * 1_024 * 1_024,
            maxCacheBytes: Int = 64 * 1_024 * 1_024,
            maxCacheEntries: Int = 32,
            maxFrameCount: Int = 60
        ) {
            self.maxResponseBytes = max(1, maxResponseBytes)
            self.maxDecodedBytes = max(1, maxDecodedBytes)
            self.maxCacheBytes = max(1, maxCacheBytes)
            self.maxCacheEntries = max(1, maxCacheEntries)
            self.maxFrameCount = max(1, maxFrameCount)
        }
    }

    static let shared = TicketgroundImageRepository(session: PublicMediaSessionFactory.make())
    static let defaultLimits = Limits()

    private let session: URLSession
    private let limits: Limits
    private var cache: [URL: CacheEntry] = [:]
    private var inFlight: [URL: Task<UIImage, Error>] = [:]
    private var cacheOrder: [URL] = []
    private var cacheBytes = 0

    init(session: URLSession = PublicMediaSessionFactory.make(), limits: Limits = defaultLimits) {
        self.session = session
        self.limits = limits
    }

    func image(for url: URL) async throws -> UIImage {
        if let cached = cache[url] {
            touch(url)
            return cached.image
        }
        if let request = inFlight[url] {
            return try await request.value
        }

        let request = Task {
            try await downloadImage(for: url)
        }
        inFlight[url] = request
        do {
            let image = try await request.value
            inFlight[url] = nil
            return image
        } catch {
            inFlight[url] = nil
            throw error
        }
    }

    private func downloadImage(for url: URL) async throws -> UIImage {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
        request.httpShouldHandleCookies = false
        request.setValue(nil, forHTTPHeaderField: "Authorization")
        request.setValue(nil, forHTTPHeaderField: "Proxy-Authorization")
        request.setValue(nil, forHTTPHeaderField: "Cookie")

        let (bytes, response) = try await session.bytes(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw TicketgroundImageRepositoryError.invalidResponse
        }
        guard let responseURL = httpResponse.url,
              PublicMediaOrigin(url: responseURL) == PublicMediaOrigin(url: url) else {
            throw TicketgroundImageRepositoryError.unapprovedRedirect
        }
        if response.expectedContentLength > limits.maxResponseBytes {
            throw TicketgroundImageRepositoryError.responseTooLarge
        }

        var data = Data()
        if response.expectedContentLength > 0 {
            data.reserveCapacity(min(Int(response.expectedContentLength), limits.maxResponseBytes))
        }
        for try await byte in bytes {
            guard data.count < limits.maxResponseBytes else {
                throw TicketgroundImageRepositoryError.responseTooLarge
            }
            data.append(byte)
        }

        let image: UIImage
        if isSVG(response: httpResponse, url: url) {
            do {
                let document = try SafeSVGDocument(data: data)
                image = try await TicketgroundSVGRenderer().render(document)
            } catch {
                throw TicketgroundImageRepositoryError.invalidImage
            }
        } else {
            image = try BoundedRasterImageDecoder.decode(
                data,
                maxDecodedBytes: limits.maxDecodedBytes,
                maxFrameCount: limits.maxFrameCount
            )
        }

        let decodedBytes = try decodedByteCost(of: image)
        guard decodedBytes <= limits.maxDecodedBytes else {
            throw TicketgroundImageRepositoryError.decodedImageTooLarge
        }
        insert(image, for: url, cost: decodedBytes)
        return image
    }

    func cachedImage(for url: URL) -> UIImage? {
        guard let entry = cache[url] else { return nil }
        touch(url)
        return entry.image
    }

    private func isSVG(response: HTTPURLResponse, url: URL) -> Bool {
        response.mimeType?.lowercased() == "image/svg+xml" || url.pathExtension.lowercased() == "svg"
    }

    private func decodedByteCost(of image: UIImage) throws -> Int {
        let frames = image.images ?? [image]
        var total = 0
        for frame in frames {
            guard let cgImage = frame.cgImage else {
                throw TicketgroundImageRepositoryError.invalidImage
            }
            let (bytes, byteOverflow) = cgImage.bytesPerRow.multipliedReportingOverflow(by: cgImage.height)
            let (nextTotal, totalOverflow) = total.addingReportingOverflow(bytes)
            guard !byteOverflow, !totalOverflow else {
                throw TicketgroundImageRepositoryError.decodedImageTooLarge
            }
            total = nextTotal
        }
        return total
    }

    private func insert(_ image: UIImage, for url: URL, cost: Int) {
        guard cost <= limits.maxCacheBytes else { return }
        if let existing = cache.removeValue(forKey: url) {
            cacheBytes -= existing.cost
            cacheOrder.removeAll { $0 == url }
        }
        cache[url] = CacheEntry(image: image, cost: cost)
        cacheOrder.append(url)
        cacheBytes += cost

        while cache.count > limits.maxCacheEntries || cacheBytes > limits.maxCacheBytes {
            guard let oldest = cacheOrder.first else { break }
            cacheOrder.removeFirst()
            if let removed = cache.removeValue(forKey: oldest) {
                cacheBytes -= removed.cost
            }
        }
    }

    private func touch(_ url: URL) {
        cacheOrder.removeAll { $0 == url }
        cacheOrder.append(url)
    }

    private struct CacheEntry {
        let image: UIImage
        let cost: Int
    }
}

enum TicketgroundMediaRole {
    case featured
    case poster
    case seatMap

    fileprivate var identifier: String {
        switch self {
        case .featured: return "featured"
        case .poster: return "poster"
        case .seatMap: return "seat-map"
        }
    }

    fileprivate var fallbackTitle: String {
        switch self {
        case .featured: return "공연 이미지 없음"
        case .poster: return "포스터 이미지 없음"
        case .seatMap: return "좌석 배치도 없음"
        }
    }

    fileprivate var systemImage: String {
        switch self {
        case .featured: return "photo"
        case .poster: return "ticket.fill"
        case .seatMap: return "square.grid.3x3"
        }
    }
}

struct TicketgroundMediaImage: View {
    let resource: String?
    let role: TicketgroundMediaRole
    let accessibilityLabel: String
    var accessibilitySuffix: String? = nil
    var contentMode: ContentMode = .fill
    /// Optional hook for callers that need to react when this view is
    /// showing (or stops showing) its own fallback state - e.g. to swap in a
    /// caller-specific placeholder instead of leaving this view's centered
    /// icon+caption fallback to render underneath other overlaid content.
    /// Fires once on appear and again whenever the fallback state changes.
    var onFallbackStateChange: ((Bool) -> Void)? = nil

    @State private var phase: RemotePhase = .loading

    var body: some View {
        ZStack {
            TicketgroundColor.surfaceRaised
            if let localRasterImage {
                imageView(localRasterImage)
            } else if loadableSource == nil {
                fallback
            } else {
                remoteContent
            }
        }
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(currentAccessibilityLabel)
        .accessibilityIdentifier(currentIdentifier)
        .onAppear { onFallbackStateChange?(isFallback) }
        .onChange(of: phase) { _, _ in onFallbackStateChange?(isFallback) }
        .task(id: loadableSource) {
            guard localRasterImage == nil, let loadableSource else { return }
            phase = .loading
            do {
                let image: UIImage
                switch loadableSource {
                case .remote(let url):
                    image = try await TicketgroundImageRepository.shared.image(for: url)
                case .localSVG(let url):
                    let document = try SafeSVGDocument(data: Data(contentsOf: url))
                    image = try await TicketgroundSVGRenderer().render(document)
                }
                try Task.checkCancellation()
                guard self.loadableSource == loadableSource else { return }
                phase = .loaded(image)
            } catch is CancellationError {
                return
            } catch {
                guard !Task.isCancelled, self.loadableSource == loadableSource else { return }
                phase = .failed
            }
        }
    }

    @ViewBuilder
    private var remoteContent: some View {
        switch phase {
        case .loading:
            // Skeleton placeholder shaped like the media slot itself, instead
            // of a spinner — the surrounding ZStack already fills this frame
            // with `TicketgroundColor.surfaceRaised`, so redacting a shape
            // sized to the destination keeps the loading state looking like
            // the image that is about to appear.
            RoundedRectangle(cornerRadius: TicketgroundRadius.small)
                .fill(TicketgroundColor.surfaceRaised)
                .redacted(reason: .placeholder)
                .accessibilityHidden(true)
        case .loaded(let image):
            imageView(image)
        case .failed:
            fallback
        }
    }

    private func imageView(_ image: UIImage) -> some View {
        Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: contentMode)
    }

    private var fallback: some View {
        VStack(spacing: TicketgroundSpacing.xs) {
            Image(systemName: role.systemImage)
                .font(.title2)
                .foregroundStyle(TicketgroundColor.accent)
            Text(role.fallbackTitle)
                .font(.caption.weight(.bold))
                .foregroundStyle(TicketgroundColor.inkMuted)
                .multilineTextAlignment(.center)
        }
        .padding(TicketgroundSpacing.sm)
    }

    private var loadableSource: LoadableSource? {
        if let remoteURL = PublicMediaURLValidator.absoluteURL(from: resource) {
            return .remote(remoteURL)
        }
        if let localResourceURL, localResourceURL.pathExtension.lowercased() == "svg" {
            return .localSVG(localResourceURL)
        }
        return nil
    }

    private var localRasterImage: UIImage? {
        guard let resource, !resource.isEmpty,
              PublicMediaURLValidator.absoluteURL(from: resource) == nil,
              localResourceURL?.pathExtension.lowercased() != "svg" else {
            return nil
        }
        if let image = UIImage(named: resource) {
            return image
        }

        guard let localResourceURL else { return nil }
        return UIImage(contentsOfFile: localResourceURL.path)
    }

    private var localResourceURL: URL? {
        guard let resource, !resource.isEmpty else { return nil }
        let resourceURL = URL(fileURLWithPath: resource)
        let name = resourceURL.deletingPathExtension().lastPathComponent
        let extensions = resourceURL.pathExtension.isEmpty ? ["jpg", "png", "gif", "svg"] : [resourceURL.pathExtension]
        for fileExtension in extensions {
            if let url = Bundle.main.url(forResource: name, withExtension: fileExtension) {
                return url
            }
        }
        return nil
    }

    private var isFallback: Bool {
        guard localRasterImage == nil else { return false }
        if loadableSource == nil { return true }
        if case .failed = phase { return true }
        return false
    }

    private var currentIdentifier: String {
        let suffix = accessibilitySuffix.map { "-\($0)" } ?? ""
        if isFallback {
            return "media-fallback-\(role.identifier)\(suffix)"
        }
        if loadableSource != nil, case .loading = phase {
            return "media-loading-\(role.identifier)\(suffix)"
        }
        return "media-\(role.identifier)\(suffix)"
    }

    private var currentAccessibilityLabel: String {
        if isFallback {
            return "\(accessibilityLabel), \(role.fallbackTitle)"
        }
        if loadableSource != nil, case .loading = phase {
            return "\(accessibilityLabel) 불러오는 중"
        }
        return accessibilityLabel
    }

    private enum RemotePhase: Equatable {
        case loading
        case loaded(UIImage)
        case failed

        // `UIImage` isn't `Equatable`, so this only distinguishes cases
        // (not individual images) - sufficient for driving `.onChange(of:)`,
        // which only needs to know when the phase transitions, e.g. into or
        // out of `.failed`.
        static func == (lhs: RemotePhase, rhs: RemotePhase) -> Bool {
            switch (lhs, rhs) {
            case (.loading, .loading), (.loaded, .loaded), (.failed, .failed):
                return true
            default:
                return false
            }
        }
    }

    private enum LoadableSource: Hashable {
        case remote(URL)
        case localSVG(URL)
    }
}
