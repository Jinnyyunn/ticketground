import SwiftUI

/// Skeleton loading state shaped like the list-style content most destinations
/// eventually render (a poster-sized block plus a couple of text lines,
/// repeated a few times). Uses SwiftUI's built-in `.redacted(reason: .placeholder)`
/// instead of a bare spinner so the loading state previews the destination's
/// layout rather than just signalling "something is happening".
struct TicketgroundLoadingSurface: View {
    let title: String
    let identifier: String

    init(title: String, identifier: String = "state-loading") {
        self.title = title
        self.identifier = identifier
    }

    var body: some View {
        VStack(alignment: .leading, spacing: TicketgroundSpacing.lg) {
            ForEach(0..<3, id: \.self) { _ in skeletonRow }
        }
        .redacted(reason: .placeholder)
        .frame(maxWidth: .infinity, minHeight: 240, alignment: .topLeading)
        .accessibilityLabel(title)
        .accessibilityIdentifier("state-loading-progress")
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier(identifier)
    }

    private var skeletonRow: some View {
        HStack(alignment: .top, spacing: TicketgroundSpacing.md) {
            RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                .fill(TicketgroundColor.surfaceRaised)
                .frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                RoundedRectangle(cornerRadius: TicketgroundRadius.small)
                    .fill(TicketgroundColor.surfaceRaised)
                    .frame(height: 14)
                    .frame(maxWidth: .infinity)
                RoundedRectangle(cornerRadius: TicketgroundRadius.small)
                    .fill(TicketgroundColor.surfaceRaised)
                    .frame(width: 140, height: 12)
                RoundedRectangle(cornerRadius: TicketgroundRadius.small)
                    .fill(TicketgroundColor.surfaceRaised)
                    .frame(width: 90, height: 12)
            }
        }
    }
}

struct TicketgroundEmptySurface: View {
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?
    var icon: String = "tray"

    var body: some View {
        TicketgroundSurface(tone: .muted) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.sm) {
                Image(systemName: icon)
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
                        .accessibilityIdentifier("state-error-icon")
                        .accessibilityHidden(true)
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
