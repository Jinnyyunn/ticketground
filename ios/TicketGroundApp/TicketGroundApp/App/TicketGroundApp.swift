import SwiftUI
import UserNotifications

@main
struct TicketGroundApp: App {
    @UIApplicationDelegateAdaptor(TicketGroundAppDelegate.self) private var appDelegate
    @State private var container = AppContainer.configured()

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
                    //
                    // Intentionally NOT mirrored on `scenePhase` becoming
                    // `.active`: that fires on every foreground (unlock,
                    // app switch, incoming call dismissal - not just cold
                    // launch), which previously zeroed out the ticket-count
                    // badge `LiveAccountRouteView` sets almost immediately
                    // after it was computed, making the "best-effort app
                    // icon badge reflecting owned tickets" feature
                    // effectively never visible. `.task` here only runs
                    // once per process launch, which is the actual "stale
                    // badge from a previous install/session" case this
                    // guards against.
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
