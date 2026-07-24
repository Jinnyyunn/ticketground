import Foundation
import SwiftUI
import UIKit

enum TicketgroundImageRepositoryError: Error {
    case invalidResponse
    case invalidImage
    case unapprovedRedirect
    case responseTooLarge
    case decodedImageTooLarge
}

actor TicketgroundImageRepository {
    struct Limits {
        let maxResponseBytes: Int
        let maxDecodedBytes: Int
        let maxCacheBytes: Int
        let maxCacheEntries: Int

        init(
            maxResponseBytes: Int = 4 * 1_024 * 1_024,
            maxDecodedBytes: Int = 32 * 1_024 * 1_024,
            maxCacheBytes: Int = 64 * 1_024 * 1_024,
            maxCacheEntries: Int = 32
        ) {
            self.maxResponseBytes = max(1, maxResponseBytes)
            self.maxDecodedBytes = max(1, maxDecodedBytes)
            self.maxCacheBytes = max(1, maxCacheBytes)
            self.maxCacheEntries = max(1, maxCacheEntries)
        }
    }

    static let shared = TicketgroundImageRepository(session: PublicMediaSessionFactory.make())
    static let defaultLimits = Limits()

    private let session: URLSession
    private let limits: Limits
    private var cache: [URL: CacheEntry] = [:]
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
        } else if let decoded = UIImage(data: data) {
            image = decoded
        } else {
            throw TicketgroundImageRepositoryError.invalidImage
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
            let width = frame.cgImage?.width ?? Int((frame.size.width * frame.scale).rounded(.up))
            let height = frame.cgImage?.height ?? Int((frame.size.height * frame.scale).rounded(.up))
            let (pixels, pixelOverflow) = width.multipliedReportingOverflow(by: height)
            let (bytes, byteOverflow) = pixels.multipliedReportingOverflow(by: 4)
            let (nextTotal, totalOverflow) = total.addingReportingOverflow(bytes)
            guard !pixelOverflow, !byteOverflow, !totalOverflow else {
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
    var contentMode: ContentMode = .fill

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
        .task(id: loadableSource) {
            guard localRasterImage == nil, let loadableSource else { return }
            phase = .loading
            do {
                switch loadableSource {
                case .remote(let url):
                    phase = .loaded(try await TicketgroundImageRepository.shared.image(for: url))
                case .localSVG(let url):
                    let document = try SafeSVGDocument(data: Data(contentsOf: url))
                    phase = .loaded(try await TicketgroundSVGRenderer().render(document))
                }
            } catch is CancellationError {
                return
            } catch {
                phase = .failed
            }
        }
    }

    @ViewBuilder
    private var remoteContent: some View {
        switch phase {
        case .loading:
            ProgressView()
                .controlSize(.regular)
                .tint(TicketgroundColor.accent)
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
        if isFallback {
            return "media-fallback-\(role.identifier)"
        }
        if loadableSource != nil, case .loading = phase {
            return "media-loading-\(role.identifier)"
        }
        return "media-\(role.identifier)"
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

    private enum RemotePhase {
        case loading
        case loaded(UIImage)
        case failed
    }

    private enum LoadableSource: Hashable {
        case remote(URL)
        case localSVG(URL)
    }
}
