package kr.ticketground.app.gate

import kotlinx.serialization.Serializable
import kr.ticketground.app.data.TicketGroundApiClient

@Serializable
data class GateQrPayload(
  val ticketId: String,
  val ownerId: String,
  val expiresAt: String,
  val nonce: String,
  val signature: String,
) {
  companion object {
    fun parse(raw: String): GateQrPayload {
      val parsed = runCatching { TicketGroundApiClient.JSON.decodeFromString(serializer(), raw) }
        .getOrElse { throw GateQrException(GateQrException.Code.MALFORMED_QR) }
      if (listOf(parsed.ticketId, parsed.ownerId, parsed.expiresAt, parsed.nonce, parsed.signature).any(String::isBlank)) {
        throw GateQrException(GateQrException.Code.MALFORMED_QR)
      }
      return parsed
    }
  }
}

@Serializable
data class GateVerifyResult(
  val valid: Boolean,
  val alreadyUsed: Boolean = false,
  val eventScopeMismatch: Boolean = false,
  val usedAt: String? = null,
  val usedByGateId: String? = null,
)

class GateQrException(val code: Code) : Exception("$code") {
  enum class Code { MALFORMED_QR }
}

data class GateScanState(
  val status: Status,
  val message: String,
) {
  enum class Status { READY, VERIFYING, ADMITTED, REPLAY, REJECTED, ERROR }

  companion object {
    fun ready() = GateScanState(Status.READY, "QR을 스캔하세요.")
    fun result(result: GateVerifyResult): GateScanState = when {
      result.valid -> GateScanState(Status.ADMITTED, "입장 확인")
      result.alreadyUsed -> GateScanState(Status.REPLAY, "이미 사용된 입장 QR입니다.")
      result.eventScopeMismatch -> GateScanState(Status.REJECTED, "이 게이트에 등록되지 않은 공연입니다.")
      else -> GateScanState(Status.REJECTED, "입장 QR을 확인할 수 없습니다.")
    }
  }
}

// A gate operator scans hundreds of people an hour under time pressure and
// needs to read pass/fail without reading the sentence - color/icon/haptic
// tone has to be unambiguous at a glance. This is the single place that
// decision is made so the UI layer and any test can agree on it instead of
// re-deriving "is this good or bad" from the status enum separately.
enum class GateResultTone { NEUTRAL, SUCCESS, WARNING, DANGER }

fun GateScanState.Status.tone(): GateResultTone = when (this) {
  GateScanState.Status.READY, GateScanState.Status.VERIFYING -> GateResultTone.NEUTRAL
  GateScanState.Status.ADMITTED -> GateResultTone.SUCCESS
  GateScanState.Status.REPLAY -> GateResultTone.WARNING
  GateScanState.Status.REJECTED, GateScanState.Status.ERROR -> GateResultTone.DANGER
}
