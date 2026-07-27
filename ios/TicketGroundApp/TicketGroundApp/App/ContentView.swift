import SwiftUI

struct ContentView: View {
    @Environment(AppContainer.self) private var container
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedTab: TicketgroundTab = .home
    @State private var discoveryContent: DiscoveryContent?
    @State private var liveState: LiveState?
    @State private var discoveryLoadFailed = false
    @State private var discoveryReloadRequest = 0
    @State private var discoveryLoadRequestCount = 0

    var body: some View {
        @Bindable var container = container
        let scenario = FixtureScenario.current
        NavigationStack(path: $container.navigationPath) {
            GeometryReader { geometry in
                VStack(spacing: 0) {
                if reduceMotion || FixtureScenario.reduceMotionRequested {
                    Color.clear
                        .frame(width: 1, height: 1)
                        .accessibilityIdentifier("reduced-motion-safe")
                }
                SiteHeader(
                    onSearch: { container.navigationPath.append(.search) }
                )
                    .containerRelativeFrame(.horizontal)
                ScrollView {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                        if scenario == .happy {
                            if let discoveryContent {
                                DiscoveryHomeView(content: discoveryContent)
                            } else if let liveState {
                                LiveStateOnlyHomeView(state: liveState)
                            } else if discoveryLoadFailed {
                                TicketgroundErrorSurface(
                                    title: "콘텐츠를 불러올 수 없습니다",
                                    message: "번들 discovery fixture를 확인해 주세요.",
                                    actionTitle: "다시 시도",
                                    action: {
                                        discoveryLoadFailed = false
                                        discoveryReloadRequest += 1
                                    }
                                )
                                .accessibilityValue("콘텐츠 요청 \(discoveryLoadRequestCount)회")
                            } else {
                                TicketgroundLoadingSurface(title: "공연 콘텐츠를 불러오는 중")
                            }
                        } else {
                            Text("공연을 발견하고, 예매하고, 안전하게 관리하세요.")
                                .font(.title3)
                                .foregroundStyle(TicketgroundColor.inkSecondary)
                            Text("데이터 모드: \(container.environment.mode.rawValue)")
                                .font(.caption)
                                .foregroundStyle(TicketgroundColor.inkMuted)
                            if scenario != .loading {
                                Text(scenario.statusText)
                                    .font(.headline)
                                    .foregroundStyle(TicketgroundColor.ink)
                                    .accessibilityIdentifier("fixture-state-\(scenario.rawValue)")
                            }
                            stateSurface(for: scenario)
                            if scenario == .empty {
                                DiscoveryEmptyCalendarView(action: { container.navigationPath.removeAll() })
                            }
                        }
                        }
                    .padding(.horizontal, TicketgroundSpacing.lg)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .containerRelativeFrame(.horizontal)
            }
            .overlay(alignment: .bottom) {
                TicketgroundBottomNavigation(
                    selectedTab: $selectedTab,
                    visuallyHidden: scenario == .happy,
                    onSelect: { tab in
                        switch tab {
                        case .home:
                            container.navigationPath.removeAll()
                        case .search:
                            container.navigationPath.append(.search)
                        case .watchlist:
                            container.navigationPath.append(.watchlist)
                        case .mypage:
                            container.navigationPath.append(.mypage)
                        }
                    }
                )
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: AppRoute.self) { route in
                DiscoveryRouteView(route: route, content: discoveryContent)
            }
            .background(TicketgroundColor.surface.ignoresSafeArea())
            .frame(width: geometry.size.width)
            }
        }
        .task(id: discoveryReloadRequest) {
            guard discoveryContent == nil, liveState == nil, !discoveryLoadFailed else { return }
            discoveryLoadRequestCount += 1
            do {
                if container.environment.mode == .fixture {
                    discoveryContent = try DiscoveryFixtureLoader.load()
                } else {
                    switch try await DiscoveryFixtureLoader.loadLive(using: container.environment.apiClient) {
                    case .catalog(let content):
                        discoveryContent = content
                    case .stateOnly(let state):
                        liveState = state
                    }
                }
            } catch {
                discoveryLoadFailed = true
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
        case .loading:
            TicketgroundLoadingSurface(title: "공연 콘텐츠를 불러오는 중")
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
        case .mediaFallback:
            TicketgroundMediaImage(
                resource: "https://127.0.0.1:1/unreachable-poster.png",
                role: .poster,
                accessibilityLabel: "공연 포스터"
            )
            .frame(maxWidth: .infinity)
            .frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        case .svgSeatMap:
            fixtureSeatMap(resource: "seat-map-valid.svg")
        case .corruptSVGSeatMap:
            fixtureSeatMap(resource: "seat-map-corrupt.svg")
        }
    }

    private func fixtureSeatMap(resource: String) -> some View {
        TicketgroundMediaImage(
            resource: resource,
            role: .seatMap,
            accessibilityLabel: "공연장 좌석 배치도",
            contentMode: .fit
        )
        .frame(maxWidth: .infinity)
        .frame(height: 260)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }
}

#Preview {
    ContentView()
        .environment(AppContainer.fixture())
}
