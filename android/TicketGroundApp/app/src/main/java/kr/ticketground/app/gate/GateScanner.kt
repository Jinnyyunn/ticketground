package kr.ticketground.app.gate

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kr.ticketground.app.data.GateApi

class GateScannerViewModel(private val api: GateApi) : ViewModel() {
  var gateToken: String = ""
    private set
  private val mutableState = MutableStateFlow(GateScanState.ready())
  val state = mutableState.asStateFlow()

  fun verify(gateToken: String, rawQr: String) {
    this.gateToken = gateToken.trim()
    if (gateToken.isBlank()) {
      mutableState.value = GateScanState(GateScanState.Status.ERROR, "게이트 토큰을 먼저 입력하세요.")
      return
    }
    val payload = runCatching { GateQrPayload.parse(rawQr) }.getOrElse {
      mutableState.value = GateScanState(GateScanState.Status.ERROR, "입장 QR 형식이 올바르지 않습니다.")
      return
    }
    mutableState.value = GateScanState(GateScanState.Status.VERIFYING, "입장 확인 중…")
    viewModelScope.launch {
      runCatching { api.verify(gateToken, payload) }
        .onSuccess { mutableState.value = GateScanState.result(it) }
        .onFailure { mutableState.value = GateScanState(GateScanState.Status.ERROR, it.message ?: "게이트 서버에 연결할 수 없습니다.") }
    }
  }

  fun reset() { mutableState.value = GateScanState.ready() }

  fun setGateToken(value: String) { gateToken = value }
}
