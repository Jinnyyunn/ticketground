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

  @Test
  fun `operator state flags a QR scoped to a different event`() {
    val state = GateScanState.result(GateVerifyResult(valid = false, eventScopeMismatch = true))

    assertEquals(GateScanState.Status.REJECTED, state.status)
    assertEquals("이 게이트에 등록되지 않은 공연입니다.", state.message)
  }

  @Test
  fun `operator state falls back to a generic rejection for any other invalid signature`() {
    val state = GateScanState.result(GateVerifyResult(valid = false))

    assertEquals(GateScanState.Status.REJECTED, state.status)
    assertEquals("입장 QR을 확인할 수 없습니다.", state.message)
  }

  // The tone drives color/icon/haptics at the UI layer (GateApp.kt) - a
  // staff member scanning hundreds of people an hour reads pass/fail from
  // these, not the sentence, so ADMITTED must be the only SUCCESS status and
  // every rejection-shaped status must land on WARNING or DANGER, never
  // NEUTRAL (which would render identically to the idle "ready to scan" card).
  @Test
  fun `tone is unambiguous for every terminal status`() {
    assertEquals(GateResultTone.NEUTRAL, GateScanState.Status.READY.tone())
    assertEquals(GateResultTone.NEUTRAL, GateScanState.Status.VERIFYING.tone())
    assertEquals(GateResultTone.SUCCESS, GateScanState.Status.ADMITTED.tone())
    assertEquals(GateResultTone.WARNING, GateScanState.Status.REPLAY.tone())
    assertEquals(GateResultTone.DANGER, GateScanState.Status.REJECTED.tone())
    assertEquals(GateResultTone.DANGER, GateScanState.Status.ERROR.tone())
  }
}
