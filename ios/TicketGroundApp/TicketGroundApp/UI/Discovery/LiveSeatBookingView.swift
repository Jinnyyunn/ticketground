import SwiftUI

struct LiveSeatBookingView: View {
    let seatMap: LiveSeatMap
    let performanceDateID: String
    @Environment(AppContainer.self) private var container
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selectedTicketID: String?
    @State private var queueEntry: LiveQueueEntry?
    @State private var activeHoldID: String?
    @State private var heldTicketID: String?
    @State private var holdIdempotencyKey: String?
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
            header
            if horizontalSizeClass == .regular {
                HStack(alignment: .top, spacing: TicketgroundSpacing.xl) {
                    graphicalSeatMap
                        .layoutPriority(1)
                    VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
                        legend
                        bookingAction
                    }
                    .frame(width: TicketgroundLayout.seatBookingSidebarWidth)
                }
            } else {
                graphicalSeatMap
                legend
                bookingAction
            }
        }
        .frame(maxWidth: TicketgroundLayout.seatBookingMaximumWidth, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .center)
        .sensoryFeedback(.impact(weight: .light), trigger: selectedTicketID)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
            Text(seatMap.event.title)
                .font(.title2.weight(.black))
                .foregroundStyle(TicketgroundColor.ink)
            Text(seatMap.event.venue)
                .font(.subheadline)
                .foregroundStyle(TicketgroundColor.inkMuted)
            Text("좌석도에서 구매할 좌석을 선택하세요")
                .font(.body)
                .foregroundStyle(TicketgroundColor.inkSecondary)
        }
    }

    private var graphicalSeatMap: some View {
        GeometryReader { geometry in
            ZStack {
                seatMapBackground
                    .frame(width: geometry.size.width, height: geometry.size.height)

                ForEach(positionedSeats, id: \.id) { seat in
                    seatButton(seat, in: geometry.size)
                }
            }
        }
        .aspectRatio(1.35, contentMode: .fit)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    @ViewBuilder
    private var seatMapBackground: some View {
        if seatMap.map.image.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            VStack(spacing: TicketgroundSpacing.md) {
                Text("STAGE")
                    .font(.caption.weight(.black))
                    .tracking(2)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                    .frame(maxWidth: TicketgroundLayout.stageMaximumWidth)
                    .padding(.vertical, TicketgroundSpacing.sm)
                    .background(TicketgroundColor.surface)
                    .clipShape(Capsule())
                Spacer()
            }
            .padding(TicketgroundSpacing.xl)
            .accessibilityHidden(true)
        } else {
            TicketgroundMediaImage(
                resource: container.environment.apiClient.resolveResource(seatMap.map.image),
                role: .seatMap,
                accessibilityLabel: "\(seatMap.map.title) 좌석 배치도",
                accessibilitySuffix: "live-seat-booking",
                contentMode: .fit
            )
        }
    }

    private var legend: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
            Text("좌석 등급")
                .font(.headline.weight(.black))
            ForEach(seatMap.zones, id: \.id) { zone in
                HStack {
                    Circle()
                        .fill(zone.available > 0 ? TicketgroundColor.accent : TicketgroundColor.inkMuted)
                        .frame(width: 10, height: 10)
                    Text(zone.name)
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text("\(zone.available)석 · \(zone.price.formatted())원")
                        .font(.caption)
                        .foregroundStyle(TicketgroundColor.inkMuted)
                }
            }
        }
        .padding(TicketgroundSpacing.md)
        .background(TicketgroundColor.surfaceMuted)
        .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    @ViewBuilder
    private var bookingAction: some View {
        if positionedSeats.isEmpty {
            TicketgroundEmptySurface(
                title: "선택 가능한 좌석이 없습니다",
                message: "다른 회차를 선택하거나 좌석 현황을 다시 확인해 주세요.",
                actionTitle: "홈으로",
                action: { container.navigationPath.removeAll() }
            )
        } else {
            if let selectedSeat {
                Text("선택 좌석 \(selectedSeat.displayCode.isEmpty ? selectedSeat.label : selectedSeat.displayCode) · \(selectedSeat.price.formatted())원")
                    .font(.subheadline.weight(.bold))
                    .accessibilityIdentifier("live-selected-seat")
            }
            if let queueEntry, queueEntry.status == .waiting {
                Text("대기 순서 \(queueEntry.position)번")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(TicketgroundColor.accent)
                    .accessibilityIdentifier("live-booking-queue-position")
                Button("대기 상태 확인") {
                    Task { await refreshQueue(entry: queueEntry) }
                }
                .buttonStyle(.bordered)
                .disabled(isSubmitting)
                .accessibilityIdentifier("live-booking-queue-refresh")
            } else {
                Button {
                    Task { await enterQueue() }
                } label: {
                    Text(isSubmitting ? "예매 진입 중" : "선택한 좌석 예매하기")
                        .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.primaryActionMinimumHeight)
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.accent)
                .disabled(selectedTicketID == nil || isSubmitting)
                .accessibilityIdentifier("live-seat-booking-submit")
            }
            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .accessibilityIdentifier("live-seat-booking-error")
            }
        }
    }

    private var positionedSeats: [LiveSeat] {
        seatMap.seats.filter { $0.available && $0.mapPosition != nil }
    }

    private var selectedSeat: LiveSeat? {
        seatMap.seats.first { $0.id == selectedTicketID }
    }

    @ViewBuilder
    private func seatButton(_ seat: LiveSeat, in size: CGSize) -> some View {
        if let position = seat.mapPosition {
            let isSelected = selectedTicketID == seat.id
            Button {
                Task { await selectSeat(isSelected ? nil : seat.id) }
            } label: {
                seatMarker(position: position, isSelected: isSelected, in: size)
            }
            .buttonStyle(.plain)
            .frame(
                width: TicketgroundLayout.minimumTouchTarget,
                height: TicketgroundLayout.minimumTouchTarget
            )
            .position(
                x: clampedCoordinate(position.x, extent: size.width),
                y: clampedCoordinate(position.y, extent: size.height)
            )
            .accessibilityIdentifier("live-seat-marker-\(seat.id)")
            .accessibilityLabel("\(seat.displayCode.isEmpty ? seat.label : seat.displayCode), \(seat.zoneName), \(seat.price.formatted())원")
            .accessibilityValue(isSelected ? "선택됨" : "선택 가능")
        }
    }

    @ViewBuilder
    private func seatMarker(
        position: LiveSeatMapPosition,
        isSelected: Bool,
        in size: CGSize
    ) -> some View {
        let markerWidth = max(
            TicketgroundLayout.minimumSeatMarker,
            min(size.width * position.width / 100, TicketgroundLayout.maximumSeatMarker)
        )
        let markerHeight = max(
            TicketgroundLayout.minimumSeatMarker,
            min(size.height * position.height / 100, TicketgroundLayout.maximumSeatMarker)
        )
        let fill = isSelected ? TicketgroundColor.accent : TicketgroundColor.success
        let stroke = TicketgroundColor.surface

        Group {
            switch position.shape.lowercased() {
            case "square", "rect", "rectangle":
                Rectangle().fill(fill).overlay(Rectangle().stroke(stroke, lineWidth: 2))
            case "rounded", "rounded-rectangle":
                RoundedRectangle(cornerRadius: TicketgroundRadius.small)
                    .fill(fill)
                    .overlay(RoundedRectangle(cornerRadius: TicketgroundRadius.small).stroke(stroke, lineWidth: 2))
            default:
                Ellipse().fill(fill).overlay(Ellipse().stroke(stroke, lineWidth: 2))
            }
        }
        .frame(width: markerWidth, height: markerHeight)
        .rotationEffect(.degrees(position.rotate))
    }

    private func clampedCoordinate(_ percentage: Double, extent: CGFloat) -> CGFloat {
        let inset = TicketgroundLayout.minimumTouchTarget / 2
        return min(max(extent * percentage / 100, inset), extent - inset)
    }

    @MainActor
    private func selectSeat(_ ticketID: String?) async {
        let previousHoldID = activeHoldID
        let previousHeldTicketID = heldTicketID
        let previousHoldKey = holdIdempotencyKey
        selectedTicketID = ticketID
        errorMessage = nil
        holdIdempotencyKey = nil
        guard previousHeldTicketID != ticketID,
              let previousHoldID,
              let userID = container.environment.sessionStore.current?.userID else { return }
        activeHoldID = nil
        heldTicketID = nil
        isSubmitting = true
        defer { isSubmitting = false }
        do {
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            _ = try await service.diagnoseBookingHoldsContract()
            _ = try await service.releaseSeatHold(userID: userID, holdID: previousHoldID)
        } catch {
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            let reconciledHold = try? await service.getSeatHold(userID: userID, holdID: previousHoldID)
            if reconciledHold?.status == .released || reconciledHold?.status == .expired {
                return
            }
            selectedTicketID = previousHeldTicketID
            activeHoldID = previousHoldID
            heldTicketID = previousHeldTicketID
            holdIdempotencyKey = previousHoldKey
            errorMessage = "기존 좌석 점유를 해제하지 못했습니다. 잠시 후 다시 시도해 주세요."
        }
    }

    @MainActor
    private func enterQueue() async {
        guard let ticketID = selectedTicketID else { return }
        guard let userID = container.environment.sessionStore.current?.userID else {
            container.navigationPath.append(.login)
            return
        }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            _ = try await service.diagnoseBookingHoldsContract()
            let entry = try await service.enterQueue(userID: userID, performanceDateID: performanceDateID)
            queueEntry = entry
            try await holdSeatAndOpenCheckout(entry, ticketID: ticketID, userID: userID, service: service)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func refreshQueue(entry: LiveQueueEntry) async {
        guard let ticketID = selectedTicketID,
              let userID = container.environment.sessionStore.current?.userID else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            let service = LiveBackendService(apiClient: container.environment.apiClient)
            _ = try await service.diagnoseBookingHoldsContract()
            let refreshed = try await service.getQueueEntry(userID: userID, entryID: entry.id)
            queueEntry = refreshed
            try await holdSeatAndOpenCheckout(refreshed, ticketID: ticketID, userID: userID, service: service)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func holdSeatAndOpenCheckout(
        _ entry: LiveQueueEntry,
        ticketID: String,
        userID: String,
        service: LiveBackendService
    ) async throws {
        guard entry.status == .admitted else { return }
        let hold = try await service.createSeatHold(
            userID: userID,
            performanceDateID: performanceDateID,
            ticketIDs: [ticketID],
            idempotencyKey: holdKey(entryID: entry.id, ticketID: ticketID)
        )
        guard hold.status == .active, hold.ticketIds == [ticketID] else {
            holdIdempotencyKey = nil
            throw LiveSeatBookingError.invalidHold
        }
        activeHoldID = hold.id
        heldTicketID = ticketID
        container.navigationPath.append(.checkout(ticketId: ticketID))
    }

    private func holdKey(entryID: String, ticketID: String) -> String {
        if let holdIdempotencyKey { return holdIdempotencyKey }
        let key = "ios-booking-\(entryID)-\(ticketID)-\(UUID().uuidString)"
        holdIdempotencyKey = key
        return key
    }
}

private enum LiveSeatBookingError: LocalizedError {
    case invalidHold

    var errorDescription: String? {
        "선택한 좌석을 결제 시간 동안 확보하지 못했습니다. 다시 선택해 주세요."
    }
}
