import SwiftUI

struct TicketgroundLoadingSurface: View {
    let title: String

    var body: some View {
        ZStack {
            ProgressView()
                .controlSize(.large)
                .tint(TicketgroundColor.accent)
                .accessibilityLabel(title)
                .accessibilityIdentifier("state-loading-progress")
        }
        .frame(maxWidth: .infinity, minHeight: 240, alignment: .center)
        .accessibilityElement(children: .contain)
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
        .accessibilityElement(children: .contain)
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
                HStack(spacing: TicketgroundSpacing.xs) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(TicketgroundColor.accent)
                    Text(title)
                        .foregroundStyle(TicketgroundColor.ink)
                }
                .font(.headline)
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
    }
}
