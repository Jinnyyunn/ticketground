package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TossCheckoutTest {
  @Test
  fun `unconfigured Toss fails closed before checkout is actionable`() = runTest {
    val gateway = FakeCheckoutGateway(configured = false)
    val coordinator = TossCheckoutCoordinator(gateway, InMemoryCheckoutRetryStore())

    assertEquals(CheckoutError.ProviderUnavailable, assertFails { coordinator.prepare(draft(), "A1", TossPaymentMethod.CREDIT_CARD, "stable-1") })
    assertEquals(0, gateway.confirmCalls)
    assertEquals(1, gateway.cancelCalls)
    assertEquals("draft-1", gateway.lastCancelledDraftId)
  }

  @Test
  fun `successful confirmation is sent once clears payment key and refetches authoritative ticket`() = runTest {
    val gateway = FakeCheckoutGateway(configured = true)
    val store = InMemoryCheckoutRetryStore()
    val coordinator = TossCheckoutCoordinator(gateway, store)
    val request = coordinator.prepare(draft(), "A1", TossPaymentMethod.CREDIT_CARD, "stable-1")

    val first = coordinator.complete(request, TossWidgetResult.Success("one-time-payment-key"))
    val duplicate = coordinator.complete(request, TossWidgetResult.Success("different-key"))

    assertEquals(CheckoutOutcome.Confirmed(gateway.ticket.copy(status = "OWNED")), first)
    assertEquals(first, duplicate)
    assertEquals(1, gateway.confirmCalls)
    assertEquals(1, gateway.fetchCalls)
    assertEquals("stable-1", gateway.lastIdempotencyKey)
    assertEquals("one-time-payment-key", gateway.lastPaymentKey)
    assertNull(store.read()?.paymentKey)
  }

  @Test
  fun `cancel and failure never call server confirmation`() = runTest {
    val gateway = FakeCheckoutGateway(configured = true)
    val coordinator = TossCheckoutCoordinator(gateway, InMemoryCheckoutRetryStore())
    val request = coordinator.prepare(draft(), "A1", TossPaymentMethod.CREDIT_CARD, "stable-1")

    assertEquals(CheckoutOutcome.Cancelled, coordinator.complete(request, TossWidgetResult.Cancelled))
    assertEquals(CheckoutOutcome.Failed("DECLINED"), coordinator.complete(request, TossWidgetResult.Failed("DECLINED")))
    assertEquals(0, gateway.confirmCalls)
    assertEquals(2, gateway.cancelCalls)
    assertEquals("draft-1", gateway.lastCancelledDraftId)
  }

  @Test
  fun `coordinator recreation reuses an explicit attempt key and rotates a new attempt`() = runTest {
    val gateway = FakeCheckoutGateway(configured = true)
    val persistence = InMemoryRetryPersistence()
    val first = TossCheckoutCoordinator(gateway, PersistentCheckoutRetryStore(persistence))
    assertEquals(
      "stable-original",
      first.prepare(draft(), "A1", TossPaymentMethod.CREDIT_CARD, "stable-original").idempotencyKey,
    )

    val recreated = TossCheckoutCoordinator(gateway, PersistentCheckoutRetryStore(persistence))
    val retried = recreated.prepare(draft(), "A1", TossPaymentMethod.CREDIT_CARD, "stable-original")
    val fresh = recreated.prepare(draft(), "A1", TossPaymentMethod.CREDIT_CARD, "stable-fresh")

    assertEquals("stable-original", retried.idempotencyKey)
    assertEquals("stable-fresh", fresh.idempotencyKey)
    assertNull(persistence.string("paymentKey"))
  }

  @Test
  fun `non pending draft cannot start another confirmation`() = runTest {
    val gateway = FakeCheckoutGateway(configured = true)
    val coordinator = TossCheckoutCoordinator(gateway, InMemoryCheckoutRetryStore())

    assertEquals(
      CheckoutError.TicketUnavailable,
      assertFails { coordinator.prepare(draft(LifecycleStatus.CANCELLED), "A1", TossPaymentMethod.CREDIT_CARD, "stable-1") },
    )
    assertEquals(0, gateway.confirmCalls)
  }

  private fun draft(status: LifecycleStatus = LifecycleStatus.PENDING_PAYMENT) = ReservationDraft(
    "draft-1", status, "date-1", listOf("ticket-1"),
    ReservationAmount(100_000, 2_000, 102_000), "2099-01-01T00:00:00Z",
  )

  private suspend fun assertFails(block: suspend () -> Unit): Throwable = try {
    block()
    throw AssertionError("Expected failure")
  } catch (error: AssertionError) {
    throw error
  } catch (error: Throwable) {
    error
  }
}

private class InMemoryRetryPersistence : CheckoutRetryPersistence {
  private val strings = mutableMapOf<String, String>()
  private val booleans = mutableMapOf<String, Boolean>()
  override fun string(key: String): String? = strings[key]
  override fun boolean(key: String): Boolean = booleans[key] ?: false
  override fun putString(key: String, value: String) { strings[key] = value }
  override fun putBoolean(key: String, value: Boolean) { booleans[key] = value }
}

private class FakeCheckoutGateway(
  private val configured: Boolean,
  initialStatus: String = "OWNED",
) : TossCheckoutGateway {
  val ticket = OwnedTicket(
    id = "ticket-1", eventId = "event-1", performanceDateId = "date-1", zoneId = "zone-1",
    seatLabel = "A1", status = initialStatus, available = false, faceValue = 100_000,
    minPrice = 80_000, maxPrice = 100_000, transferCount = 0, maxTransferCount = 1,
  )
  var confirmCalls = 0
  var fetchCalls = 0
  var lastIdempotencyKey: String? = null
  var lastPaymentKey: String? = null
  var cancelCalls = 0
  var lastCancelledDraftId: String? = null

  override suspend fun config() = TossConfig(configured, if (configured) "test_ck" else "")
  override suspend fun ownedTicket(ticketId: String): OwnedTicket {
    fetchCalls += 1
    return if (confirmCalls == 0) ticket else ticket.copy(status = "OWNED")
  }
  override suspend fun confirm(request: TossCheckoutRequest, paymentKey: String) {
    confirmCalls += 1
    lastIdempotencyKey = request.idempotencyKey
    lastPaymentKey = paymentKey
  }
  override suspend fun cancelDraft(draftId: String, idempotencyKey: String) {
    cancelCalls += 1
    lastCancelledDraftId = draftId
  }
}
