import SwiftUI

struct TicketgroundLoadingSurface: View {
    let title: String

    var body: some View {
        TicketgroundSurface(tone: .muted) {
            HStack(spacing: TicketgroundSpacing.md) {
                ProgressView()
                    .accessibilityLabel("불러오는 중")
                Text(title)
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
            }
        }
        .accessibilityIdentifier("state-loading")
    }
}

struct TicketgroundEmptySurface: View {
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?

    var body: some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Image(systemName: "tray")
                    .font(.title)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                    .accessibilityHidden(true)
                Text(title)
                    .font(.headline)
                Text(message)
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                if let actionTitle, let action {
                    TicketgroundPrimaryButton(title: actionTitle, accessibilityIdentifier: "state-empty-action", action: action)
                }
            }
        }
        .accessibilityIdentifier("state-empty")
    }
}

struct TicketgroundErrorSurface: View {
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?

    var body: some View {
        TicketgroundSurface(tone: .error) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Label(title, systemImage: "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundStyle(TicketgroundColor.accent)
                Text(message)
                    .font(.body)
                    .foregroundStyle(TicketgroundColor.inkSecondary)
                if let actionTitle, let action {
                    TicketgroundPrimaryButton(title: actionTitle, accessibilityIdentifier: "state-error-action", action: action)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("state-error")
        .accessibilityAddTraits(.isModal)
    }
}
