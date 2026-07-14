import SwiftUI

struct TicketgroundSurface<Content: View>: View {
    enum Tone {
        case standard
        case muted
        case error
    }

    let tone: Tone
    @ViewBuilder let content: () -> Content

    init(tone: Tone = .standard, @ViewBuilder content: @escaping () -> Content) {
        self.tone = tone
        self.content = content
    }

    var body: some View {
        content()
            .padding(TicketgroundSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(backgroundColor)
            .overlay {
                RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                    .stroke(borderColor, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
    }

    private var backgroundColor: Color {
        switch tone {
        case .standard: return TicketgroundColor.surface
        case .muted: return TicketgroundColor.surfaceMuted
        case .error: return TicketgroundColor.accent.opacity(0.08)
        }
    }

    private var borderColor: Color {
        tone == .error ? TicketgroundColor.accent.opacity(0.35) : TicketgroundColor.line
    }
}

struct TicketgroundTag: View {
    enum Tone {
        case open
        case sale
        case success
        case warning
        case error
    }

    let title: String
    let tone: Tone

    var body: some View {
        Text(title)
            .font(.caption.weight(.bold))
            .foregroundStyle(foregroundColor)
            .padding(.horizontal, TicketgroundSpacing.sm)
            .padding(.vertical, TicketgroundSpacing.xs)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
            .accessibilityLabel(title)
    }

    private var foregroundColor: Color {
        switch tone {
        case .open, .error: return TicketgroundColor.accent
        case .sale: return TicketgroundColor.ink
        case .success: return TicketgroundColor.success
        case .warning: return TicketgroundColor.warning
        }
    }

    private var backgroundColor: Color {
        switch tone {
        case .open, .error: return TicketgroundColor.accent.opacity(0.1)
        case .sale: return Color.yellow.opacity(0.35)
        case .success: return TicketgroundColor.success.opacity(0.12)
        case .warning: return TicketgroundColor.warning.opacity(0.12)
        }
    }
}

struct TicketgroundPosterCard: View {
    let title: String
    let subtitle: String
    let tag: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: TicketgroundSpacing.md) {
                Image(systemName: "ticket.fill")
                    .font(.title)
                    .foregroundStyle(TicketgroundColor.accent)
                    .frame(maxWidth: .infinity, minHeight: 64, alignment: .center)
                    .background(TicketgroundColor.surfaceRaised)
                    .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.small))
                    .accessibilityHidden(true)
                TicketgroundTag(title: tag, tone: .open)
                Text(title)
                    .font(.headline)
                    .foregroundStyle(TicketgroundColor.ink)
                    .multilineTextAlignment(.leading)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(TicketgroundSpacing.md)
            .background(TicketgroundColor.surface)
            .overlay {
                RoundedRectangle(cornerRadius: TicketgroundRadius.medium)
                    .stroke(TicketgroundColor.line, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: TicketgroundRadius.medium))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("공연 (title), (subtitle)")
        .frame(minHeight: 44)
    }
}

struct TicketgroundPrimaryButton: View {
    let title: String
    let accessibilityIdentifier: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.borderedProminent)
        .tint(TicketgroundColor.ink)
        .accessibilityIdentifier(accessibilityIdentifier)
        .accessibilityLabel(title)
    }
}

struct TicketgroundInput: View {
    let title: String
    let prompt: String
    @Binding var text: String

    var body: some View {
        TextField(title, text: $text, prompt: Text(prompt))
            .textFieldStyle(.roundedBorder)
            .font(.body)
            .padding(.vertical, TicketgroundSpacing.xs)
            .accessibilityLabel(title)
    }
}

struct TicketgroundAlert: View {
    let title: String
    let message: String

    var body: some View {
        TicketgroundSurface(tone: .error) {
            Label {
                VStack(alignment: .leading, spacing: TicketgroundSpacing.xs) {
                    Text(title).font(.headline)
                    Text(message).font(.body)
                }
            } icon: {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(TicketgroundColor.accent)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("오류: (title). (message)")
    }
}
