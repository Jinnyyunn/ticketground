package kr.ticketground.app.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.core.content.ContextCompat

/**
 * Single, general-purpose notification channel for customer-facing pushes (booking/queue
 * updates, watchlist alerts, etc.). The FCM payload shape sent by the server today doesn't
 * distinguish notification types, so this intentionally stays a single channel rather than a
 * speculative taxonomy — split it if/when the server starts sending a `type` a user would
 * plausibly want to mute independently. No SDK_INT guard is needed: minSdk is already 26
 * (NotificationChannel has existed since API 26).
 */
const val DEFAULT_NOTIFICATION_CHANNEL_ID = "ticketground_default"

fun ensureDefaultNotificationChannel(context: Context) {
  val manager = ContextCompat.getSystemService(context, NotificationManager::class.java) ?: return
  val channel = NotificationChannel(
    DEFAULT_NOTIFICATION_CHANNEL_ID,
    "티켓그라운드 알림",
    NotificationManager.IMPORTANCE_DEFAULT,
  ).apply {
    description = "예매 진행 상황과 관심공연 알림을 보내드립니다."
  }
  manager.createNotificationChannel(channel)
}
