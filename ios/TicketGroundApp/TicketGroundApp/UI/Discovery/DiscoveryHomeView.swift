import SwiftUI

struct DiscoveryHomeView: View {
    let content: DiscoveryContent

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
            DiscoveryCategoryGrid(categories: content.categories)
            DiscoveryFeaturedSection(featured: content.featured, supporting: content.supporting)
            DiscoveryRankingSection(rankings: content.rankings)
            DiscoveryOpeningSection(openingSoon: content.openingSoon)
            DiscoveryShortcutsSection(shortcuts: content.shortcuts)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct DiscoveryCategoryGrid: View {
    let categories: [DiscoveryCategory]

    var body: some View {
        VStack(spacing: TicketgroundSpacing.xs) {
            ForEach(Array(stride(from: 0, to: categories.count, by: 5)), id: \.self) { index in
                HStack(spacing: TicketgroundSpacing.xs) {
                    ForEach(Array(categories[index..<min(index + 5, categories.count)]), id: \.label) { category in
                        NavigationLink(value: category.route) {
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
                        .buttonStyle(.plain)
                        .accessibilityValue(category.route == .home ? "selected" : "default")
                        .accessibilityIdentifier("discovery-category-\(categoryIdentifier(for: category.label))")
                    }
                }
            }
        }
        .padding(.vertical, TicketgroundSpacing.xs)
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

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            ZStack(alignment: .topLeading) {
                NavigationLink(value: featured.route) {
                    ZStack(alignment: .topLeading) {
                        DiscoveryFeaturedImage(imageResource: featured.imageResource, title: featured.title)
                        LinearGradient(
                            colors: [TicketgroundColor.ink.opacity(0.72), .clear, TicketgroundColor.ink.opacity(0.72)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            HStack(spacing: TicketgroundSpacing.sm) {
                                Text(featured.eyebrow)
                                    .font(.caption.weight(.black))
                                    .foregroundStyle(TicketgroundColor.ink)
                                    .padding(.horizontal, TicketgroundSpacing.md)
                                    .frame(minHeight: 28)
                                    .background(.white.opacity(0.9))
                                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                                Spacer(minLength: 0)
                                Text("1 / \(max(supporting.count + 1, 2))")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, TicketgroundSpacing.md)
                                    .padding(.vertical, TicketgroundSpacing.sm)
                                    .background(.black.opacity(0.32))
                                    .clipShape(Capsule())
                                    .accessibilityIdentifier("discovery-hero-page-indicator")
                                    .accessibilityLabel("1 / \(max(supporting.count + 1, 2))")
                            }
                            Text(featured.title)
                                .font(.system(size: 30, weight: .black))
                                .foregroundStyle(.white)
                                .lineLimit(2)
                                .allowsTightening(true)
                                .frame(maxWidth: 304, alignment: .leading)
                                .fixedSize(horizontal: false, vertical: true)
                                .accessibilityLabel(featured.title)
                                .accessibilityIdentifier("discovery-featured-title")
                            Text(featured.venue)
                                .font(.headline.weight(.bold))
                                .foregroundStyle(.white.opacity(0.92))
                            Text(featured.date)
                                .font(.footnote)
                                .foregroundStyle(.white.opacity(0.8))
                        }
                        .padding(TicketgroundSpacing.lg)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        HStack {
                            Text("\(featured.cta)  →")
                                .font(.headline.weight(.black))
                                .foregroundStyle(TicketgroundColor.ink)
                                .padding(.horizontal, TicketgroundSpacing.lg)
                                .frame(minHeight: 40)
                                .background(.white)
                                .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                                .accessibilityHidden(true)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, TicketgroundSpacing.lg)
                        .padding(.bottom, TicketgroundSpacing.lg)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                        HStack {
                            Text("‹")
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 28, height: 28)
                                .background(.black.opacity(0.32))
                                .clipShape(Circle())
                                .overlay(Circle().stroke(.white.opacity(0.65), lineWidth: 1))
                                .accessibilityIdentifier("discovery-hero-previous")
                            Spacer()
                            Text("›")
                                .font(.title3.weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 28, height: 28)
                                .background(.black.opacity(0.32))
                                .clipShape(Circle())
                                .overlay(Circle().stroke(.white.opacity(0.65), lineWidth: 1))
                                .accessibilityIdentifier("discovery-hero-next")
                        }
                        .padding(.horizontal, TicketgroundSpacing.xl)
                        .frame(maxHeight: .infinity, alignment: .center)
                    }
                    .frame(maxWidth: .infinity, alignment: .bottomLeading)
                    .frame(height: 420, alignment: .bottomLeading)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.large))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("discovery-featured-cta")
            }

        }
    }
}

struct DiscoveryFeaturedImage: View {
    let imageResource: String?
    let title: String

    var body: some View {
        TicketgroundMediaImage(
            resource: imageResource,
            role: .featured,
            accessibilityLabel: title
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
