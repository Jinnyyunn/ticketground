package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import kr.ticketground.app.foundation.BearerSession

class ApiSecurityTest : ApiTestSupport() {
  @Test
  fun `public health never sends the stored bearer`() = runTest {
    vault.store(BearerSession("secret-bearer"))
    server.enqueue(success("""{"status":"UP","version":"78b3c7c","capabilities":[]}"""))
    val client = TicketGroundApiClient.forTesting(server.url("/"), vault)

    val health = client.health()

    assertEquals("UP", health.status)
    assertNull(server.takeRequest().getHeader("Authorization"))
  }

  @Test
  fun `http origin rejects a stored bearer without a network request`() = runTest {
    vault.store(BearerSession("secret-bearer"))
    server.start()
    val client = TicketGroundApiClient.forTesting(server.url("/"), vault)

    assertFailsWith<ApiError.InsecureOrigin> { client.account().session() }
    assertEquals(0, server.requestCount)
  }

  @Test
  fun `https origin without a bearer fails missing credential before network`() = runTest {
    val api = createHttpsApi(storeCredential = false)

    assertFailsWith<ApiError.MissingCredential> { api.account().session() }
    assertEquals(0, server.requestCount)
  }

  @Test
  fun `authenticated principal mutation keeps caller idempotency key`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(seatHoldJson()))
    val api = createHttpsApi()

    val hold = api.account().createSeatHold("performance-1", listOf("ticket-1"), "stable-hold-key")

    assertEquals("hold-1", hold.id)
    val healthRequest = server.takeRequest()
    val mutation = server.takeRequest()
    assertNull(healthRequest.getHeader("Authorization"))
    assertEquals("Bearer secret-bearer", mutation.getHeader("Authorization"))
    assertEquals("stable-hold-key", mutation.getHeader("X-Idempotency-Key"))
    assertEquals("/api/me/seat-holds", mutation.path)
    assertFalse(mutation.body.readUtf8().contains("userId"))
  }

  @Test
  fun `empty patch mutation keeps the stable idempotency key`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(seatHoldJson()))
    val api = createHttpsApi()

    api.account().extendSeatHold("hold-1", "stable-extend-key")

    server.takeRequest()
    val request = server.takeRequest()
    assertEquals("PATCH", request.method)
    assertEquals(0L, request.bodySize)
    assertEquals("stable-extend-key", request.getHeader("X-Idempotency-Key"))
  }

  @Test
  fun `authenticated redirect never forwards bearer to another origin`() = runTest {
    val redirectTarget = MockWebServer()
    val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    server.useHttps(serverCertificates.sslSocketFactory(), false)
    redirectTarget.useHttps(serverCertificates.sslSocketFactory(), false)
    redirectTarget.start()
    try {
      server.enqueue(success(healthWithCapabilities()))
      server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", redirectTarget.url("/capture")))
      vault.store(BearerSession("secret-bearer"))
      val api = TicketGroundApiClient.forTesting(
        server.url("/"),
        vault,
        OkHttpClient.Builder().sslSocketFactory(
          clientCertificates.sslSocketFactory(), clientCertificates.trustManager,
        ).build(),
      )

      assertFailsWith<ApiError.Server> { api.account().session() }
      assertEquals(0, redirectTarget.requestCount)
    } finally {
      redirectTarget.close()
    }
  }
}
