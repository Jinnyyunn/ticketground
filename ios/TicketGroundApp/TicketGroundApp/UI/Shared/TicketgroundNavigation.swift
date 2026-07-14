import SwiftUI

struct SiteHeader: View {
    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            HStack(alignment: .center, spacing: TicketgroundSpacing.sm) {
                Text("Ticketground")
                    .font(.title2.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                    .accessibilityIdentifier("header-logo")
                Spacer(minLength: TicketgroundSpacing.sm)
                headerButton(title: "관심공연", systemImage: "star", identifier: "header-watchlist")
                headerButton(title: "마이페이지", systemImage: "person", identifier: "header-mypage")
            }

            Button(action: {}) {
                Label("검색", systemImage: "magnifyingglass")
                    .font(.headline)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    .padding(.horizontal, TicketgroundSpacing.md)
                    .background(TicketgroundColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.pill))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("header-search")
            .accessibilityLabel("검색")
        }
        .padding(.horizontal, TicketgroundSpacing.lg)
        .padding(.top, TicketgroundSpacing.sm)
        .padding(.bottom, TicketgroundSpacing.md)
        .background(TicketgroundColor.surface)
        .accessibilityElement(children: .contain)
    }

    private func headerButton(title: String, systemImage: String, identifier: String) -> some View {
        Button(action: {}) {
            Label(title, systemImage: systemImage)
                .labelStyle(.titleOnly)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TicketgroundColor.inkSecondary)
                .frame(minWidth: 44, minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(title)
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

    var body: some View {
        HStack(spacing: TicketgroundSpacing.xs) {
            ForEach(TicketgroundTab.allCases, id: \.self) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    VStack(spacing: TicketgroundSpacing.xs) {
                        Image(systemName: tab.systemImage)
                        Text(tab.title)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                    }
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(selectedTab == tab ? TicketgroundColor.accent : TicketgroundColor.inkMuted)
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
        .background(TicketgroundColor.surface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(TicketgroundColor.line)
                .frame(height: 1)
        }
        .accessibilityElement(children: .contain)
    }
}
