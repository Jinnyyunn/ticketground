import SwiftUI

@main
struct TicketGroundApp: App {
    @State private var container = AppContainer.configured()

    var body: some Scene {
        WindowGroup {
            configuredContent
                .onOpenURL { url in
                    _ = GoogleSignInProvider.handle(url)
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
}
