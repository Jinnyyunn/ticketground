import Foundation

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

    static func load(using apiClient: APIClient) async throws -> DiscoveryContent {
        let data = try await apiClient.data(for: "/api/catalog")
        let response = try JSONDecoder().decode(LiveCatalogResponse.self, from: data)
        guard !response.events.isEmpty else { throw VirtualFixtureDecodeError.emptyResponse }
        return try map(response.events, using: apiClient)
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

    private static func map(_ events: [LiveCatalogEvent], using apiClient: APIClient) throws -> DiscoveryContent {
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
        let openingSoon = try events.prefix(4).map { try opening($0) }
        let shortcuts = [
            DiscoveryShortcut(label: "지방 공연", helper: "부산·대구·광주", route: .region),
            DiscoveryShortcut(label: "대학로", helper: "소극장 신작", route: .genre(name: "musical")),
            DiscoveryShortcut(label: "양도", helper: "공식 풀 거래", route: .resale),
            DiscoveryShortcut(label: "VIP석", helper: "등급별 보기", route: .ranking),
            DiscoveryShortcut(label: "오픈캘린더", helper: "D-3 알림", route: .open),
            DiscoveryShortcut(label: "당일 공연", helper: "오늘 입장 가능", route: .search)
        ]
        let calendar = try events.prefix(4).map { try calendarLive($0) }
        return DiscoveryContent(categories: categories, featured: featured, supporting: supporting, rankings: rankings, openingSoon: openingSoon, shortcuts: shortcuts, calendar: calendar)
    }

    private static func featuredLive(_ event: LiveCatalogEvent, eyebrow: String, using apiClient: APIClient) throws -> DiscoveryFeatured {
        DiscoveryFeatured(
            title: event.title,
            eyebrow: eyebrow,
            venue: event.venue,
            date: event.period ?? formattedDate(event.date),
            cta: "예매하기",
            route: .goods(slug: event.slug ?? event.id),
            imageResource: apiClient.resolveResource(event.image)
        )
    }

    private static func ranking(_ event: LiveCatalogEvent, rank: Int, using apiClient: APIClient) throws -> DiscoveryRanking {
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

    private static func opening(_ event: LiveCatalogEvent) throws -> DiscoveryOpening {
        let components = event.date?.split(separator: "-") ?? []
        let month = components.count > 1 ? String(Int(components[1]) ?? 0) : "-"
        let day = components.count > 2 ? String(Int(components[2].prefix(2)) ?? 0) : "-"
        return DiscoveryOpening(
            month: month,
            day: day,
            time: event.date?.split(separator: "T").last.map { String($0.prefix(5)) } ?? "-",
            title: event.title,
            round: event.sale?.note ?? "일반예매",
            dday: event.sale?.label ?? "오픈 예정",
            genre: displayCategory(event.category),
            route: .goods(slug: event.slug ?? event.id),
            alertRoute: .watchlist
        )
    }

    private static func calendarLive(_ event: LiveCatalogEvent) throws -> DiscoveryCalendar {
        let day = Int(event.date?.split(separator: "-").last?.prefix(2) ?? "") ?? 0
        return DiscoveryCalendar(
            day: day,
            title: event.title,
            genre: displayCategory(event.category),
            openingStatus: event.sale?.note ?? "일반예매",
            route: .goods(slug: event.slug ?? event.id)
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
        let time = pieces.last.map { String($0.prefix(5)) } ?? ""
        return time.isEmpty
            ? "\(components[0]).\(components[1]).\(components[2])"
            : "\(components[0]).\(components[1]).\(components[2]) \(time)"
    }
}

private struct LiveCatalogResponse: Decodable {
    let events: [LiveCatalogEvent]
}

private struct LiveCatalogEvent: Decodable {
    let id: String
    let slug: String?
    let category: String?
    let title: String
    let venue: String
    let date: String?
    let period: String?
    let image: String?
    let pinnedRank: Int?
    let soldCount: Int
    let sale: LiveSale?
}

private struct LiveSale: Decodable {
    let state: String?
    let label: String?
    let note: String?
}
