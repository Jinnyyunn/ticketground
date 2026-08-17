package kr.ticketground.app.ui

import kotlinx.coroutines.test.runTest
import kr.ticketground.app.data.ApiTestSupport
import kr.ticketground.app.data.BookingApi
import kr.ticketground.app.data.LifecycleStatus
import kr.ticketground.app.data.QueueEntry
import kr.ticketground.app.data.ReservationDraft
import kr.ticketground.app.data.SeatHold
import org.junit.Assert.assertEquals
import kr.ticketground.app.data.TossCheckoutPreparer
import kr.ticketground.app.data.TossCheckoutRequest
import kr.ticketground.app.data.TossPaymentMethod
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class BookingQueueRefreshTest : ApiTestSupport() {
  @Test
  fun `waiting refresh advances only after observed admission without entering queue again`() = runTest {
    val bookingApi = QueueRefreshBookingApi(refreshStatus = LifecycleStatus.ADMITTED)
    val repository = repository(bookingApi)
    val request = bookingApi.request

    val waiting = repository.book(request) as BookingProgress.Waiting
    val result = repository.refreshBooking(request, waiting.entryId)

    assertEquals("queue-1", waiting.entryId)
    assertTrue(result is BookingProgress.Held)
    assertEquals(listOf("enter", "refresh:queue-1", "hold", "draft"), bookingApi.calls)
    assertEquals(request.operationKeys.hold, bookingApi.holdKey)
    assertEquals(request.operationKeys.draft, bookingApi.draftKey)
  }

  @Test
  fun `waiting refresh stays waiting with preserved identity until admission is observed`() = runTest {
    val bookingApi = QueueRefreshBookingApi(refreshStatus = LifecycleStatus.WAITING, refreshPosition = 2)
    val repository = repository(bookingApi)
    val request = bookingApi.request

    val waiting = repository.book(request) as BookingProgress.Waiting
    val refreshed = repository.refreshBooking(request, waiting.entryId) as BookingProgress.Waiting

    assertEquals("queue-1", refreshed.entryId)
    assertEquals(2, refreshed.position)
    assertEquals(listOf("enter", "refresh:queue-1"), bookingApi.calls)
  }

  @Test
  fun `expired waiting refresh fails closed without creating a hold`() = runTest {
    val bookingApi = QueueRefreshBookingApi(refreshStatus = LifecycleStatus.EXPIRED)
    val repository = repository(bookingApi)
    val request = bookingApi.request

    val waiting = repository.book(request) as BookingProgress.Waiting
    val result = repository.refreshBooking(request, waiting.entryId)

    assertTrue(result is BookingProgress.Expired)
    assertEquals(listOf("enter", "refresh:queue-1"), bookingApi.calls)
  }

  @Test
  fun `waiting refresh transport failure is propagated without creating a hold`() = runTest {
    val primary = IllegalStateException("queue read failed")
    val bookingApi = QueueRefreshBookingApi(refreshFailure = primary)
    val repository = repository(bookingApi)
    val request = bookingApi.request

    val waiting = repository.book(request) as BookingProgress.Waiting
    val thrown = assertFails { repository.refreshBooking(request, waiting.entryId) }

    assertSame(primary, thrown)
    assertEquals(listOf("enter", "refresh:queue-1"), bookingApi.calls)
  }

  private suspend fun repository(bookingApi: BookingApi): TypedCustomerRepository {
    val client = createHttpsApi()
    return TypedCustomerRepository(
      client.public(), client.account(), client.lifecycle(), client,
      bookingApi = bookingApi,
      checkoutPreparer = QueueRefreshCheckoutPreparer(),
    )
  }
}

private class QueueRefreshBookingApi(
  private val refreshStatus: LifecycleStatus = LifecycleStatus.WAITING,
  private val refreshPosition: Int = 1,
  private val refreshFailure: Throwable? = null,
) : BookingApi {
  val request = BookingRequest.create("performance-1", "ticket-1", "A1", 100_000)
  val calls = mutableListOf<String>()
  var holdKey: String? = null
  var draftKey: String? = null

  override suspend fun enterQueue(performanceDateId: String, idempotencyKey: String): QueueEntry {
    calls += "enter"
    return queueEntry(LifecycleStatus.WAITING, 4)
  }

  override suspend fun queueEntry(entryId: String): QueueEntry {
    calls += "refresh:$entryId"
    refreshFailure?.let { throw it }
    return queueEntry(refreshStatus, refreshPosition)
  }

  override suspend fun createSeatHold(
    performanceDateId: String,
    ticketIds: List<String>,
    idempotencyKey: String,
  ): SeatHold {
    calls += "hold"
    holdKey = idempotencyKey
    return SeatHold(
      "hold-1", LifecycleStatus.ACTIVE, performanceDateId, ticketIds,
      "2099-01-01T00:10:00Z", 0,
    )
  }

  override suspend fun releaseSeatHold(holdId: String, idempotencyKey: String): SeatHold =
    error("not used")

  override suspend fun createReservationDraft(holdId: String, idempotencyKey: String): ReservationDraft {
    calls += "draft"
    draftKey = idempotencyKey
    return ReservationDraft(
      "draft-1", LifecycleStatus.PENDING_PAYMENT, "performance-1", listOf("ticket-1"),
      kr.ticketground.app.data.ReservationAmount(100_000, 0, 100_000),
      "2099-01-01T00:10:00Z",
    )
  }

  override suspend fun cancelReservationDraft(draftId: String, idempotencyKey: String): ReservationDraft =
    error("not used")

  private fun queueEntry(status: LifecycleStatus, position: Int) = QueueEntry(
    "queue-1", "performance-1", status, position,
    admittedAt = if (status == LifecycleStatus.ADMITTED) "2099-01-01T00:00:00Z" else null,
    admissionExpiresAt = "2099-01-01T00:10:00Z",
    enteredAt = "2099-01-01T00:00:00Z",
  )
}

private class QueueRefreshCheckoutPreparer : TossCheckoutPreparer {
  override suspend fun prepare(
    draft: ReservationDraft,
    orderName: String,
    method: TossPaymentMethod,
    idempotencyKey: String,
  ) = TossCheckoutRequest(
    draft.id, draft.ticketIds.single(), orderName, draft.amount.total,
    method, "client-key", idempotencyKey,
  )
}
