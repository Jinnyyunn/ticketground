import SwiftUI
import UserNotifications

struct LiveNotificationSettingsView: View {
    @Environment(AppContainer.self) private var container
    @State private var state: NotificationState = .loading
    @State private var watchlistOpen = true
    @State private var reservationUpdates = true
    @State private var isWorking = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("알림 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-notifications")
                content
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("알림 및 기기")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    @ViewBuilder
    private var content: some View {
        switch state {
        case .loading:
            TicketgroundLoadingSurface(title: "알림 설정을 확인하는 중")
        case .capability(let capability):
            LiveAccountCapabilitySurface(
                state: capability,
                title: "알림 설정을 표시할 수 없습니다",
                loginMessage: "알림을 관리하려면 로그인이 필요합니다.",
                identifier: "live-notifications",
                retry: { Task { await load() } }
            )
        case .denied:
            LiveRouteMessageView(
                title: "알림 권한이 꺼져 있습니다",
                message: "설정 앱에서 Ticketground 알림 권한을 허용한 뒤 다시 시도해 주세요.",
                identifier: "live-notifications-denied"
            )
        case .failed:
            LiveRouteMessageView(
                title: "기기를 등록하지 못했습니다",
                message: "기기 신뢰 확인 또는 토큰 등록에 실패했습니다. 잠시 후 다시 시도해 주세요.",
                identifier: "live-notifications-registration-error"
            )
            retryButton
        case .ready(let device):
            settings(device: device)
        }
    }

    private func settings(device: LiveRegisteredDevice?) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
            TicketgroundSurface(tone: .muted) {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                    Text("알림 수신 설정").font(.headline.weight(.bold))
                    Toggle("관심공연 오픈 알림", isOn: $watchlistOpen)
                        .accessibilityIdentifier("live-notifications-watchlist")
                    Toggle("예매 상태 변경 알림", isOn: $reservationUpdates)
                        .accessibilityIdentifier("live-notifications-reservations")
                    Text("수신 설정과 기기 전달 상태는 별도로 관리됩니다.")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
            }
            .onChange(of: watchlistOpen) { _, _ in Task { await savePreferences() } }
            .onChange(of: reservationUpdates) { _, _ in Task { await savePreferences() } }

