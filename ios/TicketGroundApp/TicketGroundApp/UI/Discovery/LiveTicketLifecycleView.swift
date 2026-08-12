import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

enum LiveLifecycleDisplay {
    static func acceptsResalePrice(_ price: Int, minimum: Int, maximum: Int) -> Bool {
        minimum <= maximum && (minimum...maximum).contains(price)
    }

    static func isAdmissionQRValid(expiresAt: String, now: Date = Date()) -> Bool {
        guard let expiry = ISO8601DateFormatter().date(from: expiresAt) else { return false }
        return expiry > now
    }
}

enum LiveLifecycleDestination: Equatable {
    case reservation(id: String)
    case cancellation
    case resale

    var title: String {
        switch self {
        case .reservation: return "예매 상세"
        case .cancellation: return "예매 취소"
        case .resale: return "공식 재판매"
        }
    }
}

struct LiveTicketLifecycleRouteView: View {
    let destination: LiveLifecycleDestination

    @Environment(AppContainer.self) private var container
    @State private var phase: Phase = .loading
    @State private var tickets: [LiveTicket] = []
    @State private var pools: [LiveLifecycleResalePool] = []
    @State private var cancellations: [LiveCancellationRequest] = []
    @State private var devices: [LiveTrustedDevice] = []
    @State private var pushTokens: [LivePushToken] = []
    @State private var reloadID = 0
    @State private var actionMessage: String?
    @State private var actionError: String?
    @State private var selectedTicketID = ""
    @State private var cancellationReason = ""
    @State private var refundAcknowledged = false
    @State private var resalePrice = ""
    @State private var isMutating = false
    @State private var admissionQR: LiveAdmissionQR?
    @State private var qrExpired = false
    @State private var localDeviceToken: String?

