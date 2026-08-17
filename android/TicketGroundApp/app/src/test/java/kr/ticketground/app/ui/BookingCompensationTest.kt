package kr.ticketground.app.ui

import kotlinx.coroutines.test.runTest
import kr.ticketground.app.data.ApiTestSupport
import kr.ticketground.app.data.BookingApi
import kr.ticketground.app.data.CheckoutRetryStore
import kr.ticketground.app.data.InMemoryCheckoutRetryStore
import kr.ticketground.app.data.LifecycleStatus
import kr.ticketground.app.data.QueueEntry
import kr.ticketground.app.data.ReservationAmount
import kr.ticketground.app.data.ReservationDraft
import kr.ticketground.app.data.SeatHold
import kr.ticketground.app.data.TossCheckoutPreparer
import kr.ticketground.app.data.TossCheckoutRequest
import kr.ticketground.app.data.TossPaymentMethod
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class BookingCompensationTest : ApiTestSupport() {
  @Test
  fun `draft creation failure releases the active hold once and preserves the primary failure`() = runTest {
    val primary = IllegalStateException("draft failed")
    val bookingApi = FakeBookingApi(draftFailure = primary)
    val repository = repository(bookingApi)

    val thrown = assertFails { repository.book(bookingApi.request) }

    assertSame(primary, thrown)
    assertEquals(listOf("queue", "hold", "draft", "release:hold-1"), bookingApi.calls)
    assertEquals(listOf(bookingApi.request.operationKeys.holdRelease), bookingApi.releaseKeys)
  }

  @Test
  fun `invalid pending draft is cancelled then releases its hold without preparing payment`() = runTest {
    val bookingApi = FakeBookingApi(draft = compensationDraft(ticketIds = listOf("different-ticket")))
    val checkout = FakeCheckoutPreparer()
    val repository = repository(bookingApi, checkout)

    val result = repository.book(bookingApi.request)

    assertTrue(result is BookingProgress.Conflict)
    assertEquals(listOf("queue", "hold", "draft", "cancel:draft-1", "release:hold-1"), bookingApi.calls)
    assertEquals(listOf(bookingApi.request.operationKeys.draftCancel), bookingApi.cancelKeys)
    assertEquals(listOf(bookingApi.request.operationKeys.holdRelease), bookingApi.releaseKeys)
    assertEquals(0, checkout.prepareCalls)
  }

  @Test
  fun `mismatched active hold is released before returning conflict`() = runTest {
    val bookingApi = FakeBookingApi(hold = compensationHold(ticketIds = listOf("different-ticket")))
    val checkout = FakeCheckoutPreparer()
    val repository = repository(bookingApi, checkout)

    val result = repository.book(bookingApi.request)

    assertTrue(result is BookingProgress.Conflict)
    assertEquals(listOf("queue", "hold", "release:hold-1"), bookingApi.calls)
    assertEquals(listOf(bookingApi.request.operationKeys.holdRelease), bookingApi.releaseKeys)
    assertEquals(0, checkout.prepareCalls)
  }

  @Test
  fun `mismatched active hold cleanup failure is suppressed on primary conflict`() = runTest {
    val releaseFailure = IllegalStateException("release failed")
    val bookingApi = FakeBookingApi(
      hold = compensationHold(ticketIds = listOf("different-ticket")),
      releaseFailure = releaseFailure,
    )
    val repository = repository(bookingApi)

    val thrown = assertFails { repository.book(bookingApi.request) }

    assertTrue(thrown is BookingPreparationFailure)
    assertTrue((thrown as BookingPreparationFailure).progress is BookingProgress.Conflict)
    assertEquals(listOf(releaseFailure), thrown.suppressed.toList())
    assertEquals(listOf("queue", "hold", "release:hold-1"), bookingApi.calls)
    assertEquals(listOf(bookingApi.request.operationKeys.holdRelease), bookingApi.releaseKeys)
  }

  @Test
  fun `payment prepare failure cancels the draft then releases its hold once`() = runTest {
    val primary = IllegalStateException("payment prepare failed")
    val bookingApi = FakeBookingApi()
    val checkout = FakeCheckoutPreparer(failure = primary)
    val repository = repository(bookingApi, checkout)

    val thrown = assertFails { repository.book(bookingApi.request) }

    assertSame(primary, thrown)
    assertEquals(listOf("queue", "hold", "draft", "cancel:draft-1", "release:hold-1"), bookingApi.calls)
    assertEquals(listOf(bookingApi.request.operationKeys.draftCancel), bookingApi.cancelKeys)
    assertEquals(listOf(bookingApi.request.operationKeys.holdRelease), bookingApi.releaseKeys)
    assertEquals(1, checkout.prepareCalls)
  }

  @Test
  fun `invalid payment request is compensated and never returned as held`() = runTest {
    val bookingApi = FakeBookingApi()
    val checkout = FakeCheckoutPreparer(
      result = compensationCheckoutRequest(draftId = "unrelated-draft"),
    )
    val repository = repository(bookingApi, checkout)

    val result = repository.book(bookingApi.request)

    assertTrue(result is BookingProgress.Conflict)
    assertEquals(listOf("queue", "hold", "draft", "cancel:draft-1", "release:hold-1"), bookingApi.calls)
  }

  @Test
  fun `failed draft cleanup still attempts hold release and does not mask payment failure`() = runTest {
    val primary = IllegalStateException("payment prepare failed")
    val cancelFailure = IllegalStateException("cancel failed")
    val releaseFailure = IllegalStateException("release failed")
    val bookingApi = FakeBookingApi(cancelFailure = cancelFailure, releaseFailure = releaseFailure)
    val repository = repository(bookingApi, FakeCheckoutPreparer(failure = primary))

    val thrown = assertFails { repository.book(bookingApi.request) }

    assertSame(primary, thrown)
    assertEquals(listOf(cancelFailure, releaseFailure), thrown.suppressed.toList())
    assertEquals(listOf("queue", "hold", "draft", "cancel:draft-1", "release:hold-1"), bookingApi.calls)
  }

  @Test
  fun `successful handoff performs no compensation`() = runTest {
    val bookingApi = FakeBookingApi()
    val checkout = FakeCheckoutPreparer()
    val repository = repository(bookingApi, checkout)

    val result = repository.book(bookingApi.request)

    assertTrue(result is BookingProgress.Held)
    assertEquals(emptyList<String>(), bookingApi.releaseKeys)
    assertEquals(emptyList<String>(), bookingApi.cancelKeys)
  }

  @Test
  fun `retry compensation keys stay stable while a new attempt rotates`() = runTest {
    val bookingApi = FakeBookingApi()
    val repository = repository(bookingApi, FakeCheckoutPreparer(failure = IllegalStateException("failed")))
    val sameAttempt = bookingApi.request
    val newAttempt = BookingRequest.create("performance-1", "ticket-1", "A1", 100_000)

    assertFails { repository.book(sameAttempt) }
    assertFails { repository.book(sameAttempt) }
    assertFails { repository.book(newAttempt) }

    assertEquals(bookingApi.observedQueueKeys[0], bookingApi.observedQueueKeys[1])
    assertNotEquals(bookingApi.observedQueueKeys[0], bookingApi.observedQueueKeys[2])
    assertEquals(bookingApi.cancelKeys[0], bookingApi.cancelKeys[1])
    assertNotEquals(bookingApi.cancelKeys[0], bookingApi.cancelKeys[2])
    assertEquals(bookingApi.releaseKeys[0], bookingApi.releaseKeys[1])
    assertNotEquals(bookingApi.releaseKeys[0], bookingApi.releaseKeys[2])
  }

  private suspend fun repository(
    bookingApi: FakeBookingApi,
    checkout: TossCheckoutPreparer = FakeCheckoutPreparer(),
    retryStore: CheckoutRetryStore = InMemoryCheckoutRetryStore(),
  ): TypedCustomerRepository {
    val client = createHttpsApi()
    return TypedCustomerRepository(
      client.public(), client.account(), client.lifecycle(), client, retryStore,
      bookingApi = bookingApi,
      checkoutPreparer = checkout,
    )
  }

}

