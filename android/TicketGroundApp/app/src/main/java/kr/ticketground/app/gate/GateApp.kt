package kr.ticketground.app.gate

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kr.ticketground.app.ui.TicketGroundSpacing

@Composable
fun TicketGroundGateApp(viewModel: GateScannerViewModel, onScan: () -> Unit) {
  val state by viewModel.state.collectAsStateWithLifecycle()
  var gateToken by remember { mutableStateOf("") }
  var rawQr by remember { mutableStateOf("") }
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
    Card(modifier = Modifier.fillMaxWidth()) {
      Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Icon(Icons.Default.QrCodeScanner, contentDescription = "QR 스캐너")
        Text(state.message, style = MaterialTheme.typography.titleMedium)
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
