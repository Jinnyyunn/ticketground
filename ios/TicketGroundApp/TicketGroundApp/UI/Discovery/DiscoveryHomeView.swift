import SwiftUI

struct DiscoveryHomeView: View {
    let content: DiscoveryContent

    var body: some View {
        let parity = DiscoveryHomeComposition.make(from: content)
        VStack(alignment: .leading, spacing: 0) {
            DiscoveryCategoryGrid(categories: content.categories)
            DiscoveryFeaturedSection(featured: content.featured, supporting: content.supporting)
                .padding(.top, TicketgroundSpacing.xl)
            DiscoveryRankingSection(rankings: content.rankings)
                .padding(.top, TicketgroundSpacing.xxl)
            DiscoveryOpeningSection(openingSoon: content.openingSoon)
                .padding(.top, TicketgroundSpacing.xxl)
            DiscoveryResaleSection(card: parity.resale)
                .padding(.top, TicketgroundSpacing.xxl)
            DiscoveryGenreRecommendationsSection(groups: parity.genreGroups)
                .padding(.top, TicketgroundSpacing.xxl)
            DiscoveryEditorialSection(cards: parity.editorials)
                .padding(.top, TicketgroundSpacing.xxl)
            DiscoveryShortcutsSection(shortcuts: content.shortcuts)
                .padding(.top, TicketgroundSpacing.xxl)
        }
        .padding(.horizontal, TicketgroundSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct LiveStateOnlyHomeView: View {
    let state: LiveState
    let retryCatalog: () -> Void

    var body: some View {
        TicketgroundSurface(tone: .standard) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Text("공개 상태 조회")
                    .font(.title2.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                    .accessibilityIdentifier("live-state-home")
                Text("GET /api/state 응답")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(TicketgroundColor.accent)
                Text("공연 \(state.events.count)건 · 공연장 \(state.venues.count)곳")
                    .font(.headline)
                    .foregroundStyle(TicketgroundColor.ink)
                Text("백엔드 집계: 공연 \(state.backendSummary.events)건 · 티켓 \(state.backendSummary.tickets)건")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                Text("원장 검증: \(state.ledger.verified ? "완료" : "미확인") · 항목 \(state.ledger.totalEntries)건")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                Text("공연 목록, 검색, 상세와 좌석도는 아직 사용할 수 없습니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Text("GET /api/catalog 계약이 확인되지 않아 공연 정보를 추정하거나 표시하지 않습니다.")
                    .font(.footnote)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Button("공연 정보 다시 확인", action: retryCatalog)
                    .buttonStyle(.borderedProminent)
                    .accessibilityIdentifier("live-state-home-retry")
            }
        }
    }
}

struct DiscoveryCategoryGrid: View {
    let categories: [DiscoveryCategory]

    var body: some View {
        VStack(spacing: TicketgroundSpacing.md) {
            ForEach(Array(stride(from: 0, to: categories.count, by: 5)), id: \.self) { index in
                HStack(spacing: TicketgroundSpacing.xs) {
                    ForEach(Array(categories[index..<min(index + 5, categories.count)]), id: \.label) { category in
                        Group {
                            if category.route == .home {
                                Button(action: {}) {
                                    categoryLabel(category)
                                }
                            } else {
                                NavigationLink(value: category.route) {
                                    categoryLabel(category)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityValue(category.route == .home ? "selected" : "default")
                        .accessibilityIdentifier("discovery-category-\(categoryIdentifier(for: category.label))")
                    }
                }
            }
        }
        .padding(.vertical, TicketgroundSpacing.md)
    }

    private func categoryLabel(_ category: DiscoveryCategory) -> some View {
        VStack(spacing: TicketgroundSpacing.xs) {
            Image(systemName: category.systemImage)
                .font(.system(size: 19, weight: .regular))
                .foregroundStyle(category.route == .home ? TicketgroundColor.accent : TicketgroundColor.ink)
                .frame(height: 20)
            Text(category.label)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(category.route == .home ? TicketgroundColor.accent : TicketgroundColor.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, minHeight: 42)
    }

    private func categoryIdentifier(for label: String) -> String {
        switch label {
        case "홈": return "home"
        case "콘서트": return "concert"
        case "뮤지컬": return "musical"
        case "연극": return "play"
        case "클래식": return "classic"
        case "전시": return "exhibition"
        case "아동": return "child"
        case "스포츠": return "sports"
        case "티켓 양도": return "resale"
        case "캘린더": return "calendar"
        default: return "other"
        }
    }
}

struct DiscoveryFeaturedSection: View {
    let featured: DiscoveryFeatured
    let supporting: [DiscoveryFeatured]
    @Environment(\.colorScheme) private var colorScheme
    @State private var selectedIndex = 0

    var body: some View {
        let heroes = [featured] + supporting
        let selectedHero = heroes[selectedIndex % heroes.count]

        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            ZStack(alignment: .topLeading) {
                NavigationLink(value: selectedHero.route) {
                    ZStack(alignment: .topLeading) {
                        DiscoveryFeaturedImage(imageResource: selectedHero.imageResource, title: selectedHero.title)
                        LinearGradient(
                            colors: [.black.opacity(0.72), .clear, .black.opacity(0.72)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            HStack(spacing: TicketgroundSpacing.sm) {
                                Text(selectedHero.eyebrow)
                                    .font(.caption.weight(.black))
                                    .foregroundStyle(.black.opacity(0.9))
                                    .padding(.horizontal, TicketgroundSpacing.md)
                                    .frame(minHeight: 28)
                                    .background(.white.opacity(0.9))
                                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                                Spacer(minLength: 0)
                                Text("\(selectedIndex + 1) / \(heroes.count)")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, TicketgroundSpacing.md)
                                    .padding(.vertical, TicketgroundSpacing.sm)
                                    .background(.black.opacity(0.32))
                                    .clipShape(Capsule())
                                    .accessibilityIdentifier("discovery-hero-page-indicator")
                                    .accessibilityLabel("\(selectedIndex + 1) / \(heroes.count)")
                            }
                            Spacer(minLength: 0)
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                Text(selectedHero.title)
                                    .font(.system(size: 30, weight: .black))
                                    .foregroundStyle(.white)
                                    .lineLimit(2)
                                    .allowsTightening(true)
                                    .frame(maxWidth: 304, alignment: .leading)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .accessibilityLabel(selectedHero.title)
                                    .accessibilityIdentifier("discovery-featured-title")
                                Text(selectedHero.venue)
                                    .font(.headline.weight(.bold))
                                    .foregroundStyle(.white.opacity(0.92))
                                Text(selectedHero.date)
                                    .font(.footnote)
                                    .foregroundStyle(.white.opacity(0.8))
                                Text("\(selectedHero.cta)  →")
                                    .font(.subheadline.weight(.black))
                                    .foregroundStyle(colorScheme == .dark ? .white : TicketgroundColor.ink)
                                    .padding(.horizontal, TicketgroundSpacing.md)
                                    .frame(minHeight: 36)
                                    .background(colorScheme == .dark ? .black.opacity(0.7) : .white)
                                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                                    .accessibilityHidden(true)
                            }
                        }
                        .padding(TicketgroundSpacing.lg)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                    .frame(maxWidth: .infinity, alignment: .bottomLeading)
                    .frame(height: 420, alignment: .bottomLeading)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.large))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("discovery-featured-cta")
                HStack {
                    heroButton(
                        symbol: "‹",
                        label: "이전 추천 공연",
                        identifier: "discovery-hero-previous",
                        action: {
                            selectedIndex = (selectedIndex - 1 + heroes.count) % heroes.count
                        }
                    )
                    Spacer()
                    heroButton(
                        symbol: "›",
                        label: "다음 추천 공연",
                        identifier: "discovery-hero-next",
                        action: {
                            selectedIndex = (selectedIndex + 1) % heroes.count
                        }
                    )
                }
                .padding(.horizontal, TicketgroundSpacing.xl)
                .frame(maxHeight: .infinity, alignment: .center)
            }

        }
    }

    private func heroButton(
        symbol: String,
        label: String,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(symbol)
                .font(.title3.weight(.bold))
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(.black.opacity(0.32))
                .clipShape(Circle())
                .overlay(Circle().stroke(.white.opacity(0.65), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(supporting.isEmpty)
        .accessibilityIdentifier(identifier)
        .accessibilityLabel(label)
    }
}

struct DiscoveryFeaturedImage: View {
    let imageResource: String?
    let title: String

    var body: some View {
        TicketgroundMediaImage(
            resource: imageResource,
            role: .featured,
            accessibilityLabel: title,
            accessibilitySuffix: "home-featured"
        )
        .frame(maxWidth: .infinity)
        .frame(height: 420)
    }
}

struct DiscoveryPosterFallback: View {
    let title: String
    let imageResource: String?

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: TicketgroundRadius.small)
                .fill(TicketgroundColor.surfaceRaised)
            if let imageResource, !imageResource.isEmpty, UIImage(named: imageResource) != nil {
                Image(imageResource)
                    .resizable()
                    .scaledToFill()
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
            } else {
                VStack(spacing: TicketgroundSpacing.xs) {
                    Image(systemName: "ticket.fill")
                        .font(.title2)
                        .foregroundStyle(TicketgroundColor.accent)
                    Text("이미지 준비 중")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
                .accessibilityLabel("공연 포스터 이미지 없음")
            }
        }
        .frame(width: 92, height: 124)
        .accessibilityIdentifier("poster-fallback-\(title)")
    }
}

struct DiscoveryEmptyCalendarView: View {
    let action: () -> Void

    var body: some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Image(systemName: "calendar.badge.exclamationmark")
                    .font(.title)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                    .accessibilityHidden(true)
                Text("티켓오픈 일정이 없습니다.")
                    .font(.headline)
                    .foregroundStyle(TicketgroundColor.ink)
                Text("새로운 오픈 일정이 등록되면 이곳에서 확인할 수 있습니다.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                Button(action: action) {
                    Text("홈으로 돌아가기")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.ink)
                .accessibilityIdentifier("discovery-empty-action")
            }
        }
    }
}
