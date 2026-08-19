import SwiftUI

// Phase 2 of iOS Android 앱 UI 개선 계획서.md §4: adopts a real SwiftUI
// `TabView` for the four primary tabs (previously a custom `HStack` that
// disappeared any time a screen was pushed - see git history for the old
// `TicketgroundBottomNavigation`) and stops globally hiding the system
// navigation bar (previously `.toolbar(.hidden, for: .navigationBar)` on
// the single shared `NavigationStack`). Each tab now owns its own
// `NavigationStack`/back-stack (`AppContainer.homePath` /
// `.searchPath` / `.watchlistPath` / `.mypagePath`), so the tab bar stays
// visible while browsing inside a tab, matching native behavior. Search,
// Watchlist and My Page reuse the exact same `DiscoveryRouteView` bodies
// that already existed for `.search`/`.watchlist`/`.mypage` (previously
// only reachable by pushing those routes) - now they're also each tab's
// root content, so nothing about their own internal logic changed.
struct ContentView: View {
    @Environment(AppContainer.self) private var container
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var discoveryContent: DiscoveryContent?
    @State private var liveState: LiveState?
    @State private var discoveryLoadFailed = false
    @State private var discoveryLoadEmpty = false
    @State private var discoveryFailurePresentation: PublicReadPresentation?
    @State private var discoveryReloadRequest = 0
    @State private var discoveryLoadRequestCount = 0

    var body: some View {
        @Bindable var container = container
        TabView(selection: $container.selectedTab) {
            NavigationStack(path: $container.homePath) {
                homeContent
                    .navigationDestination(for: AppRoute.self) { route in
                        DiscoveryRouteView(route: route, content: discoveryContent)
                    }
            }
            .tabItem { tabLabel(.home) }
            .tag(TicketgroundTab.home)

            NavigationStack(path: $container.searchPath) {
                DiscoveryRouteView(route: .search, content: discoveryContent)
                    .navigationDestination(for: AppRoute.self) { route in
                        DiscoveryRouteView(route: route, content: discoveryContent)
                    }
            }
            .tabItem { tabLabel(.search) }
            .tag(TicketgroundTab.search)

            NavigationStack(path: $container.watchlistPath) {
                DiscoveryRouteView(route: .watchlist, content: discoveryContent)
                    .navigationDestination(for: AppRoute.self) { route in
                        DiscoveryRouteView(route: route, content: discoveryContent)
                    }
            }
            .tabItem { tabLabel(.watchlist) }
            .tag(TicketgroundTab.watchlist)

            NavigationStack(path: $container.mypagePath) {
                DiscoveryRouteView(route: .mypage, content: discoveryContent)
                    .navigationDestination(for: AppRoute.self) { route in
                        DiscoveryRouteView(route: route, content: discoveryContent)
                    }
            }
            .tabItem { tabLabel(.mypage) }
            .tag(TicketgroundTab.mypage)
        }
        .task(id: discoveryReloadRequest) {
            guard discoveryContent == nil, liveState == nil, !discoveryLoadFailed, !discoveryLoadEmpty else { return }
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
            } catch VirtualFixtureDecodeError.emptyResponse {
                discoveryLoadEmpty = true
            } catch {
                discoveryLoadFailed = true
                discoveryFailurePresentation = PublicReadPresentation.resolve(error)
            }
        }
    }

    private func tabLabel(_ tab: TicketgroundTab) -> some View {
        // `.accessibilityIdentifier` must be set here, on the Label inside
        // the `.tabItem` closure itself - chaining it on the tab's content
        // view (after `.tag(...)`) does not propagate to the underlying
        // UITabBarItem, so `app.buttons["tab-home"]` etc. would not resolve
        // in XCUITest even though the button renders correctly on screen.
        Label(tab.title, systemImage: tab.systemImage)
            .accessibilityIdentifier(tab.accessibilityIdentifier)
    }

    @ViewBuilder
    private var homeContent: some View {
        let scenario = FixtureScenario.current
        GeometryReader { geometry in
            VStack(spacing: 0) {
                if reduceMotion || FixtureScenario.reduceMotionRequested {
                    Color.clear
                        .frame(width: 1, height: 1)
                        .accessibilityIdentifier("reduced-motion-safe")
                }
                SiteHeader(
                    onSearch: { container.selectedTab = .search }
                )
                    .containerRelativeFrame(.horizontal)
                ScrollView {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                        if scenario == .happy {
                            if let discoveryContent {
                                DiscoveryHomeView(content: discoveryContent)
                            } else if let liveState {
                                LiveStateOnlyHomeView(
                                    state: liveState,
                                    retryCatalog: {
                                        self.liveState = nil
                                        discoveryReloadRequest += 1
                                    }
                                )
                            } else if discoveryLoadEmpty {
                                TicketgroundEmptySurface(
                                    title: "공연이 없습니다",
                                    message: "표시할 공연이 없습니다.",
                                    actionTitle: "다시 시도",
                                    action: {
                                        discoveryLoadEmpty = false
                                        discoveryReloadRequest += 1
                                    }
                                )
                            } else if discoveryLoadFailed {
                                let presentation = discoveryFailurePresentation ?? PublicReadPresentation(title: "공개 상태를 불러올 수 없습니다", message: "네트워크를 확인한 뒤 다시 시도해 주세요.")
                                TicketgroundErrorSurface(
                                    title: container.environment.mode == .live ? presentation.title : "콘텐츠를 불러올 수 없습니다",
                                    message: container.environment.mode == .live ? presentation.message : "번들 discovery fixture를 확인해 주세요.",
                                    actionTitle: "다시 시도",
                                    action: {
                                        discoveryLoadFailed = false
                                        discoveryLoadEmpty = false
                                        discoveryFailurePresentation = nil
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
            .background(TicketgroundColor.surface.ignoresSafeArea())
            .frame(width: geometry.size.width)
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { homeToolbar }
    }

    @ToolbarContentBuilder
    private var homeToolbar: some ToolbarContent {
        ToolbarItem(placement: .navigationBarTrailing) {
            Button {
                container.navigationPath.append(.login)
            } label: {
                Text("로그인")
                    .font(.caption.weight(.semibold))
            }
            .accessibilityIdentifier("header-login")
            .accessibilityLabel("로그인")
            .accessibilityHint("로그인 옵션을 확인합니다")
        }
        ToolbarItem(placement: .navigationBarTrailing) {
            Button {
                container.navigationPath.append(.menu)
            } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.body.weight(.semibold))
            }
            .accessibilityIdentifier("header-menu")
            .accessibilityLabel("전체 메뉴")
            .accessibilityHint("전체 메뉴를 엽니다")
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
