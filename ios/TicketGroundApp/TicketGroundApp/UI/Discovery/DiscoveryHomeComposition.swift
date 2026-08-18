import Foundation

enum DiscoveryHomeComposition {
    static func make(from content: DiscoveryContent) -> DiscoveryHomeParityContent {
        DiscoveryHomeParityContent(
            openingMoreDestination: .open,
            resale: DiscoveryResaleCard(
                destination: .resale,
                safetyItems: resaleSafetyItems
            ),
            genreGroups: genreGroups(from: content),
            editorials: ([content.featured] + content.supporting)
                .enumerated()
                .map { index, featured in
                    DiscoveryEditorialCard(
                        order: index + 1,
                        title: featured.title,
                        destination: featured.route,
                        imageResource: featured.imageResource
                    )
                }
        )
    }

    private static func genreGroups(from content: DiscoveryContent) -> [DiscoveryGenreGroup] {
        content.categories.compactMap { category in
            guard case .genre = category.route else { return nil }
            let events = Array(content.rankings.filter { $0.genre == category.label }.prefix(5))
            guard !events.isEmpty else { return nil }
            return DiscoveryGenreGroup(
                label: category.label,
                destination: category.route,
                events: events
            )
        }
    }

    private static let resaleSafetyItems = [
        DiscoveryResaleSafetyItem(
            order: 1,
            title: "보유 티켓 확인",
            detail: "예매 내역에서 보유 티켓을 확인합니다.",
            systemImage: "ticket.fill"
        ),
        DiscoveryResaleSafetyItem(
            order: 2,
            title: "정책 자동 판별",
            detail: "정가 범위와 구매 이력을 자동으로 판별합니다.",
            systemImage: "checkmark.shield.fill"
        ),
        DiscoveryResaleSafetyItem(
            order: 3,
            title: "QR 보호",
            detail: "입장 직전에 보호된 QR을 발급합니다.",
            systemImage: "qrcode.viewfinder"
        )
    ]
}
