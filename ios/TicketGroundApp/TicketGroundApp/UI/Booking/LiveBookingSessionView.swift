import SwiftUI

struct LiveBookingSessionView: View {
    let slug: String
    @Environment(AppContainer.self) private var container
    @State private var state: BookingState = .loading
    @State private var selectedSeat: LiveBookingSeat?
    @State private var hold: LiveSeatHold?
    @State private var draft: LiveReservationDraft?
    @State private var actionError: String?
    @State private var isSubmitting = false
    @State private var reloadID = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("예매 좌석 선택 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-booking")
                content
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("좌석 선택")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: reloadID) { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            TicketgroundLoadingSurface(title: "대기열과 좌석 상태를 확인하는 중")
                .accessibilityIdentifier("live-booking-loading")
        case .capability(let capability):
            LiveAccountCapabilitySurface(
                state: capability,
                title: "예매를 시작할 수 없습니다",
                loginMessage: "좌석 선택은 로그인이 필요합니다.",
                identifier: "live-booking",
                retry: { reloadID += 1 }
            )
        case .expired:
            TicketgroundErrorSurface(
                title: "좌석 선택 시간이 만료되었습니다",
                message: "대기열에 다시 입장하면 최신 좌석 상태를 확인할 수 있습니다.",
                actionTitle: "다시 입장",
                action: { reloadID += 1 }
            )
            .accessibilityIdentifier("live-booking-expired")
        case .loaded(let userID, let snapshot):
            queueCard(snapshot.queue)
            if RuntimeConfiguration.liveBookingTestScenario == .reconnect {
                Text("서버와 다시 연결되어 최신 좌석 상태로 복구했습니다.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(TicketgroundColor.success)
                    .accessibilityIdentifier("live-booking-reconnected")
            }
            seatGrid(userID: userID, snapshot: snapshot)
            summary(userID: userID, snapshot: snapshot)
        }
    }

    private func queueCard(_ queue: LiveBookingQueue) -> some View {
        TicketgroundSurface(tone: .muted) {
            HStack {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Text(queue.status == "READY" ? "입장 완료" : "대기 중")
                        .font(.headline.weight(.black))
                    Text("좌석 상태는 서버 기준으로 갱신됩니다.")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
                Spacer()
                TicketgroundTag(title: "결제 전", tone: .open)
            }
        }
        .accessibilityIdentifier("live-booking-queue")
    }

    private func seatGrid(userID: String, snapshot: LiveBookingSeatSnapshot) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text(snapshot.event.title)
                .font(.title3.weight(.black))
            Text("좌석을 한 자리 선택해 주세요")
                .font(.subheadline)
                .foregroundStyle(TicketgroundColor.inkSecondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 88), spacing: TicketgroundSpacing.sm)], spacing: TicketgroundSpacing.sm) {
                ForEach(snapshot.seats.prefix(18), id: \.ticketId) { seat in
                    Button {
                        Task { await select(userID: userID, seat: seat, snapshot: snapshot) }
                    } label: {
                        VStack(spacing: TicketgroundSpacing.xs) {
                            Text(seat.label).font(.caption.weight(.bold)).lineLimit(1)
                            Text(seatState(seat)).font(.caption2)
                        }
                        .frame(maxWidth: .infinity, minHeight: 54)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(seatTint(seat))
                    .disabled(isSubmitting || !["SELECTABLE", "HELD_BY_YOU"].contains(seat.state))
                    .accessibilityIdentifier("live-booking-seat-\(seat.ticketId)")
                    .accessibilityValue(seat.state)
                }
            }
        }
    }

    @ViewBuilder
    private func summary(userID: String, snapshot: LiveBookingSeatSnapshot) -> some View {
        if let actionError {
            Text(actionError)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TicketgroundColor.accent)
                .accessibilityAddTraits(.updatesFrequently)
                .accessibilityIdentifier("live-booking-conflict")
        }
        if let selectedSeat, let hold {
            TicketgroundSurface {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                    Text("선택한 좌석")
                        .font(.headline.weight(.black))
                    Text(selectedSeat.label)
                    Text(selectedSeat.price.formatted(.currency(code: "KRW")))
                    Text("홀드 만료: \(hold.expiresAt)")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                    if draft != nil {
                        Text("예약 초안이 준비되었습니다. 결제 완료 상태는 아직 아닙니다.")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(TicketgroundColor.success)
                            .accessibilityIdentifier("live-booking-draft")
                    } else {
                        TicketgroundPrimaryButton(
                            title: isSubmitting ? "준비 중" : "예약 초안 만들기",
                            accessibilityIdentifier: "live-booking-create-draft"
                        ) {
                            Task { await createDraft(userID: userID, hold: hold) }
                        }
                        .disabled(isSubmitting)
                    }
                    Button("좌석 선택 해제", role: .destructive) {
                        Task { await release(userID: userID, hold: hold, snapshot: snapshot) }
                    }
                    .disabled(isSubmitting)
                    .accessibilityIdentifier("live-booking-release")
                }
            }
        }
    }

    private func load() async {
        if let scenario = RuntimeConfiguration.liveBookingTestScenario {
            switch scenario {
            case .loading: state = .loading
            case .expired: state = .expired
            case .loaded, .conflict, .reconnect: state = .loaded("ui-user", Self.fixtureSnapshot)
            }
            return
        }
        let apiClient = container.environment.apiClient
        let service = LiveBackendService(apiClient: apiClient)
        do {
            let catalog = try await service.getCatalog()
            guard let event = LiveCatalogRouteMatcher.detailEvents(slug: slug, in: catalog).first,
                  let performanceID = event.dates?.first?.id else {
                state = .capability(.help)
                return
            }
            let probe = try await service.diagnosePublicContract()
            let resolved = LiveAccountCapabilityState.resolve(
                for: .booking,
                capabilityMap: probe.capabilities,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard case .available(let userID) = resolved else {
                state = .capability(resolved)
                return
            }
            let queue = try await service.joinBookingQueue(
                userID: userID,
                eventID: event.id,
                performanceID: performanceID,
                idempotencyKey: UUID().uuidString
            )
            let snapshot = try await service.getBookingSeats(
                userID: userID,
                eventID: event.id,
                performanceID: performanceID,
                queueID: queue.id
            )
            state = .loaded(userID, snapshot)
        } catch let error as APIClientError {
            state = error.serverCode == "BOOKING_QUEUE_INACTIVE" ? .expired : .capability(.retry)
        } catch {
            state = .capability(.retry)
        }
    }

    private func select(userID: String, seat: LiveBookingSeat, snapshot: LiveBookingSeatSnapshot) async {
        guard !isSubmitting else { return }
        isSubmitting = true
        actionError = nil
        defer { isSubmitting = false }
        if RuntimeConfiguration.liveBookingTestScenario == .conflict {
            actionError = "다른 사용자가 먼저 선택한 좌석입니다. 최신 좌석 상태로 갱신했습니다."
            return
        }
        if RuntimeConfiguration.liveBookingTestScenario != nil {
            selectedSeat = seat
            hold = Self.fixtureHold
            return
        }
        do {
            hold = try await LiveBackendService(apiClient: container.environment.apiClient).createSeatHold(
                userID: userID,
                queueID: snapshot.queue.id,
                ticketID: seat.ticketId,
                revision: snapshot.revision,
                idempotencyKey: UUID().uuidString
            )
            selectedSeat = seat
        } catch {
            actionError = "좌석 상태가 변경되었습니다. 다시 조회해 주세요."
        }
    }

    private func createDraft(userID: String, hold: LiveSeatHold) async {
        isSubmitting = true
        defer { isSubmitting = false }
        if RuntimeConfiguration.liveBookingTestScenario != nil {
            draft = Self.fixtureDraft
            return
        }
        do {
            draft = try await LiveBackendService(apiClient: container.environment.apiClient).createReservationDraft(
                userID: userID,
                holdID: hold.id,
                idempotencyKey: UUID().uuidString
            )
        } catch {
            actionError = "예약 초안을 만들지 못했습니다. 좌석 홀드 상태를 확인해 주세요."
        }
    }

    private func release(userID: String, hold: LiveSeatHold, snapshot: LiveBookingSeatSnapshot) async {
        isSubmitting = true
        defer { isSubmitting = false }
        if RuntimeConfiguration.liveBookingTestScenario == nil {
            _ = try? await LiveBackendService(apiClient: container.environment.apiClient).releaseSeatHold(
                userID: userID,
                holdID: hold.id,
                idempotencyKey: UUID().uuidString
            )
        }
        selectedSeat = nil
        self.hold = nil
        draft = nil
        state = .loaded(userID, snapshot)
    }

    private func seatState(_ seat: LiveBookingSeat) -> String {
        switch seat.state {
        case "SELECTABLE": return "선택 가능"
        case "HELD_BY_YOU": return "내가 선택"
        case "HELD": return "선택 중"
        default: return "선택 불가"
        }
    }

    private func seatTint(_ seat: LiveBookingSeat) -> Color {
        seat.state == "SELECTABLE" ? TicketgroundColor.accent : TicketgroundColor.inkMuted
    }

    private static let fixtureQueue = LiveBookingQueue(id: "queue-1", eventId: "event-1", performanceId: "date-1", status: "READY", position: 0, expiresAt: "2026-09-19T17:10:00+09:00", updatedAt: "2026-09-19T17:00:00+09:00")
    private static let fixtureSeats = [
        LiveBookingSeat(ticketId: "ticket-1", zoneId: "vip", label: "VIP A-01", price: 99_000, state: "SELECTABLE", holdExpiresAt: nil),
        LiveBookingSeat(ticketId: "ticket-2", zoneId: "vip", label: "VIP A-02", price: 99_000, state: "HELD", holdExpiresAt: nil),
        LiveBookingSeat(ticketId: "ticket-3", zoneId: "r", label: "R B-01", price: 77_000, state: "UNAVAILABLE", holdExpiresAt: nil)
    ]
    private static let fixtureSnapshot = LiveBookingSeatSnapshot(event: LiveReservationEvent(id: "event-1", title: "Neon Stage 2026", venue: "잠실 실내체육관"), performanceId: "date-1", queue: fixtureQueue, revision: 3, seats: fixtureSeats)
    private static let fixtureHold = LiveSeatHold(id: "hold-1", queueId: "queue-1", ticketId: "ticket-1", status: "ACTIVE", expiresAt: "2026-09-19T17:05:00+09:00", revision: 4, updatedAt: "2026-09-19T17:00:00+09:00")
    private static let fixtureDraft = LiveReservationDraft(id: "draft-1", holdId: "hold-1", ticketId: "ticket-1", eventId: "event-1", performanceId: "date-1", seat: LiveReservationSeat(zoneId: "vip", label: "VIP A-01"), amount: 99_000, status: "AWAITING_PAYMENT", expiresAt: "2026-09-19T17:05:00+09:00", createdAt: "2026-09-19T17:00:00+09:00", updatedAt: "2026-09-19T17:00:00+09:00")
}

private enum BookingState {
    case loading
    case capability(LiveAccountCapabilityState)
    case expired
    case loaded(String, LiveBookingSeatSnapshot)
}

private extension APIClientError {
    var serverCode: String? {
        guard case .server(_, let code, _) = self else { return nil }
        return code
    }
}
