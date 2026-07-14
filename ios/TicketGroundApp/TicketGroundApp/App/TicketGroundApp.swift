import SwiftUI

@main
struct TicketGroundApp: App {
    @State private var container = AppContainer.fixture()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(container)
        }
    }
}
