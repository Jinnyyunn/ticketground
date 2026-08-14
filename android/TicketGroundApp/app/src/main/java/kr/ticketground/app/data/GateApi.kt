package kr.ticketground.app.data

import kotlinx.serialization.encodeToString
import kr.ticketground.app.gate.GateQrPayload
import kr.ticketground.app.gate.GateVerifyResult

class GateApi internal constructor(private val client: TicketGroundApiClient) {
  suspend fun verify(gateToken: String, payload: GateQrPayload): GateVerifyResult {
    require(gateToken.isNotBlank())
    return client.execute(
      ApiRequest(
        method = "POST",
        path = "/api/gate/verify",
        body = TicketGroundApiClient.JSON.encodeToString(payload),
        headers = listOf("x-gate-token" to gateToken),
      ),
      GateVerifyResult.serializer(),
    )
  }
}
