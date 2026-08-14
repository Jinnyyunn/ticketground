import SwiftUI

struct LiveAccountRouteView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: AccountState = .loading
    @State private var draftName = ""
    @State private var isEditing = false
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var reloadID = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("마이페이지 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-account")
                content
                NavigationLink {
                    LiveWatchlistRouteView()
                } label: {
                    Label("관심공연 관리", systemImage: "heart")
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("live-mypage-watchlist")
                NavigationLink {
                    LiveNotificationSettingsView()
                } label: {
                    Label("알림 및 기기 관리", systemImage: "bell.badge")
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("live-mypage-notifications")
                NavigationLink {
                    LiveSupportRouteView(route: .help)
                } label: {
                    Label("고객센터 문의", systemImage: "questionmark.circle")
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("live-mypage-support")
                Button("로그아웃", role: .destructive) {
                    container.environment.sessionStore.logout()
                    state = .capability(.loginRequired)
                }
                .frame(maxWidth: .infinity)
                .accessibilityIdentifier("live-account-logout")
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("마이페이지")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.current?.userID ?? "")-\(reloadID)") {
            await load()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            TicketgroundLoadingSurface(title: "계정과 예매내역을 불러오는 중")
                .accessibilityIdentifier("live-account-loading")
        case .capability(let capability):
            LiveAccountCapabilitySurface(
                state: capability,
                title: "계정 정보를 표시할 수 없습니다",
                loginMessage: "마이페이지를 보려면 로그인이 필요합니다.",
                identifier: "live-account",
                retry: { reloadID += 1 }
            )
        case .loaded(let userID, let profile, let reservations):
            profileCard(userID: userID, profile: profile)
            reservationList(reservations)
        }
    }

    private func profileCard(userID: String, profile: LiveAccountProfile) -> some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                        Text(profile.name)
                            .font(.title2.weight(.black))
                            .accessibilityIdentifier("live-account-name")
                        Text("계정 상태 \(profile.status) · 신뢰 점수 \(profile.trustScore)")
                            .font(.subheadline)
                            .foregroundStyle(TicketgroundColor.inkMuted)
                    }
                    Spacer()
                    Button(isEditing ? "취소" : "이름 수정") {
                        draftName = profile.name
                        isEditing.toggle()
                        saveError = nil
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("live-account-edit")
                }
                if isEditing {
                    TicketgroundInput(title: "이름", prompt: "2자 이상 입력", text: $draftName)
                        .accessibilityIdentifier("live-account-name-input")
                    if let saveError {
                        Text(saveError)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(TicketgroundColor.accent)
                            .accessibilityAddTraits(.updatesFrequently)
                            .accessibilityIdentifier("live-account-save-error")
                    }
                    TicketgroundPrimaryButton(
                        title: isSaving ? "저장 중" : "저장",
                        accessibilityIdentifier: "live-account-save"
                    ) {
                        Task { await save(userID: userID) }
                    }
                    .disabled(isSaving || draftName.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                }
            }
        }
    }

    @ViewBuilder
    private func reservationList(_ reservations: [LiveReservation]) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text("예매내역")
                .font(.title3.weight(.black))
            if reservations.isEmpty {
                LiveRouteMessageView(
                    title: "예매내역이 없습니다",
                    message: "예매를 완료하면 공연과 좌석 정보가 여기에 표시됩니다.",
                    identifier: "live-account-reservations-empty"
                )
            } else {
                NavigationLink {
                    LiveMobileTicketView(ticketID: reservations[0].ticketId)
                } label: {
                    Label("모바일 티켓 열기", systemImage: "qrcode")
                        .frame(maxWidth: .infinity, minHeight: 46)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("live-account-mobile-ticket")
                ForEach(reservations, id: \.ticketId) { reservation in
                    DisclosureGroup {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            Text(reservation.performance.label ?? "공연 일정을 확인해 주세요")
                            Text("좌석 \(reservation.seat.label)")
                            Text(reservation.faceValue.formatted(.currency(code: "KRW")))
                        }
                        .font(.subheadline)
                        .foregroundStyle(TicketgroundColor.inkSecondary)
                    } label: {
                        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                            Text(reservation.event.title).font(.headline.weight(.bold))
                            Text(reservation.event.venue ?? "공연장 정보 확인 중")
                                .font(.caption)
                                .foregroundStyle(TicketgroundColor.inkMuted)
                        }
                    }
                    .padding(TicketgroundSpacing.md)
                    .background(TicketgroundColor.surfaceMuted)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
                    .accessibilityIdentifier("live-account-reservation-\(reservation.ticketId)")
                }
            }
        }
    }

    private func load() async {
        if let scenario = RuntimeConfiguration.liveAccountTestScenario {
            apply(scenario)
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
            for: .account,
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
                for: .account,
                capabilityMap: probe.capabilities,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard case .available(let userID) = resolved else {
                state = .capability(resolved)
                return
            }
            async let profile = service.getProfile(userID: userID)
            async let reservations = service.getReservations(userID: userID)
            state = .loaded(userID, try await profile, try await reservations)
        } catch let error as APIClientError {
            state = .capability(LiveAccountCapabilityState.resolve(
                for: .account,
                capabilityMap: unknownMap,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL,
                requestError: error
            ))
        } catch {
            state = .capability(.retry)
        }
    }

    private func save(userID: String) async {
        let name = draftName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard name.count >= 2 else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        if RuntimeConfiguration.liveAccountTestScenario == .saveFailure {
            saveError = "이름을 저장하지 못했습니다. 입력한 내용은 유지됩니다."
            return
        }
        do {
            let updated = try await LiveBackendService(apiClient: container.environment.apiClient).updateProfile(
                userID: userID,
                name: name,
                idempotencyKey: UUID().uuidString
            )
            guard case .loaded(_, _, let reservations) = state else { return }
            state = .loaded(userID, updated, reservations)
            isEditing = false
        } catch {
            saveError = "이름을 저장하지 못했습니다. 입력한 내용은 유지됩니다."
        }
    }

    private func apply(_ scenario: LiveAccountTestScenario) {
        switch scenario {
        case .loading:
            state = .loading
        case .empty:
            state = .loaded("ui-user", Self.fixtureProfile, [])
        case .loaded, .saveFailure:
            state = .loaded("ui-user", Self.fixtureProfile, [Self.fixtureReservation])
        }
    }

    private static let fixtureProfile = LiveAccountProfile(
        id: "ui-user",
        name: "김민서",
        status: "ACTIVE",
        trustScore: 92,
        profileConfirmed: true
    )

    private static let fixtureReservation = LiveReservation(
        ticketId: "ticket-1",
        ticketStatus: "OWNED",
        event: LiveReservationEvent(id: "event-1", title: "Neon Stage 2026", venue: "잠실 실내체육관"),
        performance: LiveReservationPerformance(id: "date-1", label: "2026년 9월 19일 오후 7시", startsAt: "2026-09-19T19:00:00+09:00"),
        seat: LiveReservationSeat(zoneId: "vip", label: "VIP A구역 1열 12번"),
        faceValue: 99_000,
        issuedAt: "2026-08-01T00:00:00Z"
    )
}

private enum AccountState {
    case loading
    case capability(LiveAccountCapabilityState)
    case loaded(String, LiveAccountProfile, [LiveReservation])
}
