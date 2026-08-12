package kr.ticketground.app.foundation

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiBaseUrlTest {
  @Test
  fun `Given a secure API origin When it is parsed Then it preserves its normalized origin`() {
    val baseUrl = ApiBaseUrl.parse("https://dev.ticketground.co.kr/")

    assertEquals("https://dev.ticketground.co.kr", baseUrl.value)
  }

  @Test(expected = IllegalArgumentException::class)
  fun `Given a cleartext API origin When it is parsed Then it is rejected`() {
    ApiBaseUrl.parse("http://ticketground.co.kr")
  }
}
