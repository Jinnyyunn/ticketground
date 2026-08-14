import SwiftUI

struct LiveWatchlistRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: WatchlistState = .loading
    @State private var pendingEventIDs: Set<String> = []
    @State private var mutationError: String?
    @State private var reloadID = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("관심공연 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-watchlist")
                content
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("관심공연")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.current?.userID ?? "")-\(reloadID)") {
            await load()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            TicketgroundLoadingSurface(title: "관심공연을 불러오는 중")
                .accessibilityIdentifier("live-watchlist-loading")
        case .capability(let capability):
            LiveAccountCapabilitySurface(
                state: capability,
                title: "관심공연을 표시할 수 없습니다",
                loginMessage: "관심공연은 로그인이 필요합니다.",
                identifier: "live-watchlist",
                retry: { reloadID += 1 }
            )
        case .loaded(let userID, let items):
            if let mutationError {
                Text(mutationError)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityAddTraits(.updatesFrequently)
                    .accessibilityIdentifier("live-watchlist-mutation-error")
            }
            if items.isEmpty {
                LiveRouteMessageView(
                    title: "관심공연이 없습니다",
                    message: "공연 상세에서 관심공연을 추가하면 알림을 관리할 수 있습니다.",
                    identifier: "live-watchlist-empty"
                )
            } else {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                    Text("관심공연 \(items.count)개")
                        .font(.title2.weight(.black))
                    ForEach(items, id: \.id) { item in
                        itemCard(userID: userID, item: item)
                    }
                }
            }
        }
    }

    private func itemCard(userID: String, item: LiveWatchlistItem) -> some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Text(item.event?.title ?? "공연 정보 확인 중")
                    .font(.headline.weight(.bold))
                    .accessibilityIdentifier("live-watchlist-item-\(item.id)")
                Text(item.event?.venue ?? "공연장 정보 확인 중")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                HStack(spacing: TicketgroundSpacing.sm) {
                    Button(item.notificationEnabled ? "알림 켜짐" : "알림 꺼짐") {
                        Task { await toggleNotification(userID: userID, item: item) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(item.notificationEnabled ? TicketgroundColor.accent : TicketgroundColor.inkMuted)
                    .disabled(pendingEventIDs.contains(item.eventId))
                    .accessibilityIdentifier("live-watchlist-notification-\(item.eventId)")
                    Button("삭제", role: .destructive) {
                        Task { await remove(userID: userID, item: item) }
                    }
                    .buttonStyle(.bordered)
                    .disabled(pendingEventIDs.contains(item.eventId))
                    .accessibilityIdentifier("live-watchlist-remove-\(item.eventId)")
                }
                if pendingEventIDs.contains(item.eventId) {
                    ProgressView("변경사항 저장 중")
                        .font(.caption)
                        .accessibilityIdentifier("live-watchlist-pending-\(item.eventId)")
                }
            }
        }
    }

    private func load() async {
        if let scenario = RuntimeConfiguration.liveWatchlistTestScenario {
            switch scenario {
            case .loading: state = .loading
            case .empty: state = .loaded("ui-user", [])
            case .loaded, .mutationFailure: state = .loaded("ui-user", [Self.fixtureItem])
            }
            return
        }
        if let testState = RuntimeConfiguration.liveAccountCapabilityTestState {
            state = .capability(testState)
            return
        }
        let apiClient = container.environment.apiClient
        let unknownMap = LiveAPIContract.deployed.capabilityMap(
            for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: nil
        )
        let initial = LiveAccountCapabilityState.resolve(
            for: .watchlist,
            capabilityMap: unknownMap,
            session: container.environment.sessionStore.current,
            baseURL: apiClient.baseURL
        )
        guard initial == .retry else {
            state = .capability(initial)
            return
        }
        let service = LiveBackendService(apiClient: apiClient)
        do {
            let probe = try await service.diagnosePublicContract()
            let resolved = LiveAccountCapabilityState.resolve(
                for: .watchlist,
                capabilityMap: probe.capabilities,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard case .available(let userID) = resolved else {
                state = .capability(resolved)
                return
            }
            state = .loaded(userID, try await service.getWatchlist(userID: userID))
        } catch let error as APIClientError {
            state = .capability(LiveAccountCapabilityState.resolve(
                for: .watchlist,
                capabilityMap: unknownMap,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL,
                requestError: error
            ))
        } catch {
            state = .capability(.retry)
        }
    }

    private func toggleNotification(userID: String, item: LiveWatchlistItem) async {
        guard !pendingEventIDs.contains(item.eventId), case .loaded(_, let oldItems) = state else { return }
        pendingEventIDs.insert(item.eventId)
        mutationError = nil
        let optimistic = item.replacingNotification(enabled: !item.notificationEnabled)
        state = .loaded(userID, oldItems.replacing(itemID: item.id, with: optimistic))
        defer { pendingEventIDs.remove(item.eventId) }
        if RuntimeConfiguration.liveWatchlistTestScenario == .mutationFailure {
            state = .loaded(userID, oldItems)
            mutationError = "알림 설정을 저장하지 못해 이전 상태로 되돌렸습니다."
            return
        }
        do {
            let saved = try await LiveBackendService(apiClient: container.environment.apiClient).setWatchlistNotification(
                userID: userID,
                eventID: item.eventId,
                enabled: !item.notificationEnabled,
                idempotencyKey: UUID().uuidString
            )
            guard case .loaded(_, let currentItems) = state else { return }
            state = .loaded(userID, currentItems.replacing(itemID: item.id, with: saved))
        } catch {
            state = .loaded(userID, oldItems)
            mutationError = "알림 설정을 저장하지 못해 이전 상태로 되돌렸습니다."
        }
    }

    private func remove(userID: String, item: LiveWatchlistItem) async {
        guard !pendingEventIDs.contains(item.eventId), case .loaded(_, let oldItems) = state else { return }
        pendingEventIDs.insert(item.eventId)
        mutationError = nil
        state = .loaded(userID, oldItems.filter { $0.id != item.id })
        defer { pendingEventIDs.remove(item.eventId) }
        if RuntimeConfiguration.liveWatchlistTestScenario == .mutationFailure {
            state = .loaded(userID, oldItems)
            mutationError = "관심공연을 삭제하지 못해 목록을 복원했습니다."
            return
        }
        do {
            _ = try await LiveBackendService(apiClient: container.environment.apiClient).removeWatchlist(
                userID: userID,
                eventID: item.eventId,
                idempotencyKey: UUID().uuidString
            )
        } catch {
            state = .loaded(userID, oldItems)
            mutationError = "관심공연을 삭제하지 못해 목록을 복원했습니다."
        }
    }

    private static let fixtureItem = LiveWatchlistItem(
        id: "watch-1",
        userId: nil,
        eventId: "event-1",
        channels: ["APP_PUSH"],
        calendarEnabled: true,
        notificationEnabled: true,
        createdAt: "2026-08-01T00:00:00Z",
        updatedAt: "2026-08-01T00:00:00Z",
        event: LiveWatchlistEvent(id: "event-1", title: "Neon Stage 2026", venue: "잠실 실내체육관", venueId: "venue-1", category: "concert", saleState: "ON_SALE"),
        notificationJobs: []
    )
}

private enum WatchlistState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded(String, [LiveWatchlistItem])
}

private extension LiveWatchlistItem {
    func replacingNotification(enabled: Bool) -> LiveWatchlistItem {
        LiveWatchlistItem(
            id: id,
            userId: userId,
            eventId: eventId,
            channels: channels,
            calendarEnabled: calendarEnabled,
            notificationEnabled: enabled,
            createdAt: createdAt,
            updatedAt: updatedAt,
            event: event,
            notificationJobs: notificationJobs
        )
    }
}

private extension Array where Element == LiveWatchlistItem {
    func replacing(itemID: String, with replacement: LiveWatchlistItem) -> [LiveWatchlistItem] {
        map { $0.id == itemID ? replacement : $0 }
    }
}
