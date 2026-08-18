package kr.ticketground.app.push

import android.Manifest
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.util.UUID
import kotlin.random.Random
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kr.ticketground.app.BuildConfig
import kr.ticketground.app.MainActivity
import kr.ticketground.app.R
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.foundation.KeystoreSessionVault

/**
 * Receive-side counterpart to [kr.ticketground.app.data.GoogleFirebaseTokenSource], which only
 * ever *sent* a token to the server. Without this service the app can never display a push even
 * if the server sends one, since there was no `FirebaseMessagingService` registered at all.
 */
class TicketGroundFirebaseMessagingService : FirebaseMessagingService() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  @Suppress("OVERRIDE_DEPRECATION")
  override fun onNewToken(token: String) {
    super.onNewToken(token)
    if (BuildConfig.GATE_APP) return
    // Mirrors the same server registration call CustomerAppViewModel.registerPush() makes
    // (POST /api/me/push-tokens). This fires outside any Activity/ViewModel lifecycle, so it goes
    // straight through the API client instead of the UI layer. A missing/expired session simply
    // fails this call (fail closed, no crash, no retry loop) -- registration re-runs the next
    // time the signed-in user reaches mypage and the ViewModel's own registerPush() runs.
    scope.launch {
      runCatching {
        TicketGroundApiClient.create(KeystoreSessionVault(applicationContext))
          .lifecycle()
          .registerPushToken(token, "android-push-token-refresh-${UUID.randomUUID()}")
      }
    }
  }

  override fun onMessageReceived(message: RemoteMessage) {
    super.onMessageReceived(message)
    if (BuildConfig.GATE_APP) return
    val title = message.notification?.title ?: message.data["title"] ?: "티켓그라운드"
    val body = message.notification?.body ?: message.data["body"] ?: return
    showNotification(title, body)
  }

  private fun showNotification(title: String, body: String) {
    ensureDefaultNotificationChannel(applicationContext)
    if (ActivityCompat.checkSelfPermission(applicationContext, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      // No runtime permission yet (or denied) -- nothing we can legally post. The soft-ask card
      // on the home feed is what drives the user toward granting this.
      return
    }
    val contentIntent = PendingIntent.getActivity(
      applicationContext,
      0,
      Intent(applicationContext, MainActivity::class.java)
        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val notification = NotificationCompat.Builder(applicationContext, DEFAULT_NOTIFICATION_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_launcher_background)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setContentIntent(contentIntent)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    NotificationManagerCompat.from(applicationContext).notify(Random.nextInt(), notification)
  }
}
