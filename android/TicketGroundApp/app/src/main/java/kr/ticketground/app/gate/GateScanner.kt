package kr.ticketground.app.gate

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kr.ticketground.app.data.GateApi
import kr.ticketground.app.foundation.GateTokenVault

class GateScannerViewModel(
  private val api: GateApi,
  private val tokenVault: GateTokenVault,
) : ViewModel() {
  var gateToken: String = ""
    private set
  private val mutableState = MutableStateFlow(GateScanState.ready())
  val state = mutableState.asStateFlow()

  // A device token issued for a gate is meant to stay valid "until the
  // operator revokes it" (계획서 6장) - across app restarts, not just
  // config changes - so it's restored once at startup rather than requiring
  // the operator to retype a password-masked token every time the process
  // is killed under memory pressure during a multi-hour event.
  private val mutableRestoredToken = MutableStateFlow<String?>(null)
  val restoredToken = mutableRestoredToken.asStateFlow()

  init {
    viewModelScope.launch {
      mutableRestoredToken.value = tokenVault.read()
    }
  }

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
      tokenVault.store(this@GateScannerViewModel.gateToken)
      runCatching { api.verify(gateToken, payload) }
        .onSuccess { mutableState.value = GateScanState.result(it) }
        .onFailure { mutableState.value = GateScanState(GateScanState.Status.ERROR, it.message ?: "게이트 서버에 연결할 수 없습니다.") }
    }
  }

  fun reset() { mutableState.value = GateScanState.ready() }

  fun setGateToken(value: String) { gateToken = value }
}
