import Foundation
import UIKit
import WebKit

enum TicketgroundSVGRendererError: Error {
    case invalidDocument
    case renderFailed
    case timedOut
    case emptyOutput
}

struct SafeSVGDocument {
    let markup: String
    let renderSize: CGSize

    init(data: Data, maxDimension: CGFloat = 1_024) throws {
        guard let markup = String(data: data, encoding: .utf8) else {
            throw TicketgroundSVGRendererError.invalidDocument
        }
        let lowered = markup.lowercased()
        guard !lowered.contains("<!doctype"), !lowered.contains("<!entity") else {
            throw TicketgroundSVGRendererError.invalidDocument
        }

        let validator = SafeSVGValidator(maxDimension: maxDimension)
        let parser = XMLParser(data: data)
        parser.shouldProcessNamespaces = true
        parser.shouldResolveExternalEntities = false
        parser.delegate = validator
        guard parser.parse(), validator.isValid, let renderSize = validator.renderSize else {
            throw TicketgroundSVGRendererError.invalidDocument
        }
        self.markup = markup
        self.renderSize = renderSize
    }
}

private final class SafeSVGValidator: NSObject, XMLParserDelegate {
    private static let allowedElements: Set<String> = [
        "svg", "g", "defs", "desc", "title", "metadata", "path", "rect", "circle", "ellipse",
        "line", "polyline", "polygon", "text", "tspan", "lineargradient", "radialgradient", "stop",
        "clippath", "mask", "pattern", "symbol", "use", "style"
    ]

    private let maxDimension: CGFloat
    private var depth = 0
    private var elementCount = 0
    private var rootSeen = false
    private var invalid = false
    private var styleDepth: Int?
    private var styleContent = ""
    private(set) var renderSize: CGSize?

    var isValid: Bool {
        rootSeen && depth == 0 && !invalid
    }

    init(maxDimension: CGFloat) {
        self.maxDimension = maxDimension
    }

    func parser(
        _ parser: XMLParser,
        didStartElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?,
        attributes attributeDict: [String: String] = [:]
    ) {
        let name = elementName.lowercased()
        depth += 1
        elementCount += 1
        guard depth <= 128,
              elementCount <= 5_000,
              Self.allowedElements.contains(name) else {
            invalid = true
            return
        }
        if !rootSeen {
            rootSeen = true
            guard name == "svg" else {
                invalid = true
                return
            }
            guard let targetSize = targetSize(from: attributeDict) else {
                invalid = true
                return
            }
            renderSize = targetSize
        }
        if name == "style" {
            styleDepth = depth
            styleContent = ""
        }

        for (rawName, rawValue) in attributeDict {
            let attributeName = rawName.lowercased()
            let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if attributeName.hasPrefix("on") {
                invalid = true
            }
            if attributeName == "href" || attributeName.hasSuffix(":href") {
                if !value.hasPrefix("#") {
                    invalid = true
                }
            } else if containsExternalReference(value) {
                invalid = true
            }
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if styleDepth != nil {
            styleContent += string
        }
    }

    func parser(_ parser: XMLParser, foundCDATA CDATABlock: Data) {
        guard styleDepth != nil, let string = String(data: CDATABlock, encoding: .utf8) else { return }
        styleContent += string
    }

    func parser(
        _ parser: XMLParser,
        didEndElement elementName: String,
        namespaceURI: String?,
        qualifiedName qName: String?
    ) {
        if styleDepth == depth {
            let value = styleContent.lowercased()
            if containsExternalReference(value) || value.contains("@import") {
                invalid = true
            }
            styleDepth = nil
            styleContent = ""
        }
        depth -= 1
    }

    private func containsExternalReference(_ value: String) -> Bool {
        if value.contains("javascript:") || value.contains("http:") || value.contains("https:") ||
            value.contains("file:") || value.contains("data:") || value.contains("//") {
            return true
        }
        if value.contains("url(") && !value.contains("url(#") {
            return true
        }
        return false
    }

    private func targetSize(from attributes: [String: String]) -> CGSize? {
        var normalized: [String: String] = [:]
        for (name, value) in attributes {
            let normalizedName = name.lowercased()
            guard normalized[normalizedName] == nil else { return nil }
            normalized[normalizedName] = value
        }
        let aspectWidth: Double
        let aspectHeight: Double
        if let viewBoxValue = normalized["viewbox"] {
            let values = viewBoxValue
                .split(whereSeparator: { $0 == " " || $0 == "," })
                .compactMap { Double($0) }
            guard values.count == 4, values[2] > 0, values[3] > 0 else { return nil }
            aspectWidth = values[2]
            aspectHeight = values[3]
        } else {
            if let width = normalized["width"] {
                guard let parsedWidth = absolutePixels(width) else { return nil }
                aspectWidth = parsedWidth
            } else {
                aspectWidth = 300
            }
            if let height = normalized["height"] {
                guard let parsedHeight = absolutePixels(height) else { return nil }
                aspectHeight = parsedHeight
            } else {
                aspectHeight = 150
            }
        }
        let scale = min(maxDimension / aspectWidth, maxDimension / aspectHeight, 1)
        return CGSize(
            width: max(1, aspectWidth * scale),
            height: max(1, aspectHeight * scale)
        )
    }

    private func absolutePixels(_ rawValue: String) -> Double? {
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let unitless = Double(value), unitless > 0, unitless.isFinite {
            return unitless
        }
        let units: [(suffix: String, pixelsPerUnit: Double)] = [
            ("px", 1),
            ("in", 96),
            ("cm", 96 / 2.54),
            ("mm", 96 / 25.4),
            ("q", 96 / 101.6),
            ("pt", 96 / 72),
            ("pc", 16)
        ]
        for unit in units where value.hasSuffix(unit.suffix) {
            let number = String(value.dropLast(unit.suffix.count))
            guard let length = Double(number), length > 0, length.isFinite else { return nil }
            return length * unit.pixelsPerUnit
        }
        return nil
    }
}

@MainActor
final class TicketgroundSVGRenderer: NSObject, WKNavigationDelegate {
    private var webView: WKWebView?
    private var continuation: CheckedContinuation<UIImage, Error>?
    private var timeoutTask: Task<Void, Never>?

