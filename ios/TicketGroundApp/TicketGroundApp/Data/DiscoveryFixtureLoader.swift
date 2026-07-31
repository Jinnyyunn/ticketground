import Foundation

enum LiveDiscoveryHomeContent {
    case catalog(DiscoveryContent)
    case stateOnly(LiveState)
}

enum DiscoveryFixtureLoader {
    static func load() throws -> DiscoveryContent {
        let bundle = Bundle(for: VirtualFixtureBundleMarker.self)
        guard let url = bundle.url(forResource: "discovery", withExtension: "json") else {
            throw VirtualFixtureDecodeError.invalidResponse
        }
        let data = try Data(contentsOf: url)
        let fixture: FixtureEnvelope<DiscoveryFixtureBody> = try VirtualFixtureDecoder.decode(data, as: FixtureEnvelope<DiscoveryFixtureBody>.self)
        guard fixture.mode == "virtual", fixture.source == "fixture-only", fixture.live == false,
              fixture.deterministic, fixture.status == 200 else {
            throw VirtualFixtureDecodeError.invalidResponse
        }
        return try map(fixture.body)
    }

    static func loadLive(using apiClient: APIClient) async throws -> LiveDiscoveryHomeContent {
        let service = LiveBackendService(apiClient: apiClient)
        do {
            let catalog = try await service.getCatalog()
            guard !catalog.events.isEmpty else { throw VirtualFixtureDecodeError.emptyResponse }
            return .catalog(try map(catalog.events, using: apiClient))
        } catch let error as APIClientError {
            guard error == .capabilityUnavailable(endpoint: .catalog, state: .unknown) else {
                throw error
            }
            return .stateOnly(try await service.getState())
        }
    }

    private static func map(_ body: DiscoveryFixtureBody) throws -> DiscoveryContent {
        DiscoveryContent(
            categories: try body.categories.map(category),
            featured: try featured(body.featured),
            supporting: try body.supporting.map(featured),
            rankings: try body.rankings.map(ranking),
            openingSoon: try body.openingSoon.map(opening),
            shortcuts: try body.shortcuts.map(shortcut),
            calendar: try body.calendar.map(calendar)
        )
    }

    private static func category(_ dto: DiscoveryCategoryDTO) throws -> DiscoveryCategory {
        DiscoveryCategory(label: dto.label, systemImage: dto.systemImage, route: try route(dto.route))
    }

    private static func featured(_ dto: DiscoveryFeaturedDTO) throws -> DiscoveryFeatured {
        DiscoveryFeatured(title: dto.title, eyebrow: dto.eyebrow, venue: dto.venue, date: dto.date, cta: dto.cta, route: try route(dto.route), imageResource: dto.imageResource)
    }

    private static func ranking(_ dto: DiscoveryRankingDTO) throws -> DiscoveryRanking {
        DiscoveryRanking(rank: dto.rank, title: dto.title, genre: dto.genre, venue: dto.venue, date: dto.date, movement: DiscoveryMovement(rawValue: dto.movement), delta: dto.delta, route: try route(dto.route), imageResource: dto.imageResource)
    }

    private static func opening(_ dto: DiscoveryOpeningDTO) throws -> DiscoveryOpening {
        DiscoveryOpening(month: dto.month, day: dto.day, time: dto.time, title: dto.title, round: dto.round, dday: dto.dday, genre: dto.genre, route: try route(dto.route), alertRoute: try route(dto.alertRoute))
    }

    private static func shortcut(_ dto: DiscoveryShortcutDTO) throws -> DiscoveryShortcut {
        DiscoveryShortcut(label: dto.label, helper: dto.helper, route: try route(dto.route))
    }

    private static func calendar(_ dto: DiscoveryCalendarDTO) throws -> DiscoveryCalendar {
        DiscoveryCalendar(day: dto.day, title: dto.title, genre: dto.genre, openingStatus: dto.openingStatus, route: try route(dto.route))
    }

    private static func route(_ path: String) throws -> AppRoute {
        guard let route = RouteResolver.resolve(path: path) else {
            throw VirtualFixtureDecodeError.invalidResponse
        }
        return route
    }

