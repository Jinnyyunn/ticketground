package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonObject
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Test
import kr.ticketground.app.foundation.InMemorySessionVault
import kr.ticketground.app.gate.GateQrPayload

class GateApiWireTest {
  @Test
  fun `gate verification sends token header and exact admission payload`() = runTest {
    val server = MockWebServer()
    server.enqueue(MockResponse().setBody("""{"ok":true,"data":{"valid":true}}""").setResponseCode(200))
    server.start()
    try {
      val client = TicketGroundApiClient.forTesting(
        server.url("/"),
        InMemorySessionVault(),
      )
      client.gate().verify("gate-secret", GateQrPayload("ticket-1", "user-1", "2026-09-30T10:00:20Z", "nonce", "signature"))
      val request = server.takeRequest()
      assertEquals("gate-secret", request.getHeader("x-gate-token"))
      assertEquals("ticket-1", TicketGroundApiClient.JSON.parseToJsonElement(request.body.readUtf8()).jsonObject["ticketId"]?.toString()?.trim('"'))
      assertEquals("/api/gate/verify", request.path)
    } finally {
      server.shutdown()
    }
  }
}
