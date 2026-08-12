package kr.ticketground.app.data

import java.time.Instant
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LifecyclePolicyTest {
  private val owned = OwnedTicket(
    id = "ticket-1", eventId = "event-1", performanceDateId = "date-1", zoneId = "zone-1",
    seatLabel = "A1", status = "OWNED", available = false, faceValue = 100_000,
    minPrice = 80_000, maxPrice = 100_000, transferCount = 0, maxTransferCount = 1,
  )

  @Test
  fun `ticket actions fail closed for stale unknown and out of bound states`() {
    assertTrue(LifecyclePolicy.canCancel(owned))
    assertTrue(LifecyclePolicy.canListForResale(owned, 80_000))
    assertFalse(LifecyclePolicy.canListForResale(owned, 79_999))
    assertFalse(LifecyclePolicy.canCancel(owned.copy(status = "FUTURE")))
    assertFalse(LifecyclePolicy.canIssueQr(owned.copy(available = true)))
  }

  @Test
  fun `expired malformed and boundary admission QR values are non actionable`() {
    val now = Instant.parse("2026-08-12T12:00:00Z")
    assertTrue(LifecyclePolicy.isAdmissionQrActionable("2026-08-12T12:00:01Z", now))
    assertFalse(LifecyclePolicy.isAdmissionQrActionable("2026-08-12T12:00:00Z", now))
    assertFalse(LifecyclePolicy.isAdmissionQrActionable("invalid", now))
  }

  @Test
  fun `device revoke and push actions accept only known active states`() {
    assertTrue(LifecyclePolicy.canRevoke(TrustedDeviceStatus.TRUSTED))
    assertFalse(LifecyclePolicy.canRevoke(TrustedDeviceStatus.UNKNOWN))
    assertTrue(LifecyclePolicy.isPushActive(PushTokenStatus.ACTIVE))
    assertFalse(LifecyclePolicy.isPushActive(PushTokenStatus.UNKNOWN))
  }
}
