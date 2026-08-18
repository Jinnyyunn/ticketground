import SwiftUI
import UserNotifications

@main
struct TicketGroundApp: App {
    @UIApplicationDelegateAdaptor(TicketGroundAppDelegate.self) private var appDelegate
    @State private var container = AppContainer.configured()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            configuredContent
                .onOpenURL { url in
                    Self.handleOpenURL(url, container: container, googleHandler: GoogleSignInProvider.handle)
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { userActivity in
                    guard let url = userActivity.webpageURL else { return }
                    Self.handleOpenURL(url, container: container, googleHandler: GoogleSignInProvider.handle)
                }
                .task {
                    await GoogleNativeSessionClient(
                        apiClient: container.environment.apiClient,
                        sessionStore: container.environment.sessionStore
                    ).validateRestoredSession()
                }
                .task {
                    // No push-driven badge count is wired up yet (that
                    // needs a real backend signal - see `LiveAccountRouteView`
                    // for the best-effort count derived from already-fetched
                    // ticket data). This just makes sure a stale badge from a
                    // previous install/session never lingers on cold launch.
                    try? await UNUserNotificationCenter.current().setBadgeCount(0)
                }
        }
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            Task {
                try? await UNUserNotificationCenter.current().setBadgeCount(0)
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
