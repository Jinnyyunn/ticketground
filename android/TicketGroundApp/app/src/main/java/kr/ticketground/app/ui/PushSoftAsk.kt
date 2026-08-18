package kr.ticketground.app.ui

import android.Manifest
import android.content.Context.MODE_PRIVATE
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.content.ContextCompat

private const val PUSH_SOFT_ASK_PREFS = "ticketground_push_soft_ask"
private const val KEY_ASKED = "asked"

/**
 * One-time "soft ask" shown the first time the customer reaches the home feed on Android 13+,
 * explaining the benefit in a line or two before triggering the real POST_NOTIFICATIONS system
 * dialog -- rather than cold-prompting on first launch. A SharedPreferences flag makes sure this
 * only ever renders once per install regardless of the outcome (granted or dismissed); on
 * pre-13 devices notifications don't need runtime permission at all, so this renders nothing.
 */
@Composable
fun PushPermissionSoftAskCard(modifier: Modifier = Modifier) {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
  val context = LocalContext.current
  val prefs = remember(context) { context.getSharedPreferences(PUSH_SOFT_ASK_PREFS, MODE_PRIVATE) }
  val alreadyGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
    PackageManager.PERMISSION_GRANTED
  var dismissed by remember { mutableStateOf(prefs.getBoolean(KEY_ASKED, false) || alreadyGranted) }
  if (dismissed) return

  val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
    prefs.edit().putBoolean(KEY_ASKED, true).apply()
    dismissed = true
  }

  Card(
    modifier = modifier.fillMaxWidth().testTag("push-soft-ask-card"),
    shape = RoundedCornerShape(TicketGroundRadius.medium),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
  ) {
    Column(
      Modifier.padding(TicketGroundSpacing.lg),
      verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm),
    ) {
      Text("예매 알림을 받아보세요", style = MaterialTheme.typography.titleMedium)
      Text(
        "좌석 확보 진행 상황과 예매 오픈, 관심공연 소식을 가장 빠르게 알려드려요.",
        style = MaterialTheme.typography.bodySmall,
      )
      Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        Button(
          onClick = { permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) },
          modifier = Modifier.testTag("push-soft-ask-allow"),
        ) { Text("알림 받기") }
        TextButton(
          onClick = {
            prefs.edit().putBoolean(KEY_ASKED, true).apply()
            dismissed = true
          },
          modifier = Modifier.testTag("push-soft-ask-dismiss"),
        ) { Text("다음에") }
      }
    }
  }
}
