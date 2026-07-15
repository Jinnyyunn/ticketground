import Foundation

struct DiscoveryFixtureBody: Decodable {
    let categories: [DiscoveryCategoryDTO]
    let featured: DiscoveryFeaturedDTO
    let supporting: [DiscoveryFeaturedDTO]
    let rankings: [DiscoveryRankingDTO]
    let openingSoon: [DiscoveryOpeningDTO]
    let shortcuts: [DiscoveryShortcutDTO]
    let calendar: [DiscoveryCalendarDTO]
}

struct DiscoveryCategoryDTO: Decodable {
    let label: String
    let systemImage: String
    let route: String
}

struct DiscoveryFeaturedDTO: Decodable {
    let title: String
    let eyebrow: String
    let venue: String
    let date: String
    let cta: String
    let route: String
    let imageResource: String?
}

struct DiscoveryRankingDTO: Decodable {
    let rank: Int
    let title: String
    let genre: String
    let venue: String
    let date: String
    let movement: String
    let delta: String
    let route: String
    let imageResource: String?
}

struct DiscoveryOpeningDTO: Decodable {
    let month: String
    let day: String
    let time: String
    let title: String
    let round: String
    let dday: String
    let genre: String
    let route: String
    let alertRoute: String
}

struct DiscoveryShortcutDTO: Decodable {
    let label: String
    let helper: String
    let route: String
}

struct DiscoveryCalendarDTO: Decodable {
    let day: Int
    let title: String
    let genre: String
    let openingStatus: String
    let route: String
}

struct DiscoveryContent: Equatable {
    let categories: [DiscoveryCategory]
    let featured: DiscoveryFeatured
    let supporting: [DiscoveryFeatured]
    let rankings: [DiscoveryRanking]
    let openingSoon: [DiscoveryOpening]
    let shortcuts: [DiscoveryShortcut]
    let calendar: [DiscoveryCalendar]
}

struct DiscoveryCategory: Equatable {
    let label: String
    let systemImage: String
    let route: AppRoute
}

struct DiscoveryFeatured: Equatable {
    let title: String
    let eyebrow: String
    let venue: String
    let date: String
    let cta: String
    let route: AppRoute
    let imageResource: String?
}

struct DiscoveryRanking: Equatable {
    let rank: Int
    let title: String
    let genre: String
    let venue: String
    let date: String
    let movement: DiscoveryMovement
    let delta: String
    let route: AppRoute
    let imageResource: String?
}

enum DiscoveryMovement: Equatable {
    case up
    case down
    case same
    case unknown(rawValue: String)

    init(rawValue: String) {
        switch rawValue {
        case "up": self = .up
        case "down": self = .down
        case "same": self = .same
        default: self = .unknown(rawValue: rawValue)
        }
    }

    var symbol: String {
        switch self {
        case .up: return "▲"
        case .down: return "▼"
        case .same: return "—"
        case .unknown: return "?"
        }
    }
}

struct DiscoveryOpening: Equatable {
    let month: String
    let day: String
    let time: String
    let title: String
    let round: String
    let dday: String
    let genre: String
    let route: AppRoute
    let alertRoute: AppRoute
}

struct DiscoveryShortcut: Equatable {
    let label: String
    let helper: String
    let route: AppRoute
}

struct DiscoveryCalendar: Equatable {
    let day: Int
    let title: String
    let genre: String
    let openingStatus: String
    let route: AppRoute
}