    func render(
        _ document: SafeSVGDocument,
        timeoutNanoseconds: UInt64 = 5_000_000_000
    ) async throws -> UIImage {
        guard timeoutNanoseconds > 0 else {
            throw TicketgroundSVGRendererError.timedOut
        }
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false

        let webView = WKWebView(frame: CGRect(origin: .zero, size: document.renderSize), configuration: configuration)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        self.webView = webView

        let html = """
        <!doctype html>
        <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
        <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}svg{width:100%;height:100%;display:block}</style>
        </head><body>\(document.markup)</body></html>
        """

        return try await withTaskCancellationHandler {
            try Task.checkCancellation()
            return try await withCheckedThrowingContinuation { continuation in
                self.continuation = continuation
                timeoutTask = Task { [weak self] in
                    try? await Task.sleep(nanoseconds: timeoutNanoseconds)
                    guard !Task.isCancelled else { return }
                    self?.finish(.failure(TicketgroundSVGRendererError.timedOut))
                }
                if Task.isCancelled {
                    finish(.failure(CancellationError()))
                } else {
                    webView.loadHTMLString(html, baseURL: nil)
                }
            }
        } onCancel: {
            Task { @MainActor [weak self] in
                self?.finish(.failure(CancellationError()))
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let snapshot = WKSnapshotConfiguration()
        snapshot.rect = CGRect(origin: .zero, size: webView.bounds.size)
        webView.takeSnapshot(with: snapshot) { [weak self] image, error in
            Task { @MainActor in
                guard let self else { return }
                if let image, Self.hasVisibleContent(image) {
                    self.finish(.success(image))
                } else if image != nil {
                    self.finish(.failure(TicketgroundSVGRendererError.emptyOutput))
                } else {
                    self.finish(.failure(error ?? TicketgroundSVGRendererError.renderFailed))
                }
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finish(.failure(error))
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        finish(.failure(error))
    }

    private func finish(_ result: Result<UIImage, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        timeoutTask?.cancel()
        timeoutTask = nil
        webView?.stopLoading()
        webView?.navigationDelegate = nil
        self.webView = nil
        continuation.resume(with: result)
    }

    private static func hasVisibleContent(_ image: UIImage) -> Bool {
        guard let cgImage = image.cgImage else { return false }
        let dimension = 64
        var pixels = [UInt8](repeating: 0, count: dimension * dimension * 4)
        guard let context = CGContext(
            data: &pixels,
            width: dimension,
            height: dimension,
            bitsPerComponent: 8,
            bytesPerRow: dimension * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return false
        }
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: dimension, height: dimension))
        return stride(from: 3, to: pixels.count, by: 4).contains { pixels[$0] > 0 }
    }
}
