import SwiftUI

@main
struct TicketGroundApp: App {
    @State private var container = AppContainer.configured()

    var body: some Scene {
        WindowGroup {
            configuredContent
                .onOpenURL { url in
                    Self.handleOpenURL(url, container: container, googleHandler: GoogleSignInProvider.handle)
                }
                .task {
                    await GoogleNativeSessionClient(
                        apiClient: container.environment.apiClient,
                        sessionStore: container.environment.sessionStore
                    ).validateRestoredSession()
                }
        }
    }

    @ViewBuilder
    private var configuredContent: some View {
        if let sizeCategory = Self.requestedSizeCategory(environment: ProcessInfo.processInfo.environment) {
            ContentView()
                .environment(container)
                .environment(\.sizeCategory, sizeCategory)
        } else {
            ContentView()
                .environment(container)
        }
    }

    static func requestedSizeCategory(environment: [String: String]) -> ContentSizeCategory? {
        switch environment["TICKETGROUND_UI_CONTENT_SIZE"] {
        case "accessibilityExtraExtraExtraLarge": return .accessibilityExtraExtraExtraLarge
        case "accessibilityExtraExtraLarge": return .accessibilityExtraExtraLarge
        default: return nil
        }
    }

    static func handleOpenURL(
        _ url: URL,
        container: AppContainer,
        googleHandler: (URL) -> Bool
    ) {
        guard !googleHandler(url) else { return }
        container.applyPublicURL(url)
    }
}