private class FakeBookingApi(
  private val hold: SeatHold = compensationHold(),
  private val draft: ReservationDraft = compensationDraft(),
  private val draftFailure: Throwable? = null,
  private val cancelFailure: Throwable? = null,
  private val releaseFailure: Throwable? = null,
) : BookingApi {
  val request = BookingRequest.create("performance-1", "ticket-1", "A1", 100_000)
  val calls = mutableListOf<String>()
  val releaseKeys = mutableListOf<String>()
  val cancelKeys = mutableListOf<String>()
  val observedQueueKeys = mutableListOf<String>()

  override suspend fun enterQueue(performanceDateId: String, idempotencyKey: String): QueueEntry {
    calls += "queue"
    observedQueueKeys += idempotencyKey
    return QueueEntry(
      "queue-1", performanceDateId, LifecycleStatus.ADMITTED, 0,
      admittedAt = "2099-01-01T00:00:00Z",
      admissionExpiresAt = "2099-01-01T00:10:00Z",
      enteredAt = "2099-01-01T00:00:00Z",
    )
  }

  override suspend fun queueEntry(entryId: String): QueueEntry = error("not used")

  override suspend fun createSeatHold(
    performanceDateId: String,
    ticketIds: List<String>,
    idempotencyKey: String,
  ): SeatHold {
    calls += "hold"
    return hold
  }

  override suspend fun releaseSeatHold(holdId: String, idempotencyKey: String): SeatHold {
    calls += "release:$holdId"
    releaseKeys += idempotencyKey
    releaseFailure?.let { throw it }
    return compensationHold().copy(status = LifecycleStatus.RELEASED)
  }

  override suspend fun createReservationDraft(holdId: String, idempotencyKey: String): ReservationDraft {
    calls += "draft"
    draftFailure?.let { throw it }
    return draft
  }

  override suspend fun cancelReservationDraft(draftId: String, idempotencyKey: String): ReservationDraft {
    calls += "cancel:$draftId"
    cancelKeys += idempotencyKey
    cancelFailure?.let { throw it }
    return draft.copy(status = LifecycleStatus.CANCELLED)
  }
}