    var body: some View {
        Group {
            switch phase {
            case .loading:
                TicketgroundLoadingSurface(title: "\(destination.title) 불러오는 중", identifier: "live-lifecycle-loading")
            case .loginRequired:
                loginRequired
            case .unavailable:
                TicketgroundErrorSurface(
                    title: "기능을 사용할 수 없습니다",
                    message: "서버의 native lifecycle 계약이 확인되지 않아 안전을 위해 작업을 중단했습니다.",
                    actionTitle: "다시 확인",
                    action: { reloadID += 1 }
                )
                .accessibilityIdentifier("live-lifecycle-unavailable")
            case .failed:
                TicketgroundErrorSurface(
                    title: "요청을 완료할 수 없습니다",
                    message: "서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                    actionTitle: "다시 시도",
                    action: { reloadID += 1 }
                )
                .accessibilityIdentifier("live-lifecycle-server-error")
                .accessibilityAction(named: "다시 시도") { reloadID += 1 }
            case .ready:
                loadedBody
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TicketgroundColor.surface)
        .navigationTitle(destination.title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: "\(container.environment.sessionStore.revision)-\(reloadID)") {
            await load()
        }
    }

    private var loginRequired: some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Label("로그인이 필요합니다", systemImage: "lock.fill")
                    .font(.headline)
                Text("본인 소유 티켓과 결제·기기 정보를 확인하려면 다시 로그인해 주세요.")
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                Button("로그인") {
                    container.navigationPath = [.login]
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.ink)
                .frame(minHeight: TicketgroundLayout.minimumTouchTarget)
                .accessibilityIdentifier("live-lifecycle-login")
            }
        }
        .padding(TicketgroundSpacing.xl)
        .accessibilityIdentifier("live-lifecycle-login-required")
    }

    private var loadedBody: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                Text("티켓 라이프사이클 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                feedback
                switch destination {
                case .reservation(let id):
                    reservationBody(id: id)
                case .cancellation:
                    cancellationBody
                case .resale:
                    resaleBody
                }
            }
            .padding(TicketgroundSpacing.xl)
            .frame(maxWidth: 880, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .accessibilityIdentifier(destinationIdentifier)
    }

    @ViewBuilder
    private var feedback: some View {
        if let actionMessage {
            Text(actionMessage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(TicketgroundColor.success)
                .accessibilityIdentifier("lifecycle-action-success")
        }
        if let actionError {
            TicketgroundAlert(title: "처리하지 못했습니다", message: actionError)
                .accessibilityIdentifier("lifecycle-action-error")
        }
    }

    @ViewBuilder
    private func reservationBody(id: String) -> some View {
        if let ticket = tickets.first(where: { $0.id == id }) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: TicketgroundSpacing.md)], spacing: TicketgroundSpacing.md) {
                detailCard(title: "공연", rows: [
                    ("공연명", ticket.event?.title ?? ticket.eventId),
                    ("공연장", ticket.event?.venue ?? "확인 중"),
                    ("일정", ticket.event?.performance?.label ?? ticket.event?.performance?.startsAt ?? "확인 중"),
                    ("좌석", ticket.seatLabel)
                ])
                detailCard(title: "결제 및 티켓", rows: [
                    ("티켓 상태", ticket.status),
                    ("결제 상태", ticket.payment?.status ?? "확인 중"),
                    ("결제 수단", ticket.payment?.method ?? "확인 중"),
                    ("결제 금액", ticket.payment?.amount.formatted(.currency(code: "KRW")) ?? "확인 중")
                ])
            }

            HStack(spacing: TicketgroundSpacing.sm) {
                NavigationLink(value: AppRoute.cancel) {
                    Label("취소 요청", systemImage: "xmark.circle")
                        .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.minimumTouchTarget)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("lifecycle-open-cancel")
                NavigationLink(value: AppRoute.resale) {
                    Label("공식 재판매", systemImage: "arrow.triangle.2.circlepath")
                        .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.minimumTouchTarget)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("lifecycle-open-resale")
            }

            deviceAndPushBody(ticket: ticket)
        } else {
            TicketgroundErrorSurface(
                title: "예매 정보를 찾을 수 없습니다",
                message: "현재 로그인 계정이 소유한 티켓인지 확인해 주세요.",
                actionTitle: "마이페이지",
                action: { container.navigationPath = [.mypage] }
            )
            .accessibilityIdentifier("live-lifecycle-invalid-ticket")
        }
    }

    private var cancellationBody: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
            if tickets.isEmpty {
                TicketgroundEmptySurface(title: "취소할 티켓이 없습니다", message: "취소 가능한 보유 티켓이 없습니다.", actionTitle: "마이페이지", action: { container.navigationPath = [.mypage] })
            } else {
                formSurface(title: "취소 요청") {
                    Picker("취소할 티켓", selection: $selectedTicketID) {
                        ForEach(tickets, id: \.id) { ticket in
                            Text("\(ticket.event?.title ?? ticket.id) · \(ticket.seatLabel)").tag(ticket.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(minHeight: TicketgroundLayout.minimumTouchTarget)
                    TextField("취소 사유", text: $cancellationReason, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...5)
                        .accessibilityIdentifier("lifecycle-cancel-reason")
                    Toggle("환불 금액과 처리 기간을 확인했습니다.", isOn: $refundAcknowledged)
                        .frame(minHeight: TicketgroundLayout.minimumTouchTarget)
                        .accessibilityIdentifier("lifecycle-refund-acknowledgement")
                    Button(isMutating ? "요청 중" : "취소 요청 제출") {
                        Task { await submitCancellation() }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TicketgroundColor.ink)
                    .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.minimumTouchTarget)
                    .disabled(isMutating || selectedTicketID.isEmpty || cancellationReason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !refundAcknowledged)
                    .accessibilityIdentifier("lifecycle-submit-cancel")
                }
            }
            ForEach(cancellations, id: \.id) { request in
                detailCard(title: "취소 심사 대기", rows: [("티켓", request.ticketId), ("사유", request.reason), ("상태", "검토 중")])
                    .accessibilityIdentifier("lifecycle-cancellation-pending")
            }
        }
    }

    private var resaleBody: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
            if let ticket = selectedTicket {
                formSurface(title: "내 티켓 판매 등록") {
                    Picker("판매할 티켓", selection: $selectedTicketID) {
                        ForEach(tickets, id: \.id) { item in
                            Text("\(item.event?.title ?? item.id) · \(item.seatLabel)").tag(item.id)
                        }
                    }
                    .pickerStyle(.menu)
                    Text("허용 가격 \(ticket.minPrice.formatted())원 ~ \(ticket.maxPrice.formatted())원")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                    TextField("판매 가격", text: $resalePrice)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("lifecycle-resale-price")
                    Button(isMutating ? "등록 중" : "공식 재판매 등록") {
                        Task { await listResale(ticket: ticket) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TicketgroundColor.ink)
                    .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.minimumTouchTarget)
                    .disabled(isMutating || !validResalePrice(for: ticket))
                    .accessibilityIdentifier("lifecycle-list-ticket")
                }
            } else {
                TicketgroundEmptySurface(title: "판매 가능한 티켓이 없습니다", message: "보유 티켓의 판매 가능 상태와 가격 범위를 확인해 주세요.", actionTitle: "새로고침", action: { reloadID += 1 })
            }

            Text("재판매 풀")
                .font(.title3.bold())
            if pools.isEmpty {
                Text("현재 참여 가능한 공식 재판매 풀이 없습니다.")
                    .foregroundStyle(TicketgroundColor.inkMuted)
            }
            ForEach(pools, id: \.id) { pool in
                resalePoolCard(pool)
            }
        }
    }

    private func deviceAndPushBody(ticket: LiveTicket) -> some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
            formSurface(title: "신뢰 기기") {
                if devices.isEmpty {
                    Text("등록된 신뢰 기기가 없습니다. App Attest와 생체 확인이 가능한 실제 기기에서 등록해 주세요.")
                        .foregroundStyle(TicketgroundColor.inkSecondary)
                    Button("이 기기 등록") { Task { await registerDevice() } }
                        .buttonStyle(.bordered)
                        .frame(minHeight: TicketgroundLayout.minimumTouchTarget)
                        .accessibilityIdentifier("lifecycle-register-device")
                } else {
                    ForEach(devices, id: \.id) { device in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(device.deviceName).font(.headline)
                                Text(device.status == .trusted ? "신뢰됨" : "해지됨")
                                    .font(.caption)
                                    .foregroundStyle(device.status == .trusted ? TicketgroundColor.success : TicketgroundColor.inkMuted)
                            }
                            Spacer()
                            if device.status == .trusted {
                                Button("해지") { Task { await revoke(device) } }
                                    .frame(minHeight: TicketgroundLayout.minimumTouchTarget)
                                    .accessibilityIdentifier("lifecycle-revoke-device")
                            }
                        }
                    }
                }
            }

            formSurface(title: "푸시 등록") {
                if let token = pushTokens.first {
                    Label("APNs 등록됨 · 끝자리 \(token.suffix)", systemImage: "bell.badge.fill")
                        .foregroundStyle(TicketgroundColor.success)
                } else {
                    Text("APNs 기기 토큰이 발급되면 서버 등록을 이어갑니다. 실제 알림 전송은 외부 환경 확인이 필요합니다.")
                        .foregroundStyle(TicketgroundColor.inkSecondary)
                    Button("알림 등록 요청") { Task { await requestPushRegistration() } }
                        .buttonStyle(.bordered)
                        .frame(minHeight: TicketgroundLayout.minimumTouchTarget)
                        .accessibilityIdentifier("lifecycle-request-push")
                }
            }

            formSurface(title: "입장 QR") {
                if qrExpired {
                    TicketgroundAlert(title: "QR이 만료되었습니다", message: "만료된 입장 정보는 표시하지 않습니다. 새 QR을 발급해 주세요.")
                        .accessibilityIdentifier("lifecycle-qr-expired")
                }
                if let admissionQR, LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: admissionQR.expiresAt) {
                    AdmissionQRCode(payload: "\(admissionQR.nonce).\(admissionQR.signature)")
                        .frame(width: 220, height: 220)
                        .frame(maxWidth: .infinity)
                        .accessibilityIdentifier("lifecycle-admission-qr")
                    Text("유효 기한 \(admissionQR.expiresAt)")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
                Button("입장 QR 발급") { Task { await issueQR(ticket: ticket) } }
                    .buttonStyle(.borderedProminent)
                    .tint(TicketgroundColor.ink)
                    .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.minimumTouchTarget)
                    .disabled(isMutating || devices.first(where: { $0.status == .trusted }) == nil)
                    .accessibilityIdentifier("lifecycle-issue-qr")
            }
        }
    }

    private func detailCard(title: String, rows: [(String, String)]) -> some View {
        TicketgroundSurface {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Text(title).font(.headline)
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    LabeledContent(row.0, value: row.1)
                        .font(.subheadline)
                }
            }
        }
    }

    private func formSurface<Content: View>(title: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        TicketgroundSurface {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Text(title).font(.headline)
                content()
            }
        }
    }

    private func resalePoolCard(_ pool: LiveLifecycleResalePool) -> some View {
        let owned = tickets.contains { $0.id == pool.ticketId }
        return TicketgroundSurface(tone: .muted) {
            HStack(alignment: .top, spacing: TicketgroundSpacing.md) {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Text("\(pool.price.formatted())원").font(.headline)
                    Text("구매 대기 \(pool.buyerCount)명 · \(pool.status == .open ? "접수 중" : "마감")")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
                Spacer()
                if pool.status == .open {
                    Button(owned ? "판매 취소" : "참여") {
                        Task { await mutatePool(pool, owned: owned) }
                    }
                    .frame(minHeight: TicketgroundLayout.minimumTouchTarget)
                    .disabled(isMutating)
                    .accessibilityIdentifier(owned ? "lifecycle-cancel-listing" : "lifecycle-join-pool")
                }
            }
        }
    }

    @MainActor
    private func load() async {
        phase = .loading
        actionError = nil
        guard let session = container.environment.sessionStore.current,
              !session.userID.isEmpty,
              session.credential?.isEmpty == false else {
            phase = .loginRequired
            return
        }
        guard container.environment.apiClient.baseURL?.scheme?.lowercased() == "https" else {
            phase = .unavailable
            return
        }
        do {
            let bootstrap = LiveBackendService(apiClient: container.environment.apiClient)
            let probe = try await bootstrap.diagnosePublicContract()
            let required: [LiveAPIEndpoint] = [.tickets, .resalePools, .cancellationRequests, .trustedDevices, .pushTokens]
            guard required.allSatisfy({ probe.capabilities.state(for: $0) == .available }) else {
                phase = .unavailable
                return
            }
            let service = LiveBackendService(apiClient: container.environment.apiClient, initialCapabilityMap: probe.capabilities)
            tickets = try await service.getTickets(userID: session.userID)
            switch destination {
            case .reservation:
                devices = try await service.getTrustedDevices(userID: session.userID)
                pushTokens = try await service.getPushTokens(userID: session.userID)
            case .cancellation:
                cancellations = try await service.getCancellationRequests(userID: session.userID)
            case .resale:
                pools = try await service.getResalePools(userID: session.userID)
            }
            selectedTicketID = selectedTicketID.isEmpty ? tickets.first?.id ?? "" : selectedTicketID
            localDeviceToken = RuntimeConfiguration.lifecycleDeviceCredential?.token
            phase = .ready
        } catch let error as APIClientError {
            if case .server(status: 401, _, _) = error {
                container.environment.sessionStore.logout()
                phase = .loginRequired
            } else {
                phase = .failed
            }
        } catch {
            phase = .failed
        }
    }

    @MainActor
    private func submitCancellation() async {
        await performMutation {
            let request = try await service().createCancellationRequest(
                userID: userID(), ticketID: selectedTicketID,
                reason: cancellationReason.trimmingCharacters(in: .whitespacesAndNewlines),
                refundAcknowledged: refundAcknowledged,
                idempotencyKey: UUID().uuidString
            )
            cancellations.insert(request, at: 0)
            actionMessage = "취소 요청이 접수되어 검토 중입니다."
        }
    }

    @MainActor
    private func listResale(ticket: LiveTicket) async {
        guard let price = Int(resalePrice), LiveLifecycleDisplay.acceptsResalePrice(price, minimum: ticket.minPrice, maximum: ticket.maxPrice) else {
            actionError = "허용된 판매 가격 범위를 확인해 주세요."
            return
        }
        await performMutation {
            let pool = try await service().createResalePool(userID: userID(), ticketID: ticket.id, price: price, showSlug: nil, idempotencyKey: UUID().uuidString)
            pools.insert(pool, at: 0)
            actionMessage = "공식 재판매 등록이 완료되었습니다."
        }
    }

    @MainActor
    private func mutatePool(_ pool: LiveLifecycleResalePool, owned: Bool) async {
        await performMutation {
            let updated = owned
                ? try await service().cancelResalePool(userID: userID(), poolID: pool.id)
                : try await service().joinResalePool(userID: userID(), poolID: pool.id, idempotencyKey: UUID().uuidString)
            replacePool(updated)
            actionMessage = owned ? "재판매 등록을 취소했습니다." : "공식 재판매 풀에 참여했습니다."
        }
    }

    @MainActor
    private func registerDevice() async {
        guard let credential = RuntimeConfiguration.lifecycleDeviceCredential else {
            actionError = "App Attest 증명이 준비되지 않아 이 기기를 등록할 수 없습니다. 실제 기기에서 다시 시도해 주세요."
            return
        }
        await performMutation {
            let result = try await service().trustDevice(userID: userID(), deviceID: credential.deviceID, deviceName: UIDevice.current.name, platform: "iOS", attestation: credential.attestation)
            localDeviceToken = result.deviceToken
            reloadID += 1
            actionMessage = "이 기기를 신뢰 기기로 등록했습니다."
        }
    }

    @MainActor
    private func revoke(_ device: LiveTrustedDevice) async {
        await performMutation {
            let updated = try await service().revokeTrustedDevice(userID: userID(), deviceID: device.id)
            if let index = devices.firstIndex(where: { $0.id == updated.id }) { devices[index] = updated }
            localDeviceToken = nil
            admissionQR = nil
            actionMessage = "신뢰 기기를 해지했습니다."
        }
    }

    @MainActor
    private func requestPushRegistration() async {
        actionError = "APNs 기기 토큰 수신 연결이 준비되지 않아 등록을 시작할 수 없습니다. 실제 기기 연동 후 다시 시도해 주세요."
    }

    @MainActor
    private func issueQR(ticket: LiveTicket) async {
        guard let device = devices.first(where: { $0.status == .trusted }),
              let credential = RuntimeConfiguration.lifecycleDeviceCredential,
              let token = localDeviceToken else {
            actionError = "이 기기의 신뢰 증명이 없어 QR을 발급할 수 없습니다. 기기를 다시 등록해 주세요."
            return
        }
        await performMutation {
            let qr = try await service().issueAdmissionQR(userID: userID(), ticketID: ticket.id, deviceID: device.deviceID, deviceToken: token, attestation: credential.attestation)
            guard LiveLifecycleDisplay.isAdmissionQRValid(expiresAt: qr.expiresAt) else {
                admissionQR = nil
                qrExpired = true
                return
            }
            qrExpired = false
            admissionQR = qr
            actionMessage = "입장 QR을 안전하게 발급했습니다."
        }
    }

    @MainActor
    private func performMutation(_ operation: () async throws -> Void) async {
        isMutating = true
        actionMessage = nil
        actionError = nil
        defer { isMutating = false }
        do {
            try await operation()
        } catch {
            actionError = (error as? LocalizedError)?.errorDescription ?? "요청을 완료하지 못했습니다."
        }
    }

    private var selectedTicket: LiveTicket? { tickets.first(where: { $0.id == selectedTicketID }) }
    private func validResalePrice(for ticket: LiveTicket) -> Bool {
        guard let price = Int(resalePrice) else { return false }
        return LiveLifecycleDisplay.acceptsResalePrice(price, minimum: ticket.minPrice, maximum: ticket.maxPrice)
    }
    private func userID() throws -> String {
        guard let id = container.environment.sessionStore.current?.userID, !id.isEmpty else { throw APIClientError.missingCredential }
        return id
    }
    private func service() -> LiveBackendService { LiveBackendService(apiClient: container.environment.apiClient, initialCapabilityMap: lifecycleCapabilityMap) }
    private var lifecycleCapabilityMap: LiveCapabilityMap {
        LiveAPIContract.deployed.capabilityMap(
            for: container.environment.apiClient.baseURL ?? LiveAPIContract.deployed.publicHost,
            observedResponseVersion: LiveAPIContract.deployed.expectedResponseVersion,
            nativeAccountRoutesConfirmed: true,
            nativeLifecycleRoutesConfirmed: true
        )
    }
    private func replacePool(_ updated: LiveLifecycleResalePool) {
        if let index = pools.firstIndex(where: { $0.id == updated.id }) { pools[index] = updated }
    }
    private var destinationIdentifier: String {
        switch destination {
        case .reservation: return "live-lifecycle-reservation"
        case .cancellation: return "live-lifecycle-cancellation"
        case .resale: return "live-lifecycle-resale"
        }
    }
    private enum Phase { case loading, loginRequired, unavailable, failed, ready }
}

