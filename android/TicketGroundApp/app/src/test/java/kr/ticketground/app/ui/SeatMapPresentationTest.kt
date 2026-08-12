package kr.ticketground.app.ui

import kr.ticketground.app.data.Seat
import kr.ticketground.app.data.SeatPosition
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class SeatMapPresentationTest {
  @Test
  fun `map image resolves only against the configured https origin`() {
    assertEquals(
      "https://dev.ticketground.co.kr/maps/venue.svg",
      safeSeatMapImageUrl("/maps/venue.svg", "https://dev.ticketground.co.kr"),
    )
    assertNull(safeSeatMapImageUrl("http://dev.ticketground.co.kr/maps/venue.svg", "https://dev.ticketground.co.kr"))
    assertNull(safeSeatMapImageUrl("https://attacker.example/maps/venue.svg", "https://dev.ticketground.co.kr"))
  }

  @Test
  fun `marker geometry follows backend width and height with iOS bounds`() {
    val geometry = seatMarkerGeometry(
      position = SeatPosition(30.0, 45.0, 20.0, 3.0, 0.0, "rounded"),
      mapWidth = 400f,
      mapHeight = 240f,
    )

    assertEquals(120f, geometry.centerX, 0.01f)
    assertEquals(108f, geometry.centerY, 0.01f)
    assertEquals(60f, geometry.width, 0.01f)
    assertEquals(16f, geometry.height, 0.01f)
  }

  @Test
  fun `backend held seat is disabled and distinct from sold and unavailable`() {
    val held = seatPresentation(seat("HELD", available = false), null, emptySet())
    val sold = seatPresentation(seat("SOLD", available = false), null, emptySet())
    val unavailable = seatPresentation(seat("BLOCKED", available = false), null, emptySet())

    assertEquals("점유됨", held.label)
    assertFalse(held.selectable)
    assertEquals("판매 완료", sold.label)
    assertEquals("선택 불가", unavailable.label)
  }

  @Test
  fun `seat map image client never follows a cross-origin redirect`() {
    val origin = MockWebServer()
    val redirectTarget = MockWebServer()
    val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    origin.useHttps(serverCertificates.sslSocketFactory(), false)
    redirectTarget.useHttps(serverCertificates.sslSocketFactory(), false)
    origin.start()
    redirectTarget.start()
    try {
      origin.enqueue(
        MockResponse().setResponseCode(302).setHeader("Location", redirectTarget.url("/captured.svg")),
      )

      val builder = OkHttpClient.Builder().sslSocketFactory(
        clientCertificates.sslSocketFactory(),
        clientCertificates.trustManager,
      )
      seatMapImageHttpClient(builder).newCall(Request.Builder().url(origin.url("/map.svg")).build()).execute().use { response ->
        assertEquals(302, response.code)
      }
      assertEquals(0, redirectTarget.requestCount)
    } finally {
      origin.close()
      redirectTarget.close()
    }
  }

  private fun seat(status: String, available: Boolean) = Seat(
    id = "seat-a1",
    label = "1열 1번",
    displayCode = "A구역 1열 1번",
    zoneId = "zone-a",
    zoneName = "A구역",
    price = 120_000,
    status = status,
    available = available,
    mapPosition = SeatPosition(30.0, 45.0, 4.0, 4.0, 0.0, "circle"),
  )
}
