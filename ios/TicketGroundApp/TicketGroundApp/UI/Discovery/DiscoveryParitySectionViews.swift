import SwiftUI

struct DiscoveryResaleSection: View {
    let card: DiscoveryResaleCard

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            DiscoverySectionHeading(
                title: "CLEAN 티켓 공식 양도",
                subtitle: "직거래 사기 걱정 없이, 내 티켓을 안전하게 양도하세요."
            )
            NavigationLink(value: card.destination) {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                        Text("CLEAN TICKET POOL")
                            .font(.caption.weight(.black))
                            .foregroundStyle(TicketgroundColor.accent)
                        Text("CLEAN 티켓 공식 양도")
                            .font(.title2.weight(.black))
                            .foregroundStyle(TicketgroundColor.ink)
                        Text("정가 범위와 구매 이력 검증을 통과한 티켓만 공식 풀에 등록됩니다.")
                            .font(.subheadline)
                            .foregroundStyle(TicketgroundColor.inkMuted)
                    }
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                        Text("안전한 거래를 위한 3단계")
                            .font(.headline.weight(.black))
                            .foregroundStyle(TicketgroundColor.ink)
                        ForEach(card.safetyItems, id: \.order) { item in
                            HStack(alignment: .top, spacing: TicketgroundSpacing.md) {
                                Image(systemName: item.systemImage)
                                    .foregroundStyle(TicketgroundColor.accent)
                                    .frame(width: TicketgroundSpacing.xl)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                    Text(item.title)
                                        .font(.subheadline.weight(.black))
                                        .foregroundStyle(TicketgroundColor.ink)
                                    Text(item.detail)
                                        .font(.caption)
                                        .foregroundStyle(TicketgroundColor.inkMuted)
                                }
                            }
                        }
                    }
                    Text("공식 풀 보기")
                        .font(.headline.weight(.black))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(TicketgroundColor.ink)
                        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(TicketgroundSpacing.lg)
                .background(TicketgroundColor.surfaceMuted)
                .overlay {
                    RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                        .stroke(TicketgroundColor.line, lineWidth: 1)
                }
                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("discovery-resale-pool")
        }
    }
}

struct DiscoveryGenreRecommendationsSection: View {
    let groups: [DiscoveryGenreGroup]
    @State private var selectedLabel: String

    init(groups: [DiscoveryGenreGroup]) {
        self.groups = groups
        _selectedLabel = State(initialValue: groups.first?.label ?? "")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            DiscoverySectionHeading(title: "장르별 추천", subtitle: "콘서트·뮤지컬·연극·클래식을 비교하세요.")
            if groups.isEmpty {
                TicketgroundEmptySurface(
                    title: "추천 공연을 준비 중입니다.",
                    message: "새로운 장르별 공연이 등록되면 이곳에 표시됩니다.",
                    actionTitle: nil,
                    action: nil
                )
                .accessibilityIdentifier("discovery-genre-empty")
            } else {
                LazyVGrid(
                    columns: [GridItem(.adaptive(minimum: 72), spacing: TicketgroundSpacing.sm)],
                    alignment: .leading,
                    spacing: TicketgroundSpacing.sm
                ) {
                    ForEach(groups, id: \.label) { group in
                        Button(group.label) {
                            selectedLabel = group.label
                        }
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(selectedLabel == group.label ? Color.white : TicketgroundColor.ink)
                        .frame(minWidth: 72, minHeight: 44)
                        .background(selectedLabel == group.label ? TicketgroundColor.ink : TicketgroundColor.surfaceMuted)
                        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                        .accessibilityValue(selectedLabel == group.label ? "selected" : "default")
                        .accessibilityIdentifier("discovery-genre-tab-\(identifier(for: group.label))")
                    }
                }
                if let group = selectedGroup {
                    NavigationLink(value: group.destination) {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                            ForEach(group.events, id: \.rank) { event in
                                HStack(spacing: TicketgroundSpacing.md) {
                                    TicketgroundMediaImage(
                                        resource: event.imageResource,
                                        role: .poster,
                                        accessibilityLabel: "\(event.title) 포스터",
                                        accessibilitySuffix: "home-genre-\(event.rank)"
                                    )
                                    .frame(width: 64, height: 84)
                                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                                    VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                        Text(event.title)
                                            .font(.headline.weight(.black))
                                            .foregroundStyle(TicketgroundColor.ink)
                                            .multilineTextAlignment(.leading)
                                        Text("\(event.venue) · \(event.date)")
                                            .font(.caption)
                                            .foregroundStyle(TicketgroundColor.inkMuted)
                                    }
                                    Spacer(minLength: 0)
                                }
                            }
                            Text("\(group.label) 전체 보기")
                                .font(.headline.weight(.bold))
                                .foregroundStyle(TicketgroundColor.accent)
                                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("discovery-genre-\(identifier(for: group.label))")
                }
            }
        }
    }

    private var selectedGroup: DiscoveryGenreGroup? {
        groups.first { $0.label == selectedLabel } ?? groups.first
    }

    private func identifier(for label: String) -> String {
        switch label {
        case "콘서트": return "concert"
        case "뮤지컬": return "musical"
        case "연극": return "play"
        case "클래식": return "classic"
        case "전시": return "exhibition"
        case "아동": return "child"
        case "스포츠": return "sports"
        default: return label.lowercased()
        }
    }
}

struct DiscoveryEditorialSection: View {
    let cards: [DiscoveryEditorialCard]

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            DiscoverySectionHeading(title: "기획전", subtitle: "지금 봐야 할 공연을 에디터가 엄선해 소개합니다.")
            if cards.isEmpty {
                TicketgroundEmptySurface(
                    title: "기획전을 준비 중입니다.",
                    message: "새로운 공연 큐레이션이 등록되면 이곳에 표시됩니다.",
                    actionTitle: nil,
                    action: nil
                )
                .accessibilityIdentifier("discovery-editorial-empty")
            } else {
                ForEach(cards, id: \.order) { card in
                    NavigationLink(value: card.destination) {
                        HStack(spacing: TicketgroundSpacing.md) {
                            TicketgroundMediaImage(
                                resource: nil,
                                role: .poster,
                                accessibilityLabel: "\(card.title) 기획전 이미지",
                                accessibilitySuffix: "home-editorial-\(card.order)"
                            )
                            .frame(width: 88, height: 112)
                            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                Text("EDITORIAL")
                                    .font(.caption.weight(.black))
                                    .foregroundStyle(TicketgroundColor.accent)
                                Text(card.title)
                                    .font(.title3.weight(.black))
                                    .foregroundStyle(TicketgroundColor.ink)
                                    .multilineTextAlignment(.leading)
                                Text("기획전 보기")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(TicketgroundColor.inkMuted)
                            }
                            Spacer(minLength: 0)
                        }
                        .frame(maxWidth: .infinity, minHeight: 136, alignment: .leading)
                        .padding(TicketgroundSpacing.md)
                        .background(TicketgroundColor.surfaceMuted)
                        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("discovery-editorial-\(card.order)")
                }
            }
        }
    }
}
