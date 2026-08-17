package kr.ticketground.app.ui

import kotlinx.coroutines.test.runTest
import kr.ticketground.app.data.ApiTestSupport
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class BookingRepositoryWireTest : ApiTestSupport() {
  @Test
  fun `same attempt retries stable operation headers and new attempt rotates them`() = runTest {
    enqueueBookingResponses(includeHealth = true)
    enqueueBookingResponses(includeHealth = false)
    enqueueBookingResponses(includeHealth = false)
    val client = createHttpsApi()
    val repository = TypedCustomerRepository(client.public(), client.account(), client.lifecycle(), client)
    val sameAttempt = BookingRequest.create("performance-1", "ticket-1", "A1", 100_000)
    val newAttempt = BookingRequest.create("performance-1", "ticket-1", "A1", 100_000)

    val first = repository.book(sameAttempt) as BookingProgress.Held
    val retried = repository.book(sameAttempt) as BookingProgress.Held
    val fresh = repository.book(newAttempt) as BookingProgress.Held

    val requests = List(server.requestCount) { server.takeRequest() }
    listOf(
      "/api/me/queue-entries",
      "/api/me/seat-holds",
      "/api/me/reservation-drafts",
    ).forEach { path ->
      val keys = requests.filter { it.path == path }.map { it.getHeader("X-Idempotency-Key") }
      assertEquals(3, keys.size)
      assertEquals(keys[0], keys[1])
      assertNotEquals(keys[0], keys[2])
    }
    assertEquals(first.checkout.idempotencyKey, retried.checkout.idempotencyKey)
    assertNotEquals(first.checkout.idempotencyKey, fresh.checkout.idempotencyKey)
  }

  private fun enqueueBookingResponses(includeHealth: Boolean) {
    if (includeHealth) server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(queueJson()))
    server.enqueue(success(seatHoldJson()))
    server.enqueue(success(draftJson()))
    server.enqueue(success("""{"configured":true,"clientKey":"test_ck"}"""))
  }
}