            if let device, device.status == "TRUSTED" {
                Label("이 기기 전달 준비됨", systemImage: "checkmark.shield.fill")
                    .foregroundStyle(.green)
                    .accessibilityIdentifier("live-notifications-ready")
                Button("이 기기 등록 해제", role: .destructive) {
                    Task { await revoke(deviceID: device.deviceId) }
                }
                .disabled(isWorking)
                .accessibilityIdentifier("live-notifications-revoke")
            } else {
                Text("알림 수신 설정은 저장되어 있지만 전달할 기기가 없습니다.")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                    .accessibilityIdentifier("live-notifications-no-device")
                TicketgroundPrimaryButton(
                    title: isWorking ? "등록 중" : "이 시뮬레이터 등록",
                    accessibilityIdentifier: "live-notifications-register"
                ) {
                    Task { await register() }
                }
                .disabled(
                    isWorking
                        || (!SimulatorDeviceTrustClient.isAvailable
                            && RuntimeConfiguration.liveNotificationTestScenario == nil)
                )
            }
        }
    }

    private var retryButton: some View {
        Button("다시 시도") { Task { await load() } }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("live-notifications-retry")
    }

    private func load() async {
        if let scenario = RuntimeConfiguration.liveNotificationTestScenario {
            apply(scenario)
            return
        }
        let apiClient = container.environment.apiClient
        let unknownMap = LiveAPIContract.deployed.capabilityMap(
            for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: nil
        )
        let initial = LiveAccountCapabilityState.resolve(
            for: .notifications,
            capabilityMap: unknownMap,
            session: container.environment.sessionStore.current,
            baseURL: apiClient.baseURL
        )
        guard initial == .retry else {
            state = .capability(initial)
            return
        }
        do {
            let service = LiveBackendService(apiClient: apiClient)
            let probe = try await service.diagnosePublicContract()
            let resolved = LiveAccountCapabilityState.resolve(
                for: .notifications,
                capabilityMap: probe.capabilities,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL
            )
            guard case .available(let userID) = resolved else {
                state = .capability(resolved)
                return
            }
            let settings = try await service.getNotificationSettings(userID: userID)
            watchlistOpen = settings.preferences.watchlistOpen
            reservationUpdates = settings.preferences.reservationUpdates
            state = .ready(settings.delivery.devices.first)
        } catch let error as APIClientError {
            state = .capability(LiveAccountCapabilityState.resolve(
                for: .notifications,
                capabilityMap: unknownMap,
                session: container.environment.sessionStore.current,
                baseURL: apiClient.baseURL,
                requestError: error
            ))
        } catch {
            state = .failed
        }
    }

    private func register() async {
        isWorking = true
        defer { isWorking = false }
        if let scenario = RuntimeConfiguration.liveNotificationTestScenario {
            guard scenario != .registrationFailure else {
                state = .failed
                return
            }
            guard scenario != .denied else {
                state = .denied
                return
            }
            state = .ready(Self.fixtureDevice)
            return
        }
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        guard granted else {
            state = .denied
            return
        }
        guard let userID = container.environment.sessionStore.current?.userID else {
            state = .capability(.loginRequired)
            return
        }
        do {
            let deviceID = Self.deviceID
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            let challenge = try await service.createDeviceChallenge(userID: userID, deviceID: deviceID, idempotencyKey: UUID().uuidString)
            let proof = try SimulatorDeviceTrustClient().proof(
                nonce: challenge.nonce,
                deviceID: deviceID,
                counter: 1,
                secret: RuntimeConfiguration.simulatorAttestationSecret
            )
            _ = try await service.trustSimulatorDevice(
                userID: userID,
                challengeID: challenge.id,
                deviceID: deviceID,
                counter: 1,
                proof: proof,
                idempotencyKey: UUID().uuidString
            )
            let device = try await service.registerPushToken(
                userID: userID,
                deviceID: deviceID,
                token: "simulator-\(deviceID)",
                idempotencyKey: UUID().uuidString
            )
            state = .ready(device)
        } catch {
            state = .failed
        }
    }

    private func savePreferences() async {
        guard RuntimeConfiguration.liveNotificationTestScenario == nil,
              let userID = container.environment.sessionStore.current?.userID else { return }
        _ = try? await LiveBackendService(apiClient: container.environment.apiClient).updateNotificationSettings(
            userID: userID,
            watchlistOpen: watchlistOpen,
            reservationUpdates: reservationUpdates,
            idempotencyKey: UUID().uuidString
        )
    }

    private func revoke(deviceID: String) async {
        isWorking = true
        defer { isWorking = false }
        if RuntimeConfiguration.liveNotificationTestScenario != nil {
            state = .ready(nil)
            return
        }
        guard let userID = container.environment.sessionStore.current?.userID else { return }
        do {
            _ = try await LiveBackendService(apiClient: container.environment.apiClient).revokeDevice(
                userID: userID,
                deviceID: deviceID,
                idempotencyKey: UUID().uuidString
            )
            state = .ready(nil)
        } catch {
            state = .failed
        }
    }

    private func apply(_ scenario: LiveNotificationTestScenario) {
        switch scenario {
        case .allowed, .registrationFailure:
            state = .ready(nil)
        case .denied:
            state = .denied
        case .revoked:
            state = .ready(Self.fixtureDevice)
        }
    }

    private static let deviceID = "ticketground-ios-simulator"
    private static let fixtureDevice = LiveRegisteredDevice(
        id: "device-ui-1",
        deviceId: deviceID,
        platform: "IOS_SIMULATOR",
        status: "TRUSTED",
        counter: 1,
        deliveryStatus: "READY",
        updatedAt: "2026-08-02T00:00:00.000Z"
    )

    private enum NotificationState {
        case loading
        case capability(LiveAccountCapabilityState)
        case denied
        case failed
        case ready(LiveRegisteredDevice?)
    }
}
