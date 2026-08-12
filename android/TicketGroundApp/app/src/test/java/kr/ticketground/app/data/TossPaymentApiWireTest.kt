package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TossPaymentApiWireTest : ApiTestSupport() {
  @Test
  fun `Toss config is public but requires the secure configured origin`() = runTest {
    server.enqueue(success("{\"configured\":false,\"clientKey\":\"\"}"))
    val api = createHttpsApi().payments()

    assertEquals(TossConfig(false, ""), api.config())
    assertNull(server.takeRequest().getHeader("Authorization"))
  }

  @Test
  fun `Toss confirmation binds bearer principal allowlisted method and stable key`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(sessionJson("계정")))
    server.enqueue(success("{\"ticket\":{\"id\":\"ticket-1\",\"seatLabel\":\"A1\"}}"))
    val api = createHttpsApi().payments()
    val request = TossCheckoutRequest(
      "draft-1", "ticket-1", "A1", 102_000, TossPaymentMethod.CREDIT_CARD, "test_ck", "stable-payment",
    )

    api.confirm(request, "one-time-payment-key")

    server.takeRequest()
    server.takeRequest()
    val confirm = server.takeRequest()
    assertEquals("Bearer secret-bearer", confirm.getHeader("Authorization"))
    assertEquals("stable-payment", confirm.getHeader("X-Idempotency-Key"))
    assertEquals(
      "{\"userId\":\"account-1\",\"ticketId\":\"ticket-1\",\"reservationDraftId\":\"draft-1\",\"paymentMethod\":\"CREDIT_CARD\",\"tossPaymentKey\":\"one-time-payment-key\"}",
      confirm.body.readUtf8(),
    )
  }
}