    private static func map(_ events: [LiveBackendCatalogEvent], using apiClient: APIClient) throws -> DiscoveryContent {
        let categories = [
            DiscoveryCategory(label: "홈", systemImage: "house.fill", route: .home),
            DiscoveryCategory(label: "콘서트", systemImage: "music.mic", route: .genre(name: "concert")),
            DiscoveryCategory(label: "뮤지컬", systemImage: "theatermasks.fill", route: .genre(name: "musical")),
            DiscoveryCategory(label: "연극", systemImage: "person.2.fill", route: .genre(name: "play")),
            DiscoveryCategory(label: "클래식", systemImage: "pianokeys", route: .genre(name: "classic")),
            DiscoveryCategory(label: "전시", systemImage: "photo.artframe", route: .genre(name: "exhibition")),
            DiscoveryCategory(label: "아동", systemImage: "figure.2.and.child.holdinghands", route: .genre(name: "child")),
            DiscoveryCategory(label: "스포츠", systemImage: "sportscourt.fill", route: .genre(name: "sports")),
            DiscoveryCategory(label: "티켓 양도", systemImage: "arrow.left.arrow.right", route: .resale),
            DiscoveryCategory(label: "캘린더", systemImage: "calendar", route: .open)
        ]
        let featured = try featuredLive(events[0], eyebrow: "LIVE BACKEND", using: apiClient)
        let supporting = try events.dropFirst().prefix(1).map { try featuredLive($0, eyebrow: "LIVE", using: apiClient) }
        let rankings = try events
            .sorted { lhs, rhs in
                switch (lhs.pinnedRank, rhs.pinnedRank) {
                case let (left?, right?): return left < right
                case (_?, nil): return true
                case (nil, _?): return false
                case (nil, nil): return lhs.soldCount > rhs.soldCount
                }
            }
            .prefix(10)
            .enumerated()
            .map { index, event in try ranking(event, rank: index + 1, using: apiClient) }
        let shortcuts = [
            DiscoveryShortcut(label: "지방 공연", helper: "부산·대구·광주", route: .region),
            DiscoveryShortcut(label: "대학로", helper: "소극장 신작", route: .genre(name: "musical")),
            DiscoveryShortcut(label: "양도", helper: "공식 풀 거래", route: .resale),
            DiscoveryShortcut(label: "VIP석", helper: "등급별 보기", route: .ranking),
            DiscoveryShortcut(label: "오픈캘린더", helper: "D-3 알림", route: .open)
        ]
        return DiscoveryContent(categories: categories, featured: featured, supporting: supporting, rankings: rankings, openingSoon: [], shortcuts: shortcuts, calendar: [])
    }

    private static func featuredLive(_ event: LiveBackendCatalogEvent, eyebrow: String, using apiClient: APIClient) throws -> DiscoveryFeatured {
        DiscoveryFeatured(
            title: event.title,
            eyebrow: eyebrow,
            venue: event.venue,
            date: event.period ?? formattedDate(event.date),
            cta: "공연 상세 보기",
            route: .goods(slug: event.slug ?? event.id),
            imageResource: apiClient.resolveResource(event.image)
        )
    }

    private static func ranking(_ event: LiveBackendCatalogEvent, rank: Int, using apiClient: APIClient) throws -> DiscoveryRanking {
        DiscoveryRanking(
            rank: rank,
            title: event.title,
            genre: displayCategory(event.category),
            venue: event.venue,
            date: formattedDate(event.date),
            movement: .same,
            delta: "-",
            route: .goods(slug: event.slug ?? event.id),
            imageResource: apiClient.resolveResource(event.image)
        )
    }

    private static func displayCategory(_ category: String?) -> String {
        switch category?.lowercased() {
        case "concert": return "콘서트"
        case "musical": return "뮤지컬"
        case "play", "theater": return "연극"
        case "classic": return "클래식"
        case "exhibition": return "전시"
        case "child", "children", "family": return "아동"
        case "sports": return "스포츠"
        case "event": return "행사"
        default: return category ?? "공연"
        }
    }

    private static func formattedDate(_ date: String?) -> String {
        guard let date else { return "일정 미정" }
        let pieces = date.split(separator: "T")
        guard let day = pieces.first else { return date }
        let components = day.split(separator: "-")
        guard components.count == 3 else { return date }
        let time = pieces.count > 1 ? String(pieces[1].prefix(5)) : ""
        return time.isEmpty
            ? "\(components[0]).\(components[1]).\(components[2])"
            : "\(components[0]).\(components[1]).\(components[2]) \(time)"
    }
}
