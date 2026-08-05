import SwiftUI

private enum LiveDiscoveryContractState {
    case loading
    case loaded(LiveDiscoveryContractContent)
    case notFound
    case failed(PublicReadPresentation)
}

private enum LiveDiscoveryContractContent {
    case regions([LiveRegionGroup])
    case artist(LiveArtistDiscovery)
    case openCalendar([LiveOpenCalendarEntry])
}

struct LiveDiscoveryContractView: View {
    let route: AppRoute
    @Environment(AppContainer.self) private var container
    @State private var state: LiveDiscoveryContractState = .loading
    @State private var reloadID = 0

    var body: some View {
        Group {
            switch state {
            case .loading:
                TicketgroundLoadingSurface(title: "\(title) 불러오는 중")
            case .loaded(let content):
                contentView(content)
            case .notFound:
                TicketgroundEmptySurface(
                    title: "아티스트를 찾을 수 없습니다",
                    message: "요청한 아티스트의 공개 공연 정보가 없습니다.",
                    actionTitle: "다시 시도",
                    action: retry
                )
                .accessibilityIdentifier("live-discovery-not-found")
            case .failed(let presentation):
                TicketgroundErrorSurface(
                    title: presentation.title,
                    message: presentation.message,
                    actionTitle: "다시 시도",
                    action: retry
                )
                .accessibilityIdentifier("live-discovery-error")
            }
        }
        .accessibilityIdentifier("live-discovery-contract-state")
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) {
            await load()
        }
    }

    @ViewBuilder
    private func contentView(_ content: LiveDiscoveryContractContent) -> some View {
        switch content {
        case .regions(let regions):
            if regions.isEmpty {
                emptySurface(message: "현재 공개된 지역별 공연이 없습니다.")
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                        ForEach(regions, id: \.slug) { region in
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                                Text("\(region.name) · \(region.eventCount)개")
                                    .font(.title3.weight(.black))
                                ForEach(region.events, id: \.id) { event in
                                    eventRow(event)
                                }
                            }
                            .accessibilityIdentifier("live-discovery-region-\(region.slug)")
                        }
                    }
                    .padding(TicketgroundSpacing.xl)
                }
            }
        case .artist(let discovery):
            if discovery.events.isEmpty {
                emptySurface(message: "현재 공개된 아티스트 공연이 없습니다.")
            } else {
                eventList(
                    heading: discovery.artist.name,
                    events: discovery.events,
                    identifier: "live-discovery-artist-\(discovery.artist.slug)"
                )
            }
        case .openCalendar(let entries):
            if entries.isEmpty {
                emptySurface(message: "현재 공개된 티켓오픈 일정이 없습니다.")
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                        ForEach(entries, id: \.event.id) { entry in
                            VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                                Text(Self.displayDate(entry.opensAt))
                                    .font(.caption.weight(.black))
                                    .foregroundStyle(TicketgroundColor.accent)
                                eventRow(entry.event)
                            }
                            .accessibilityIdentifier("live-discovery-open-\(entry.event.id)")
                        }
                    }
                    .padding(TicketgroundSpacing.xl)
                }
            }
        }
    }

    private func eventList(
        heading: String,
        events: [LiveBackendCatalogEvent],
        identifier: String
    ) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Text(heading)
                    .font(.title2.weight(.black))
                ForEach(events, id: \.id) { event in
                    eventRow(event)
                }
            }
            .padding(TicketgroundSpacing.xl)
        }
        .accessibilityIdentifier(identifier)
    }

    private func eventRow(_ event: LiveBackendCatalogEvent) -> some View {
        NavigationLink(value: AppRoute.event(slug: event.slug ?? event.id)) {
            TicketgroundSurface {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Text(event.title)
                        .font(.headline.weight(.black))
                        .foregroundStyle(TicketgroundColor.ink)
                    Text(event.venue)
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                    if let saleLabel = event.sale?.label {
                        Text(saleLabel)
                            .font(.caption.weight(.bold))
                            .foregroundStyle(TicketgroundColor.accent)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("live-discovery-event-\(event.id)")
    }

    private func emptySurface(message: String) -> some View {
        TicketgroundEmptySurface(
            title: title,
            message: message,
            actionTitle: "다시 시도",
            action: retry
        )
        .accessibilityIdentifier("live-discovery-empty")
    }

    private func load() async {
        guard case .loading = state else { return }
        let service = LiveBackendService(apiClient: container.environment.apiClient)
        do {
            _ = try await service.diagnosePublicContract()
            switch route {
            case .region:
                state = .loaded(.regions(try await service.getRegions().regions))
            case .artist(let slug):
                state = .loaded(.artist(try await service.getArtist(slug: slug)))
            case .open:
                state = .loaded(.openCalendar(try await service.getOpenCalendar().entries))
            default:
                state = .failed(PublicReadPresentation.resolve(APIClientError.invalidResponse))
            }
        } catch let error as APIClientError {
            if case .server(status: 404, _, _) = error, case .artist = route {
                state = .notFound
            } else {
                state = .failed(PublicReadPresentation.resolve(error))
            }
        } catch {
            state = .failed(PublicReadPresentation.resolve(error))
        }
    }

    private func retry() {
        state = .loading
        reloadID += 1
    }

    private var title: String {
        switch route {
        case .region: return "지역별 공연"
        case .artist: return "아티스트 공연"
        case .open: return "티켓오픈 캘린더"
        default: return "공연 탐색"
        }
    }

    private static func displayDate(_ value: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: value) else { return value }
        return date.formatted(date: .long, time: .shortened)
    }
}
