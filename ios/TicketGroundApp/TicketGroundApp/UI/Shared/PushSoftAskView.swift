import SwiftUI
import UserNotifications

/// Persists whether the push-permission "soft ask" (below) has already been
/// shown once. Apple's guidance is to explain the benefit before the system
/// permission prompt rather than cold-prompting on first launch - see iOS
/// Android 앱 UI 개선 계획서.md §4 Phase 3. The flag makes sure this only
/// ever shows once per install, regardless of whether the user allowed or
/// dismissed it; the manual "알림 등록 요청" button on the push-notifications
/// lifecycle screen (`LiveTicketLifecycleView.swift`) stays as a fallback
/// for anyone who doesn't grant it here.
enum PushSoftAskStorage {
    private static let presentedKey = "ticketground.pushSoftAsk.presented.v1"

    static var hasBeenPresented: Bool {
        get { UserDefaults.standard.bool(forKey: presentedKey) }
        set { UserDefaults.standard.set(newValue, forKey: presentedKey) }
    }
}

/// One-time sheet shown before the real system push-permission prompt,
/// explaining the benefit in a line or two. Presented from `LiveAccountRouteView`
/// (My Page tab) the first time an authenticated user reaches their ticket
/// area with an undetermined notification authorization status.
struct PushSoftAskSheet: View {
    var onRequestPermission: () -> Void
    var onDismiss: () -> Void

    var body: some View {
        VStack(spacing: TicketgroundSpacing.lg) {
            Image(systemName: "bell.badge.fill")
                .font(.system(size: 40))
                .foregroundStyle(TicketgroundColor.accent)
                .accessibilityHidden(true)

            VStack(spacing: TicketgroundSpacing.xs) {
                Text("공연 알림을 받아보세요")
                    .font(.title3.weight(.black))
                    .foregroundStyle(TicketgroundColor.ink)
                Text("티켓오픈 임박, 예매·취소 처리, 입장 안내를 놓치지 않도록 알려드릴게요.")
                    .font(.subheadline)
                    .foregroundStyle(TicketgroundColor.inkMuted)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: TicketgroundSpacing.sm) {
                Button("알림 받기") {
                    onRequestPermission()
                }
                .buttonStyle(.borderedProminent)
                .tint(TicketgroundColor.ink)
                .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.minimumTouchTarget)
                .accessibilityIdentifier("push-soft-ask-allow")

                Button("나중에") {
                    onDismiss()
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, minHeight: TicketgroundLayout.minimumTouchTarget)
                .foregroundStyle(TicketgroundColor.inkMuted)
                .accessibilityIdentifier("push-soft-ask-dismiss")
            }
        }
        .padding(TicketgroundSpacing.xl)
        .presentationDetents([.medium])
        .accessibilityIdentifier("push-soft-ask-sheet")
    }
}
