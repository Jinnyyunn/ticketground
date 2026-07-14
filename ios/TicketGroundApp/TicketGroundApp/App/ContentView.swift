import SwiftUI

struct ContentView: View {
    @Environment(AppContainer.self) private var container
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedTab: TicketgroundTab = .home

    var body: some View {
        @Bindable var container = container
        let scenario = FixtureScenario.current
        NavigationStack(path: $container.navigationPath) {
            VStack(spacing: 0) {
                SiteHeader()
                ScrollView {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                        Text("공연을 발견하고, 예매하고, 안전하게 관리하세요.")
                            .font(.title3)
                            .foregroundStyle(TicketgroundColor.inkSecondary)
                        Text("데이터 모드: \(container.environment.mode.rawValue)")
                            .font(.caption)
                            .foregroundStyle(TicketgroundColor.inkMuted)
                        Text(scenario.statusText)
                            .font(.headline)
                            .foregroundStyle(TicketgroundColor.ink)
                            .accessibilityIdentifier("fixture-state-\(scenario.rawValue)")
                        stateSurface(for: scenario)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(TicketgroundSpacing.xl)
                    .accessibilityIdentifier("screen-ready-home")
                }
                TicketgroundBottomNavigation(selectedTab: $selectedTab)
            }
            .accessibilityIdentifier(reduceMotion || FixtureScenario.reduceMotionRequested ? "reduced-motion-safe" : "shell-root")
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AppRoute.self) { route in
                Text(route.id)
                    .navigationTitle(route.id)
            }
        }
    }

    @ViewBuilder
    private func stateSurface(for scenario: FixtureScenario) -> some View {
        switch scenario {
        case .happy:
            TicketgroundSurface(tone: .standard) {
                Text("공연 콘텐츠를 준비하고 있습니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
            }
            .accessibilityIdentifier("state-ready")
        case .empty:
            TicketgroundEmptySurface(
                title: "데이터 없음",
                message: "표시할 공연이 없습니다.",
                actionTitle: "다시 시도",
                action: {}
            )
        case .malformed:
            TicketgroundErrorSurface(
                title: "잘못된 링크",
                message: "요청을 이해할 수 없습니다.",
                actionTitle: "홈으로",
                action: {}
            )
        case .offline:
            TicketgroundErrorSurface(
                title: "오프라인",
                message: "네트워크 연결을 확인해 주세요.",
                actionTitle: "다시 시도",
                action: {}
            )
        case .unauthorized:
            TicketgroundErrorSurface(
                title: "인증 필요",
                message: "로그인 후 이용할 수 있습니다.",
                actionTitle: "로그인",
                action: {}
            )
        }
    }
}

#Preview {
    ContentView()
        .environment(AppContainer.fixture())
}
