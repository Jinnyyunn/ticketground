import SwiftUI

struct ContentView: View {
    @Environment(AppContainer.self) private var container

    var body: some View {
        @Bindable var container = container
        NavigationStack(path: $container.navigationPath) {
            VStack(alignment: .leading, spacing: 16) {
                Text("Ticketground")
                    .font(.largeTitle.weight(.bold))
                Text("공연을 발견하고, 예매하고, 안전하게 관리하세요.")
                    .foregroundStyle(.secondary)
                Text("데이터 모드: \(container.environment.mode.rawValue)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(24)
            .navigationTitle("홈")
            .accessibilityIdentifier("screen-ready-home")
            .navigationDestination(for: AppRoute.self) { route in
                Text(route.id)
                    .navigationTitle(route.id)
            }
        }
    }
}

#Preview {
    ContentView()
        .environment(AppContainer.fixture())
}
