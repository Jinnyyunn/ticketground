package kr.ticketground.app.gate

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kr.ticketground.app.ui.TicketGroundSpacing

// Material3 has no built-in "success" role, so ADMITTED/REPLAY get explicit
// container colors here rather than borrowing a semantically-wrong theme
// token (e.g. primaryContainer). REJECTED/ERROR reuse the theme's real
// error/onError roles since those already carry the right meaning and adapt
// correctly across light/dark.
private val AdmittedContainer = Color(0xFF1B5E20)
private val AdmittedOnContainer = Color(0xFFE8F5E9)
private val ReplayContainer = Color(0xFF8A5A00)
private val ReplayOnContainer = Color(0xFFFFF3E0)

@Composable
fun TicketGroundGateApp(viewModel: GateScannerViewModel, onScan: () -> Unit) {
  val state by viewModel.state.collectAsStateWithLifecycle()
  var gateToken by remember { mutableStateOf("") }
  var rawQr by remember { mutableStateOf("") }
  val haptics = LocalHapticFeedback.current

  // A gate operator is watching the crowd, not the screen - the confirm/deny
  // buzz has to fire the instant a terminal result lands, without requiring
  // them to be looking at the exact moment it renders.
  LaunchedEffect(state.status) {
    when (state.status.tone()) {
      GateResultTone.SUCCESS -> haptics.performHapticFeedback(HapticFeedbackType.Confirm)
      GateResultTone.WARNING, GateResultTone.DANGER -> haptics.performHapticFeedback(HapticFeedbackType.Reject)
      GateResultTone.NEUTRAL -> Unit
    }
  }

  Column(
    modifier = Modifier.fillMaxSize().padding(24.dp),
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.lg),
  ) {
    Text("게이트 입장 확인", style = MaterialTheme.typography.headlineSmall)
    Text("관리자 화면에서 발급한 게이트 토큰을 입력한 뒤 고객의 입장 QR을 스캔하세요.")
    OutlinedTextField(
      value = gateToken,
      onValueChange = { gateToken = it; viewModel.setGateToken(it) },
      modifier = Modifier.fillMaxWidth(),
      label = { Text("게이트 토큰") },
      visualTransformation = PasswordVisualTransformation(),
      singleLine = true,
    )
    val tone = state.status.tone()
    val cardColors = when (tone) {
      GateResultTone.SUCCESS -> CardDefaults.cardColors(containerColor = AdmittedContainer, contentColor = AdmittedOnContainer)
      GateResultTone.WARNING -> CardDefaults.cardColors(containerColor = ReplayContainer, contentColor = ReplayOnContainer)
      GateResultTone.DANGER -> CardDefaults.cardColors(
        containerColor = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
      )
      GateResultTone.NEUTRAL -> CardDefaults.cardColors()
    }
    val resultIcon = when (tone) {
      GateResultTone.SUCCESS -> Icons.Default.CheckCircle
      GateResultTone.WARNING -> Icons.Default.Warning
      GateResultTone.DANGER -> Icons.Default.Cancel
      GateResultTone.NEUTRAL -> Icons.Default.QrCodeScanner
    }
    Card(modifier = Modifier.fillMaxWidth(), colors = cardColors) {
      Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Terminal results (pass/duplicate/fail) render at a larger, bolder
        // size than the idle "ready to scan" state - a staff member reading
        // this from arm's length while waving people through needs the
        // verdict legible without leaning in.
        val isTerminal = tone != GateResultTone.NEUTRAL
        Icon(
          resultIcon,
          contentDescription = "QR 스캐너",
          modifier = if (isTerminal) Modifier.padding(bottom = 4.dp) else Modifier,
        )
        Text(
          state.message,
          style = if (isTerminal) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.titleMedium,
          fontSize = if (isTerminal) 28.sp else MaterialTheme.typography.titleMedium.fontSize,
        )
        Button(onClick = onScan, enabled = gateToken.isNotBlank() && state.status != GateScanState.Status.VERIFYING, modifier = Modifier.fillMaxWidth()) {
          Text("카메라로 QR 스캔")
        }
        OutlinedTextField(
          value = rawQr,
          onValueChange = { rawQr = it },
          modifier = Modifier.fillMaxWidth(),
          label = { Text("QR 값 직접 입력") },
          minLines = 3,
        )
        Button(onClick = { viewModel.verify(gateToken, rawQr) }, enabled = rawQr.isNotBlank() && gateToken.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
          Text("직접 확인")
        }
        if (state.status != GateScanState.Status.READY && state.status != GateScanState.Status.VERIFYING) {
          Button(onClick = { viewModel.reset(); rawQr = "" }, modifier = Modifier.fillMaxWidth()) { Text("다음 QR 준비") }
        }
      }
    }
  }
}
