import XCTest
@testable import TicketGroundApp

final class DiscoveryHomeParityTests: XCTestCase {
    func testParityContentPreservesWebSectionOrder() {
        XCTAssertEqual(
            DiscoveryHomeSection.allCases,
            [.featured, .ranking, .opening, .resale, .genreRecommendations, .editorial, .shortcuts]
        )
    }

    func testParityContentMapsCustomerDestinations() {
        let content = DiscoveryFixtures.happyContent
        let parity = DiscoveryHomeComposition.make(from: content)

        XCTAssertEqual(parity.resale.destination, .resale)
        XCTAssertEqual(parity.genreGroups.first?.destination, .genre(name: "concert"))
        XCTAssertEqual(parity.editorials.first?.destination, .event(slug: "ticketground-day"))
        XCTAssertEqual(parity.openingMoreDestination, .open)
    }

    func testParityContentUsesCatalogDataAndCapsGenreGroups() {
        let content = DiscoveryFixtures.happyContent
        let parity = DiscoveryHomeComposition.make(from: content)

        XCTAssertEqual(parity.genreGroups.first?.events.count, 5)
        XCTAssertEqual(
            parity.resale.safetyItems.map(\.title),
            ["보유 티켓 확인", "정책 자동 판별", "QR 보호"]
        )
        XCTAssertEqual(parity.editorials.map(\.title), [content.featured.title])
    }
}

private enum DiscoveryFixtures {
    static let happyContent = DiscoveryContent(
        categories: [
            DiscoveryCategory(label: "콘서트", systemImage: "music.mic", route: .genre(name: "concert"))
        ],
        featured: DiscoveryFeatured(
            title: "Ticketground Day",
            eyebrow: "EDITORIAL",
            venue: "Ticketground",
            date: "2026.08.16",
            cta: "기획전 보기",
            route: .event(slug: "ticketground-day"),
            imageResource: nil
        ),
        supporting: [],
        rankings: (1...6).map(ranking),
        openingSoon: [
            DiscoveryOpening(
                month: "07",
                day: "01",
                time: "20:00",
                title: "IU 2026 WORLD TOUR",
                round: "팬클럽 선예매",
                dday: "D-3",
                genre: "콘서트",
                route: .goods(slug: "iu-world-tour"),
                alertRoute: .watchlist
            )
        ],
        shortcuts: [
            DiscoveryShortcut(label: "콘서트", helper: "인기 공연", route: .genre(name: "concert"))
        ],
        calendar: []
    )

    private static func ranking(_ rank: Int) -> DiscoveryRanking {
        DiscoveryRanking(
            rank: rank,
            title: "콘서트 추천 \(rank)",
            genre: "콘서트",
            venue: "잠실종합운동장",
            date: "2026.09.12",
            movement: .same,
            delta: "-",
            route: .goods(slug: "concert-\(rank)"),
            imageResource: nil
        )
    }
}
