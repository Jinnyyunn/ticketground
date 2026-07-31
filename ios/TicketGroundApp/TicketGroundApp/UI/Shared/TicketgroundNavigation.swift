import SwiftUI

struct SiteHeader: View {
    var onSearch: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            HStack(alignment: .center, spacing: TicketgroundSpacing.sm) {
                HStack(spacing: 2) {
                    Text("Ticketground")
                        .font(.headline.weight(.black))
                    Circle()
                        .fill(TicketgroundColor.accent)
                        .frame(width: 6, height: 6)
                }
                .foregroundStyle(TicketgroundColor.ink)
                .accessibilityIdentifier("header-logo")
                Spacer(minLength: TicketgroundSpacing.sm)
                headerLink(title: "로그인", identifier: "header-watchlist", route: .login)
                headerLink(title: "전체 메뉴", icon: "line.3.horizontal", identifier: "header-mypage", route: .menu)
            }

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

    private func headerLink(title: String, icon: String? = nil, identifier: String, route: AppRoute) -> some View {
        NavigationLink(value: route) {
            Group {
                if let icon {
                    Image(systemName: icon)
                        .font(.body.weight(.semibold))
                } else {
                    Text(title)
                        .font(.caption.weight(.semibold))
                }
            }
                .foregroundStyle(TicketgroundColor.inkSecondary)
                .frame(minWidth: icon == nil ? 56 : 44, minHeight: 44)
                .padding(.horizontal, icon == nil ? TicketgroundSpacing.sm : 0)
                .overlay {
                    Capsule()
                        .stroke(TicketgroundColor.lineStrong, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(title)
        .accessibilityHint(icon == nil ? "로그인 옵션을 확인합니다" : "전체 메뉴를 엽니다")
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
}

struct TicketgroundBottomNavigation: View {
    @Binding var selectedTab: TicketgroundTab
    var visuallyHidden = false
    var onSelect: (TicketgroundTab) -> Void = { _ in }

    var body: some View {
        HStack(spacing: TicketgroundSpacing.xs) {
            ForEach(TicketgroundTab.allCases, id: \.self) { tab in
                Button {
                    selectedTab = tab
                    onSelect(tab)
                } label: {
                    VStack(spacing: TicketgroundSpacing.xs) {
                        Image(systemName: tab.systemImage)
                        Text(tab.title)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(
                            visuallyHidden
                                ? .clear
                                : (selectedTab == tab ? TicketgroundColor.accent : TicketgroundColor.inkMuted)
                        )
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("tab-\(tab.rawValue)")
                .accessibilityLabel(tab.title)
                .accessibilityHint("\(tab.title) 화면으로 이동")
                .accessibilityAddTraits(selectedTab == tab ? .isSelected : [])
            }
        }
        .padding(.horizontal, TicketgroundSpacing.sm)
        .padding(.top, TicketgroundSpacing.xs)
        .padding(.bottom, TicketgroundSpacing.sm)
        .background(visuallyHidden ? .clear : TicketgroundColor.surface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(visuallyHidden ? .clear : TicketgroundColor.line)
                .frame(height: 1)
        }
        .accessibilityElement(children: .contain)
    }
}