private struct AdmissionQRCode: View {
    let payload: String
    private let context = CIContext()
    private let filter = CIFilter.qrCodeGenerator()

    var body: some View {
        if let image = makeImage() {
            Image(uiImage: image).interpolation(.none).resizable().scaledToFit().accessibilityLabel("입장 QR 코드")
        } else {
            TicketgroundAlert(title: "QR 표시 오류", message: "입장 정보를 안전하게 표시할 수 없습니다.")
        }
    }

    private func makeImage() -> UIImage? {
        filter.message = Data(payload.utf8)
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 10, y: 10)),
              let cgImage = context.createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}

struct LifecycleDeviceCredential {
    let deviceID: String
    let token: String
    let attestation: String
}

extension RuntimeConfiguration {
    static var lifecycleDeviceCredential: LifecycleDeviceCredential? {
        guard let scenario = liveLifecycleTestConfiguration?.scenario,
              scenario == .happy || scenario == .expiredQR else { return nil }
        return LifecycleDeviceCredential(deviceID: "ui-device", token: "ui-device-secret", attestation: "ui-attestation")
    }

    static var liveLifecycleTestConfiguration: UITestLifecycleConfiguration? {
        let arguments = ProcessInfo.processInfo.arguments
        guard arguments.contains("-ui-testing"),
              let scenarioIndex = arguments.firstIndex(of: "-live-lifecycle-scenario"), arguments.indices.contains(scenarioIndex + 1),
              let routeIndex = arguments.firstIndex(of: "-live-lifecycle-route"), arguments.indices.contains(routeIndex + 1),
              let scenario = UITestLifecycleScenario(rawValue: arguments[scenarioIndex + 1]) else { return nil }
        let route: AppRoute
        switch arguments[routeIndex + 1] {
        case "cancel": route = .cancel
        case "resale": route = .resale
        default: route = .reservation(id: UITestLifecycleAPIClient.ticketID)
        }
        return UITestLifecycleConfiguration(scenario: scenario, route: route)
    }
}

