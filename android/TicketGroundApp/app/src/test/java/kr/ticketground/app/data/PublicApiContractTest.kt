package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class PublicApiContractTest : ApiTestSupport() {
  @Test
  fun `catalog rejects a server issued cursor loop`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(catalogPage("cursor-a")))
    server.enqueue(success(catalogPage("cursor-a")))
    val api = TicketGroundApiClient.forTesting(server.url("/"), vault)

    assertFailsWith<ApiError.MalformedResponse> { api.public().catalog(limit = 25) }
    assertEquals("/api/health", server.takeRequest().path)
    assertEquals("/api/catalog?limit=25", server.takeRequest().path)
    assertEquals("/api/catalog?limit=25&cursor=cursor-a", server.takeRequest().path)
  }

  @Test
  fun `catalog rejects out of range limit before network`() = runTest {
    server.start()
    val api = TicketGroundApiClient.forTesting(server.url("/"), vault)

    assertFailsWith<IllegalArgumentException> { api.public().catalog(limit = 101) }
    assertEquals(0, server.requestCount)
  }

  @Test
  fun `discovery rejects an incompatible response identity`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success("""{"version":"2","regions":[]}"""))
    val api = TicketGroundApiClient.forTesting(server.url("/"), vault)

    assertFailsWith<ApiError.IncompatibleContract> { api.public().regions() }
  }

  @Test
  fun `public support rejects an incompatible response identity`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success("""{"version":"2","faqs":[],"notices":[]}"""))
    val api = TicketGroundApiClient.forTesting(server.url("/"), vault)

    assertFailsWith<ApiError.IncompatibleContract> { api.public().publicSupport() }
  }

  @Test
  fun `malformed and explicit HTTP failures map to typed errors`() = runTest {
    val cases = listOf(
      MockResponse().setResponseCode(200).setBody("{") to ApiError.MalformedResponse::class.java,
      failure(401, "UNAUTHORIZED") to ApiError.Unauthorized::class.java,
      failure(403, "FORBIDDEN") to ApiError.Forbidden::class.java,
      failure(404, "NOT_FOUND") to ApiError.NotFound::class.java,
      failure(409, "IDEMPOTENCY_CONFLICT") to ApiError.Conflict::class.java,
      failure(503, "BACKEND_DOWN") to ApiError.Retryable::class.java,
    )
    cases.forEach { (response, expected) ->
      server.enqueue(response)
      val error = assertFails { TicketGroundApiClient.forTesting(server.url("/"), vault).health() }
      assertEquals(expected, error.javaClass)
    }
  }

  @Test
  fun `unknown lifecycle status decodes but remains action ineligible`() = runTest {
    val hold = TicketGroundApiClient.decodeForTesting<SeatHold>(seatHoldJson(status = "FUTURE_STATUS"))

    assertEquals(LifecycleStatus.UNKNOWN, hold.status)
    assertFalse(hold.canExtend)
    assertFalse(hold.canRelease)
  }
}
