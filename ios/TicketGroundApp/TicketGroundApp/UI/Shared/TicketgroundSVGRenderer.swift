import Foundation
import UIKit
import WebKit

enum TicketgroundSVGRendererError: Error {
    case invalidDocument
    case renderFailed
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
            renderSize = targetSize(from: attributeDict)
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

    private func targetSize(from attributes: [String: String]) -> CGSize {
        let viewBoxValue = attributes.first { $0.key.lowercased() == "viewbox" }?.value
        let values = viewBoxValue?
            .split(whereSeparator: { $0 == " " || $0 == "," })
            .compactMap { Double($0) }
        let width = values?.count == 4 ? abs(values?[2] ?? 0) : 0
        let height = values?.count == 4 ? abs(values?[3] ?? 0) : 0
        let aspectWidth = width > 0 ? width : 4
        let aspectHeight = height > 0 ? height : 3
        let scale = min(maxDimension / aspectWidth, maxDimension / aspectHeight, 1)
        return CGSize(
            width: max(1, aspectWidth * scale),
            height: max(1, aspectHeight * scale)
        )
    }
}

@MainActor
final class TicketgroundSVGRenderer: NSObject, WKNavigationDelegate {
    private var webView: WKWebView?
    private var continuation: CheckedContinuation<UIImage, Error>?

    func render(_ document: SafeSVGDocument) async throws -> UIImage {
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

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            webView.loadHTMLString(html, baseURL: nil)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let snapshot = WKSnapshotConfiguration()
        snapshot.rect = CGRect(origin: .zero, size: webView.bounds.size)
        webView.takeSnapshot(with: snapshot) { [weak self] image, error in
            Task { @MainActor in
                guard let self else { return }
                if let image {
                    self.finish(.success(image))
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
        self.webView = nil
        continuation.resume(with: result)
    }
}