struct UITestLifecycleConfiguration {
    let scenario: UITestLifecycleScenario
    let route: AppRoute
}

enum UITestLifecycleScenario: String { case happy, signedOut = "signed-out", unavailable, expiredQR = "expired-qr", serverError = "server-error" }

final class UITestLifecycleAPIClient: APIClient {
    static let ticketID = "ui-lifecycle-ticket"
    let mode: APIDataMode = .live
    let baseURL = URL(string: "https://ui-lifecycle.ticketground.invalid/")
    private let scenario: UITestLifecycleScenario

    init(scenario: UITestLifecycleScenario) { self.scenario = scenario }

    func data(for request: APIRequest) async throws -> Data {
        if scenario == .serverError, request.path == "/api/me/tickets" { throw APIClientError.server(status: 503, code: "LIFECYCLE_UNAVAILABLE", message: "temporary failure") }
        switch (request.method, request.path) {
        case (.get, "/api/health"):
            let capabilities = scenario == .unavailable ? "[]" : "[\"native-account-v1\",\"native-lifecycle-v1\"]"
            return json("{\"status\":\"ok\",\"version\":\"78b3c7c\",\"capabilities\":\(capabilities)}")
        case (.get, "/api/state"):
            return json("{\"events\":[],\"venues\":[],\"users\":[],\"tickets\":[],\"resalePools\":[],\"backendSummary\":{\"events\":0,\"tickets\":0},\"ledger\":{\"verified\":true,\"totalEntries\":0}}")
        case (.get, "/api/catalog"):
            return json("{\"events\":[],\"venues\":[],\"total\":0}")
        case (.get, "/api/discovery/v1/contract"):
            return json("{\"version\":\"1\",\"endpoints\":[]}")
        case (.get, "/api/me/tickets"):
            return json("[{\"id\":\"\(Self.ticketID)\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"seatLabel\":\"VIP A1\",\"status\":\"ISSUED\",\"available\":true,\"faceValue\":120000,\"minPrice\":90000,\"maxPrice\":120000,\"transferCount\":0,\"maxTransferCount\":0,\"event\":{\"id\":\"event-1\",\"title\":\"UI 테스트 콘서트\",\"venue\":\"테스트홀\",\"performance\":{\"id\":\"performance-1\",\"label\":\"8월 20일 19:00\",\"startsAt\":\"2026-08-20T19:00:00+09:00\"}},\"payment\":{\"amount\":120000,\"method\":\"카드\",\"status\":\"PAID\"}}]")
        case (.get, "/api/me/resale-pools"):
            return json("[{\"id\":\"pool-other\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"ticketId\":\"other-ticket\",\"showSlug\":\"ui-show\",\"price\":100000,\"buyerFee\":5000,\"buyerTotal\":105000,\"sellerSettlement\":95000,\"buyerCount\":1,\"status\":\"OPEN\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"matchedAt\":null}]")
        case (.get, "/api/me/cancellation-requests"): return json("[]")
        case (.get, "/api/me/devices"):
            return json("[{\"id\":\"device-record\",\"deviceId\":\"ui-device\",\"deviceName\":\"UI iPhone\",\"platform\":\"iOS\",\"status\":\"TRUSTED\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"lastVerifiedAt\":\"2026-08-12T09:00:00Z\",\"revokedAt\":null}]")
        case (.get, "/api/me/push-tokens"):
            return json("[{\"platform\":\"ios\",\"status\":\"ACTIVE\",\"suffix\":\"cdef\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"updatedAt\":\"2026-08-12T09:00:00Z\"}]")
        case (.post, "/api/tickets/qr"):
            let expiry = scenario == .expiredQR ? "2000-01-01T00:00:00Z" : "2099-01-01T00:00:00Z"
            return json("{\"type\":\"admission\",\"ticketId\":\"\(Self.ticketID)\",\"ownerId\":\"ui-user\",\"expiresAt\":\"\(expiry)\",\"nonce\":\"nonce\",\"signature\":\"signature\",\"issuedAt\":\"2026-08-12T09:00:00Z\",\"performanceStartsAt\":\"2026-08-20T10:00:00Z\",\"preparedAt\":\"2026-08-12T09:00:00Z\",\"activeAt\":\"2026-08-12T09:00:00Z\",\"ttlSeconds\":60,\"traceCode\":\"trace\",\"channel\":\"APP\",\"emergencyReason\":null}")
        case (.post, "/api/me/cancellation-requests"):
            return json("{\"id\":\"cancel-1\",\"ticketId\":\"\(Self.ticketID)\",\"reason\":\"일정 변경\",\"refundAcknowledged\":true,\"status\":\"PENDING_REVIEW\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"updatedAt\":\"2026-08-12T09:00:00Z\"}")
        case (.post, "/api/me/resale-pools"):
            return json("{\"id\":\"pool-own\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"ticketId\":\"\(Self.ticketID)\",\"showSlug\":null,\"price\":100000,\"buyerFee\":5000,\"buyerTotal\":105000,\"sellerSettlement\":95000,\"buyerCount\":0,\"status\":\"OPEN\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"matchedAt\":null}")
        case (.post, let path) where path.hasSuffix("/join"):
            return json("{\"id\":\"pool-other\",\"eventId\":\"event-1\",\"performanceDateId\":\"performance-1\",\"zoneId\":\"vip\",\"ticketId\":\"other-ticket\",\"showSlug\":\"ui-show\",\"price\":100000,\"buyerFee\":5000,\"buyerTotal\":105000,\"sellerSettlement\":95000,\"buyerCount\":2,\"status\":\"OPEN\",\"createdAt\":\"2026-08-12T09:00:00Z\",\"matchedAt\":null}")
        default: throw APIClientError.invalidResponse
        }
    }
    func resolveResource(_ reference: String?) -> String? { reference }
    private func json(_ value: String) -> Data { Data(value.utf8) }
}
