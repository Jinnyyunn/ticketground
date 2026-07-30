import SwiftUI

@main
struct TicketGroundApp: App {
    @State private var container = AppContainer.configured()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(container)
                .environment(\.sizeCategory, requestedSizeCategory)
        }
    }

    private var requestedSizeCategory: ContentSizeCategory {
        switch ProcessInfo.processInfo.environment["TICKETGROUND_UI_CONTENT_SIZE"] {
        case "accessibilityExtraExtraExtraLarge": return .accessibilityExtraExtraExtraLarge
        case "accessibilityExtraExtraLarge": return .accessibilityExtraExtraLarge
        default: return .large
        }
    }
}
