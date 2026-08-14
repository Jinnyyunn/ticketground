package kr.ticketground.app.gate

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class GateVerificationTest {
  @Test
  fun `scanner parses the customer admission payload`() {
    val payload = GateQrPayload.parse("""{"ticketId":"ticket-1","ownerId":"user-1","expiresAt":"2026-09-30T10:00:20Z","nonce":"n","signature":"s"}""")

    assertEquals("ticket-1", payload.ticketId)
    assertEquals("user-1", payload.ownerId)
  }

  @Test
  fun `scanner rejects non admission content before network call`() {
    val error = assertThrows(GateQrException::class.java) { GateQrPayload.parse("not a ticket") }

    assertEquals(GateQrException.Code.MALFORMED_QR, error.code)
  }

  @Test
  fun `operator state exposes a successful admission`() {
    val state = GateScanState.result(GateVerifyResult(valid = true, alreadyUsed = false))

    assertEquals(GateScanState.Status.ADMITTED, state.status)
    assertEquals("입장 확인", state.message)
  }

  @Test
  fun `operator state exposes a replay without admitting it`() {
    val state = GateScanState.result(GateVerifyResult(valid = false, alreadyUsed = true))

    assertEquals(GateScanState.Status.REPLAY, state.status)
    assertEquals("이미 사용된 입장 QR입니다.", state.message)
  }
}
