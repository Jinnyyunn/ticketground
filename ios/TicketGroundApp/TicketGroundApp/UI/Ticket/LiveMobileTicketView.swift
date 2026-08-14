import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

struct LiveMobileTicketView: View {
    @Environment(AppContainer.self) private var container
    let ticketID: String
    @State private var state: TicketState = .loading
    @State private var isCaptured = UIScreen.main.isCaptured
    @State private var refreshID = 0

    var body: some View {
        ScrollView {
            VStack(spacing: TicketgroundSpacing.lg) {
                Text("모바일 티켓 · LIVE")
                    .font(.caption.weight(.black))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-mobile-ticket")
                content
            }
            .padding(TicketgroundSpacing.xl)
        }
        .navigationTitle("입장 QR")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: refreshID) { await load() }
        .onReceive(NotificationCenter.default.publisher(for: UIScreen.capturedDidChangeNotification)) { _ in
            isCaptured = UIScreen.main.isCaptured
        }
    }

    @ViewBuilder
    private var content: some View {
        if isCaptured {
            status(title: "화면 녹화 중에는 QR을 숨깁니다", message: "녹화를 중지하면 새 QR을 발급합니다.", identifier: "live-mobile-ticket-captured")
        } else {
            switch state {
            case .loading:
                TicketgroundLoadingSurface(title: "입장 QR을 준비하는 중")
            case .capability(let capability):
                LiveAccountCapabilitySurface(state: capability, title: "모바일 티켓을 표시할 수 없습니다", loginMessage: "모바일 티켓을 보려면 로그인이 필요합니다.", identifier: "live-mobile-ticket", retry: { refreshID += 1 })
            case .valid(let qr):
                validTicket(qr)
            case .expired:
                status(title: "QR이 만료되었습니다", message: "새 QR을 발급해 주세요.", identifier: "live-mobile-ticket-expired")
                refreshButton
            case .used:
                status(title: "입장 처리된 티켓입니다", message: "이 QR은 다시 사용할 수 없습니다.", identifier: "live-mobile-ticket-used")
            case .canceled:
                status(title: "취소된 티켓입니다", message: "취소되거나 사용할 수 없는 티켓은 입장할 수 없습니다.", identifier: "live-mobile-ticket-canceled")
            case .offline:
                status(title: "네트워크 연결이 필요합니다", message: "입장 QR은 서버에서 짧게 발급되므로 온라인 상태에서 다시 시도해 주세요.", identifier: "live-mobile-ticket-offline")
                refreshButton
            }
        }
    }

    private func validTicket(_ qr: LiveMobileTicketQR) -> some View {
        TicketgroundSurface(tone: .muted) {
            VStack(spacing: TicketgroundSpacing.md) {
                Text(qr.ticket.event.title).font(.title3.weight(.black))
                Text("좌석 \(qr.ticket.seat.label)").foregroundStyle(TicketgroundColor.inkSecondary)
                if let image = qrImage(qr.token) {
                    Image(uiImage: image)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 220, height: 220)
                        .accessibilityLabel("20초마다 갱신되는 입장 QR")
                        .accessibilityIdentifier("live-mobile-ticket-qr")
                        .privacySensitive()
                }
                Text("유효 시간 \(qr.ttlSeconds)초 · 한 번만 사용 가능")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(TicketgroundColor.inkMuted)
                    .accessibilityIdentifier("live-mobile-ticket-valid")
            }
        }
    }

    private func status(title: String, message: String, identifier: String) -> some View {
        LiveRouteMessageView(title: title, message: message, identifier: identifier)
    }

    private var refreshButton: some View {
        Button("새로고침") { refreshID += 1 }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("live-mobile-ticket-refresh")
    }

    private func load() async {
        if let scenario = RuntimeConfiguration.liveMobileTicketTestScenario {
            state = fixtureState(scenario)
            return
        }
        let apiClient = container.environment.apiClient
        let unknownMap = LiveAPIContract.deployed.capabilityMap(for: apiClient.baseURL ?? LiveAPIContract.deployed.publicHost, observedResponseVersion: nil)
        let initial = LiveAccountCapabilityState.resolve(for: .mobileTickets, capabilityMap: unknownMap, session: container.environment.sessionStore.current, baseURL: apiClient.baseURL)
        guard initial == .retry else { state = .capability(initial); return }
        do {
            let service = LiveBackendService(apiClient: apiClient)
            let probe = try await service.diagnosePublicContract()
            let resolved = LiveAccountCapabilityState.resolve(for: .mobileTickets, capabilityMap: probe.capabilities, session: container.environment.sessionStore.current, baseURL: apiClient.baseURL)
            guard case .available(let userID) = resolved else { state = .capability(resolved); return }
            let settings = try await service.getNotificationSettings(userID: userID)
            guard let device = settings.delivery.devices.first(where: { $0.status == "TRUSTED" }) else { state = .capability(.help); return }
            let qr = try await service.issueMobileTicketQR(userID: userID, ticketID: ticketID, deviceID: device.id, idempotencyKey: UUID().uuidString)
            state = .valid(qr)
            try? await Task.sleep(for: .seconds(max(qr.ttlSeconds - 2, 1)))
            if !Task.isCancelled { refreshID += 1 }
        } catch let error as APIClientError {
            switch error {
            case .server(_, let code, _):
                state = code == "QR_ALREADY_USED" ? .used : code == "TICKET_CANCELED" ? .canceled : .offline
            case .requestFailed: state = .offline
            default: state = .capability(.help)
            }
        } catch {
            state = .offline
        }
    }

    private func fixtureState(_ scenario: LiveMobileTicketTestScenario) -> TicketState {
        switch scenario {
        case .valid:
            return .valid(LiveMobileTicketQR(token: UUID().uuidString, status: "VALID", issuedAt: "2026-08-02T00:00:00Z", expiresAt: "2026-08-02T00:00:20Z", ttlSeconds: 20, ticket: Self.fixtureTicket))
        case .expired: return .expired
        case .used: return .used
        case .canceled: return .canceled
        case .offline: return .offline
        }
    }

    private func qrImage(_ token: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(token.utf8)
        guard let output = filter.outputImage else { return nil }
        let scaled = output.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
        guard let cgImage = CIContext().createCGImage(scaled, from: scaled.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }

    private static let fixtureTicket = LiveMobileTicket(
        id: "ticket-1",
        event: LiveReservationEvent(id: "event-1", title: "IU 2026 WORLD TOUR", venue: "잠실 올림픽 주 경기장"),
        performance: LiveReservationPerformance(id: "performance-1", label: "9월 19일 오후 8시", startsAt: "2026-09-19T20:00:00+09:00"),
        seat: LiveReservationSeat(zoneId: "R", label: "R석 A구역 12열 8번"),
        status: "OWNED",
        admissionStatus: "AVAILABLE"
    )

    private enum TicketState {
        case loading
        case capability(LiveAccountCapabilityState)
        case valid(LiveMobileTicketQR)
        case expired
        case used
        case canceled
        case offline
    }
}
