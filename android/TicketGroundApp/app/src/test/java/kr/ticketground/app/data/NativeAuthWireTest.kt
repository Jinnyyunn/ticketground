package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonObject
import okhttp3.mockwebserver.MockResponse
import org.junit.Assert.assertEquals
import org.junit.Test

class NativeAuthWireTest : ApiTestSupport() {
  @Test
  fun `native handoff exchanges one use code and persists bearer session`() = runTest {
    server.enqueue(success("""
      {"user":{"id":"account-1","name":"윤진영","status":"ACTIVE","trustScore":90,"profileConfirmed":true},
       "session":{"credential":"native-bearer","expiresAt":"2099-01-01T00:00:00Z"}}
    """))
    val api = createHttpsApi(storeCredential = false)

    val user = api.completeNativeLogin("kakao", "one-use-code")
    val request = server.takeRequest()
    val body = TicketGroundApiClient.JSON.parseToJsonElement(request.body.readUtf8()).jsonObject

    assertEquals("/api/auth/native/handoff", request.path)
    assertEquals("kakao", body["provider"]?.toString()?.trim('"'))
    assertEquals("one-use-code", body["code"]?.toString()?.trim('"'))
    assertEquals("account-1", user.id)
    assertEquals("native-bearer", vault.read()?.accessToken)
  }
}
