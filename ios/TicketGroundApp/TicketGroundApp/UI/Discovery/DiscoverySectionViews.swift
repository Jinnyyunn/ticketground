import SwiftUI

struct DiscoveryRankingSection: View {
    let rankings: [DiscoveryRanking]

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Text("실시간 예매 랭킹 TOP10")
                        .font(.title3.weight(.black))
                        .foregroundStyle(TicketgroundColor.ink)
                    Text("지금 가장 빠르게 움직이는 공연입니다.")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
                Spacer(minLength: TicketgroundSpacing.sm)
                NavigationLink(value: AppRoute.ranking) {
                    Text("더보기")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
                .accessibilityIdentifier("discovery-ranking-more")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: TicketgroundSpacing.sm) {
                    ForEach(rankings, id: \.rank) { item in
                    NavigationLink(value: item.route) {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            ZStack(alignment: .topLeading) {
                                DiscoveryRankingPoster(imageResource: item.imageResource, title: item.title, rank: item.rank)
                                Text("\(item.rank)")
                                    .font(.title3.weight(.black))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(TicketgroundColor.accent)
                                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                            }
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                HStack(spacing: TicketgroundSpacing.sm) {
                                    Text(item.genre)
                                        .font(.caption.weight(.black))
                                        .foregroundStyle(TicketgroundColor.accent)
                                    Text("\(item.movement.symbol) \(item.delta)")
                                        .font(.caption.weight(.bold))
                                        .foregroundStyle(TicketgroundColor.inkMuted)
                                }
                                Text(item.title)
                                    .font(.subheadline.weight(.black))
                                    .foregroundStyle(TicketgroundColor.ink)
                                    .multilineTextAlignment(.leading)
                                    .lineLimit(2)
                                Text(item.venue)
                                    .font(.caption)
                                    .foregroundStyle(TicketgroundColor.inkSecondary)
                                Text(item.date)
                                    .font(.caption)
                                    .foregroundStyle(TicketgroundColor.inkMuted)
                            }
                        }
                        .frame(width: 120, alignment: .leading)
                        .padding(.bottom, TicketgroundSpacing.sm)
                        .background(TicketgroundColor.surface)
                        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("discovery-ranking-\(item.rank)")
                    }
                }
            }
        }
    }
}

struct DiscoveryRankingPoster: View {
    let imageResource: String?
    let title: String
    let rank: Int

    var body: some View {
        TicketgroundMediaImage(
            resource: imageResource,
            role: .poster,
            accessibilityLabel: "\(title) 포스터",
            accessibilitySuffix: "home-ranking-\(rank)"
        )
        .frame(width: 120, height: 156)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }
}

struct DiscoveryOpeningSection: View {
    let openingSoon: [DiscoveryOpening]

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            HStack(alignment: .bottom) {
                DiscoverySectionHeading(title: "티켓오픈 예정", subtitle: "오픈 시간과 회차를 확인하고 알림을 준비하세요.")
                Spacer(minLength: TicketgroundSpacing.sm)
                NavigationLink(value: AppRoute.open) {
                    Text("더보기")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(TicketgroundColor.inkMuted)
                        .frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityIdentifier("discovery-open-more")
            }
            if openingSoon.isEmpty {
                TicketgroundEmptySurface(
                    title: "티켓오픈 일정이 없습니다.",
                    message: "새로운 오픈 일정이 등록되면 이곳에 표시됩니다.",
                    actionTitle: nil,
                    action: nil
                )
                .accessibilityIdentifier("discovery-opening-empty")
            } else {
                ForEach(openingSoon, id: \.title) { item in
                NavigationLink(value: item.route) {
                    HStack(alignment: .top, spacing: TicketgroundSpacing.md) {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            Text("\(item.month)월 \(item.day)일")
                                .font(.caption.weight(.black))
                                .foregroundStyle(TicketgroundColor.accent)
                            Text(item.time)
                                .font(.title2.weight(.black))
                                .foregroundStyle(TicketgroundColor.ink)
                        }
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            Text(item.title)
                                .font(.headline.weight(.black))
                                .foregroundStyle(TicketgroundColor.ink)
                                .multilineTextAlignment(.leading)
                            Text("\(item.genre) · \(item.round)")
                                .font(.subheadline)
                                .foregroundStyle(TicketgroundColor.inkSecondary)
                            Text(item.dday)
                                .font(.caption.weight(.black))
                                .foregroundStyle(TicketgroundColor.accent)
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(TicketgroundSpacing.md)
                    .background(TicketgroundColor.surface)
                    .overlay {
                        RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                            .stroke(TicketgroundColor.line, lineWidth: 1)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("discovery-opening-\(item.day)")
                }
            }
            NavigationLink(value: AppRoute.open) {
                Text("전체 오픈 캘린더 보기")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(TicketgroundColor.ink)
            .accessibilityIdentifier("discovery-open-calendar")
        }
    }
}

struct DiscoveryShortcutsSection: View {
    let shortcuts: [DiscoveryShortcut]

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            DiscoverySectionHeading(title: "바로가기", subtitle: "홈에서 자주 쓰는 탐색 경로를 한 화면에 모았습니다.")
            VStack(spacing: TicketgroundSpacing.sm) {
                ForEach(Array(stride(from: 0, to: shortcuts.count, by: 2)), id: \.self) { index in
                    HStack(spacing: TicketgroundSpacing.sm) {
                        shortcutCard(shortcuts[index])
                        if index + 1 < shortcuts.count {
                            shortcutCard(shortcuts[index + 1])
                        } else {
                            Color.clear
                                .frame(maxWidth: .infinity)
                        }
                    }
                }
            }
        }
    }

    private func shortcutCard(_ shortcut: DiscoveryShortcut) -> some View {
        NavigationLink(value: shortcut.route) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                Image(systemName: shortcutIcon(for: shortcut.label))
                    .font(.title3)
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityHidden(true)
                Text(shortcut.label)
                    .font(.headline.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text(shortcut.helper)
                    .font(.caption)
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
            .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
            .padding(TicketgroundSpacing.md)
            .background(TicketgroundColor.surfaceMuted)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("shortcut-\(shortcutIdentifier(for: shortcut.label))")
    }

    private func shortcutIdentifier(for label: String) -> String {
        switch label {
        case "오픈캘린더": return "open-calendar"
        case "지방 공연": return "region"
        case "대학로": return "college-theater"
        case "양도": return "resale"
        case "VIP석": return "ranking"
        case "당일 공연": return "same-day"
        default: return "other"
        }
    }

    private func shortcutIcon(for label: String) -> String {
        switch label {
        case "지방 공연": return "mappin.and.ellipse"
        case "대학로": return "theatermasks"
        case "양도": return "arrow.triangle.2.circlepath"
        case "VIP석": return "crown"
        case "오픈캘린더": return "calendar"
        case "당일 공연": return "bolt"
        default: return "link"
        }
    }
}

struct DiscoverySectionHeading: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
            Text(title)
                .font(.title2.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(TicketgroundColor.inkMuted)
        }
    }
}