private class FakeCheckoutPreparer(
  private val result: TossCheckoutRequest = compensationCheckoutRequest(),
  private val failure: Throwable? = null,
) : TossCheckoutPreparer {
  var prepareCalls = 0

  override suspend fun prepare(
    draft: ReservationDraft,
    orderName: String,
    method: TossPaymentMethod,
    idempotencyKey: String,
  ): TossCheckoutRequest {
    prepareCalls += 1
    failure?.let { throw it }
    return result.copy(idempotencyKey = idempotencyKey)
  }
}

private fun compensationHold(ticketIds: List<String> = listOf("ticket-1")) = SeatHold(
  "hold-1", LifecycleStatus.ACTIVE, "performance-1", ticketIds,
  "2099-01-01T00:00:00Z", 0,
)

private fun compensationDraft(ticketIds: List<String> = listOf("ticket-1")) = ReservationDraft(
  "draft-1", LifecycleStatus.PENDING_PAYMENT, "performance-1", ticketIds,
  ReservationAmount(100_000, 2_000, 102_000), "2099-01-01T00:00:00Z",
)

private fun compensationCheckoutRequest(draftId: String = "draft-1") = TossCheckoutRequest(
  draftId, "ticket-1", "A1", 102_000, TossPaymentMethod.CREDIT_CARD,
  "test_ck", "payment-key",
)
