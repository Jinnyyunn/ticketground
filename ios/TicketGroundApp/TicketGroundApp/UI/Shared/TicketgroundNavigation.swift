import SwiftUI

// Login/menu access used to live here as a second, web-style header row
// drawn inside the scrolling content, on top of a globally-hidden system
// navigation bar (iOS Android 앱 UI 개선 계획서.md §3). Now that
// `ContentView` restores the native navigation bar for the Home tab, login
// and menu are native trailing toolbar buttons instead (see `ContentView.
// homeToolbar`) - this header keeps only the wordmark and the search pill,
// which don't map cleanly onto standard toolbar chrome without changing
// their look/behavior.
struct SiteHeader: View {
    var onSearch: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            HStack(spacing: 2) {
                Text("Ticketground")
                    .font(.headline.weight(.black))
                Circle()
                    .fill(TicketgroundColor.accent)
                    .frame(width: 6, height: 6)
            }
            .foregroundStyle(TicketgroundColor.ink)
            .accessibilityIdentifier("header-logo")

            Button(action: onSearch) {
                Label("공연, 아티스트 또는 공연장 검색", systemImage: "magnifyingglass")
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                    .frame(maxWidth: .infinity, minHeight: 38, alignment: .leading)
                    .padding(.horizontal, TicketgroundSpacing.md)
                    .background(TicketgroundColor.surface)
                    .overlay {
                        RoundedRectangle(cornerRadius: TicketgroundRadius.pill)
                            .stroke(TicketgroundColor.lineStrong, lineWidth: 1)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.pill))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("header-search")
            .accessibilityLabel("공연, 아티스트 또는 공연장 검색")
            .accessibilityHint("검색 화면을 엽니다")
        }
        .padding(.horizontal, TicketgroundSpacing.lg)
        .padding(.top, TicketgroundSpacing.xs)
        .padding(.bottom, TicketgroundSpacing.sm)
        .background(TicketgroundColor.surface)
        .accessibilityElement(children: .contain)
    }
}

enum TicketgroundTab: String, CaseIterable, Hashable {
    case home
    case search
    case watchlist
    case mypage

    var title: String {
        switch self {
        case .home: return "홈"
        case .search: return "검색"
        case .watchlist: return "찜"
        case .mypage: return "마이페이지"
        }
    }

    var systemImage: String {
        switch self {
        case .home: return "house"
        case .search: return "magnifyingglass"
        case .watchlist: return "heart"
        case .mypage: return "person"
        }
    }

    /// Maps an `AppRoute` to the primary tab it represents as a *root*
    /// destination - used by `AppContainer.applyPublicURL` (Universal
    /// Links / custom scheme deep links) so opening e.g.
    /// `ticketground://watchlist` lands on the native Watchlist tab rather
    /// than pushing a duplicate screen with no visible tab bar.
    static func rootTab(for route: AppRoute) -> TicketgroundTab? {
        switch route {
        case .home: return .home
        case .search: return .search
        case .watchlist: return .watchlist
        case .mypage: return .mypage
        default: return nil
        }
    }

    /// Accessibility identifier applied to this tab's native `.tabItem`
    /// label so `TicketGroundAppUITests` can keep targeting `tab-home`,
    /// `tab-search`, `tab-watchlist`, `tab-mypage` the same way it did with
    /// the previous custom `HStack` tab bar.
    var accessibilityIdentifier: String { "tab-\(rawValue)" }
}
