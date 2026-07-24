import Foundation
import SwiftUI
import UIKit

struct MediaResourceResolver {
    private let baseURL: URL?

    init(baseURL: URL? = nil) {
        self.baseURL = baseURL
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

        guard let components = URLComponents(string: trimmed) else { return nil }
        if components.scheme != nil {
            return validatedURL(from: components)
        }

        guard let baseURL,
              let baseComponents = URLComponents(url: baseURL, resolvingAgainstBaseURL: false),
              validatedURL(from: baseComponents) != nil,
              let resolvedURL = URL(string: trimmed, relativeTo: baseURL)?.absoluteURL,
              resolvedURL.host == baseURL.host else {
            return nil
        }
        return validatedURL(from: URLComponents(url: resolvedURL, resolvingAgainstBaseURL: false))
    }

    private func validatedURL(from components: URLComponents?) -> URL? {
        guard let components,
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host != nil,
              components.user == nil,
              components.password == nil else {
            return nil
        }
        return components.url
    }
}

enum TicketgroundImageRepositoryError: Error {
    case invalidResponse
    case invalidImage
}

actor TicketgroundImageRepository {
    static let shared = TicketgroundImageRepository()

    private let session: URLSession
    private var images: [URL: UIImage] = [:]

    init(session: URLSession = .shared) {
        self.session = session
    }

    func image(for url: URL) async throws -> UIImage {
        if let image = images[url] {
            return image
        }

        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            throw TicketgroundImageRepositoryError.invalidResponse
        }
        guard let image = UIImage(data: data) else {
            throw TicketgroundImageRepositoryError.invalidImage
        }
        images[url] = image
        return image
    }

    func cachedImage(for url: URL) -> UIImage? {
        images[url]
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
            if let localImage {
                imageView(localImage)
            } else if remoteURL == nil {
                fallback
            } else {
                remoteContent
            }
        }
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(currentAccessibilityLabel)
        .accessibilityIdentifier(currentIdentifier)
        .task(id: remoteURL) {
            guard localImage == nil, let remoteURL else { return }
            phase = .loading
            do {
                phase = .loaded(try await TicketgroundImageRepository.shared.image(for: remoteURL))
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

    private var remoteURL: URL? {
        MediaResourceResolver().resolve(resource)
    }

    private var localImage: UIImage? {
        guard let resource, !resource.isEmpty, remoteURL == nil else { return nil }
        if let image = UIImage(named: resource) {
            return image
        }

        let resourceURL = URL(fileURLWithPath: resource)
        let name = resourceURL.deletingPathExtension().lastPathComponent
        let extensions = resourceURL.pathExtension.isEmpty
            ? ["jpg", "png", "gif"]
            : [resourceURL.pathExtension]
        for fileExtension in extensions {
            if let path = Bundle.main.path(forResource: name, ofType: fileExtension),
               let image = UIImage(contentsOfFile: path) {
                return image
            }
        }
        return nil
    }

    private var isFallback: Bool {
        guard localImage == nil else { return false }
        if remoteURL == nil { return true }
        if case .failed = phase { return true }
        return false
    }

    private var currentIdentifier: String {
        if isFallback {
            return "media-fallback-\(role.identifier)"
        }
        if remoteURL != nil, case .loading = phase {
            return "media-loading-\(role.identifier)"
        }
        return "media-\(role.identifier)"
    }

    private var currentAccessibilityLabel: String {
        if isFallback {
            return "\(accessibilityLabel), \(role.fallbackTitle)"
        }
        if remoteURL != nil, case .loading = phase {
            return "\(accessibilityLabel) 불러오는 중"
        }
        return accessibilityLabel
    }

    private enum RemotePhase {
        case loading
        case loaded(UIImage)
        case failed
    }
}
