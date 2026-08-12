package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import kr.ticketground.app.foundation.BearerSession
import kr.ticketground.app.foundation.InMemorySessionVault

class TicketGroundApiTest {
  private lateinit var server: MockWebServer
  private lateinit var vault: InMemorySessionVault

  @Before
  fun setUp() {
    server = MockWebServer()
    vault = InMemorySessionVault()
  }

  @After
  fun tearDown() {
    server.close()
  }

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
  fun `authenticated principal mutation keeps caller idempotency key and follows no redirect`() = runTest {
    val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    server.useHttps(serverCertificates.sslSocketFactory(), false)
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(seatHoldJson()))
    vault.store(BearerSession("secret-bearer"))
    val api = TicketGroundApiClient.forTesting(
      server.url("/"),
      vault,
      OkHttpClient.Builder().sslSocketFactory(
        clientCertificates.sslSocketFactory(),
        clientCertificates.trustManager,
      ).build(),
    )

    val hold = api.account().createSeatHold(
      performanceDateId = "performance-1",
      ticketIds = listOf("ticket-1"),
      idempotencyKey = "stable-hold-key",
    )

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
    val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    server.useHttps(serverCertificates.sslSocketFactory(), false)
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(seatHoldJson()))
    vault.store(BearerSession("secret-bearer"))
    val api = TicketGroundApiClient.forTesting(
      server.url("/"),
      vault,
      OkHttpClient.Builder().sslSocketFactory(
        clientCertificates.sslSocketFactory(),
        clientCertificates.trustManager,
      ).build(),
    )

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
      server.enqueue(
        MockResponse()
          .setResponseCode(302)
          .setHeader("Location", redirectTarget.url("/capture")),
      )
      vault.store(BearerSession("secret-bearer"))
      val api = TicketGroundApiClient.forTesting(
        server.url("/"),
        vault,
        OkHttpClient.Builder().sslSocketFactory(
          clientCertificates.sslSocketFactory(),
          clientCertificates.trustManager,
        ).build(),
      )

      assertFailsWith<ApiError.Server> { api.account().session() }

      assertEquals(0, redirectTarget.requestCount)
    } finally {
      redirectTarget.close()
    }
  }

  @Test
  fun `profile mutation uses principal route without a user id`() = runTest {
    val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    server.useHttps(serverCertificates.sslSocketFactory(), false)
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(sessionJson(name = "새 이름")))
    vault.store(BearerSession("secret-bearer"))
    val api = TicketGroundApiClient.forTesting(
      server.url("/"),
      vault,
      OkHttpClient.Builder().sslSocketFactory(
        clientCertificates.sslSocketFactory(),
        clientCertificates.trustManager,
      ).build(),
    )

    val profile = api.account().updateProfile("새 이름", "stable-profile-key")

    assertEquals("새 이름", profile.name)
    server.takeRequest()
    val request = server.takeRequest()
    assertEquals("PATCH", request.method)
    assertEquals("/api/me/profile", request.path)
    assertEquals("stable-profile-key", request.getHeader("X-Idempotency-Key"))
    assertEquals("{\"name\":\"새 이름\"}", request.body.readUtf8())
  }

  @Test
  fun `support mutations use principal paths and deployed bodies`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(supportThreadJson()))
    server.enqueue(success(supportThreadJson()))
    val api = createHttpsApi()

    api.account().createSupportThread("문의", "도와주세요", "support-create-key")
    api.account().addSupportMessage("thread-1", "추가 내용", "support-message-key")

    server.takeRequest()
    val create = server.takeRequest()
    val reply = server.takeRequest()
    assertEquals("/api/me/support/threads", create.path)
    assertEquals("{\"subject\":\"문의\",\"message\":\"도와주세요\"}", create.body.readUtf8())
    assertEquals("support-create-key", create.getHeader("X-Idempotency-Key"))
    assertEquals("/api/me/support/messages", reply.path)
    assertEquals("{\"threadId\":\"thread-1\",\"message\":\"추가 내용\"}", reply.body.readUtf8())
    assertEquals("support-message-key", reply.getHeader("X-Idempotency-Key"))
  }

  @Test
  fun `watchlist mutations encode event in path and preferences in body`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(watchlistJson()))
    server.enqueue(success("""{"deleted":true,"eventId":"event/한"}"""))
    val api = createHttpsApi()

    api.account().upsertWatchlist(
      eventId = "event/한",
      channels = listOf("APP_PUSH"),
      calendarEnabled = true,
      notificationEnabled = false,
      idempotencyKey = "watch-upsert-key",
    )
    api.account().deleteWatchlist("event/한", "watch-delete-key")

    server.takeRequest()
    val upsert = server.takeRequest()
    val delete = server.takeRequest()
    assertEquals("/api/me/watchlist/event%2F%ED%95%9C", upsert.path)
    assertEquals(
      "{\"channels\":[\"APP_PUSH\"],\"calendarEnabled\":true,\"notificationEnabled\":false}",
      upsert.body.readUtf8(),
    )
    assertEquals("watch-upsert-key", upsert.getHeader("X-Idempotency-Key"))
    assertEquals("DELETE", delete.method)
    assertEquals("/api/me/watchlist/event%2F%ED%95%9C", delete.path)
    assertEquals("watch-delete-key", delete.getHeader("X-Idempotency-Key"))
  }

  @Test
  fun `queue mutations use principal resource paths and stable keys`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(queueJson()))
    server.enqueue(success("""{"id":"queue-1","status":"LEFT"}"""))
    val api = createHttpsApi()

    api.account().enterQueue("performance-1", "queue-enter-key")
    api.account().leaveQueue("queue-1", "queue-leave-key")

    server.takeRequest()
    val enter = server.takeRequest()
    val leave = server.takeRequest()
    assertEquals("/api/me/queue-entries", enter.path)
    assertEquals("{\"performanceDateId\":\"performance-1\"}", enter.body.readUtf8())
    assertEquals("queue-enter-key", enter.getHeader("X-Idempotency-Key"))
    assertEquals("DELETE", leave.method)
    assertEquals("/api/me/queue-entries/queue-1", leave.path)
    assertEquals("queue-leave-key", leave.getHeader("X-Idempotency-Key"))
  }

  @Test
  fun `reservation draft mutations use hold body and draft resource path`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(draftJson()))
    server.enqueue(success(draftJson(status = "CANCELLED")))
    val api = createHttpsApi()

    api.account().createReservationDraft("hold-1", "draft-create-key")
    api.account().cancelReservationDraft("draft-1", "draft-cancel-key")

    server.takeRequest()
    val create = server.takeRequest()
    val cancel = server.takeRequest()
    assertEquals("/api/me/reservation-drafts", create.path)
    assertEquals("{\"holdId\":\"hold-1\"}", create.body.readUtf8())
    assertEquals("draft-create-key", create.getHeader("X-Idempotency-Key"))
    assertEquals("DELETE", cancel.method)
    assertEquals("/api/me/reservation-drafts/draft-1", cancel.path)
    assertEquals("draft-cancel-key", cancel.getHeader("X-Idempotency-Key"))
  }

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
      val client = TicketGroundApiClient.forTesting(server.url("/"), vault)
      val error = assertFails { client.health() }
      assertEquals(expected, error.javaClass)
    }
  }

  @Test
  fun `unknown lifecycle status decodes but remains action ineligible`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(seatHoldJson(status = "FUTURE_STATUS")))
    val hold = TicketGroundApiClient.decodeForTesting<SeatHold>(seatHoldJson(status = "FUTURE_STATUS"))

    assertEquals(LifecycleStatus.UNKNOWN, hold.status)
    assertFalse(hold.canExtend)
    assertFalse(hold.canRelease)
  }

  private fun success(data: String): MockResponse = MockResponse()
    .setHeader("Content-Type", "application/json")
    .setBody("""{"ok":true,"data":$data}""")

  private fun failure(status: Int, code: String): MockResponse = MockResponse()
    .setResponseCode(status)
    .setHeader("Content-Type", "application/json")
    .setBody("""{"ok":false,"error":{"code":"$code","message":"failed"}}""")

  private fun healthWithCapabilities(): String =
    """{"status":"UP","version":"78b3c7c","capabilities":["native-account-v1","native-support-v1","native-watchlist-v1","native-booking-holds-v1"]}"""

  private fun catalogPage(cursor: String): String =
    """{"events":[],"venues":[],"nextCursor":"$cursor","total":0}"""

  private fun seatHoldJson(status: String = "ACTIVE"): String =
    """{"id":"hold-1","status":"$status","performanceDateId":"performance-1","ticketIds":["ticket-1"],"expiresAt":"2026-08-12T12:00:00.000Z","extensionsUsed":0}"""

  private fun sessionJson(name: String): String =
    """{"id":"account-1","name":"$name","status":"ACTIVE","trustScore":90,"profileConfirmed":true}"""

  private fun supportThreadJson(): String =
    """{"id":"thread-1","subject":"문의","status":"OPEN","category":"GENERAL","createdAt":"2026-08-12T00:00:00.000Z","updatedAt":"2026-08-12T00:00:00.000Z","messages":[{"id":"message-1","role":"CUSTOMER","body":"도와주세요","at":"2026-08-12T00:00:00.000Z"}]}"""

  private fun watchlistJson(): String =
    """{"id":"watch-1","eventId":"event/한","channels":["APP_PUSH"],"calendarEnabled":true,"notificationEnabled":false,"notificationJobs":[]}"""

  private fun queueJson(): String =
    """{"id":"queue-1","performanceDateId":"performance-1","status":"ADMITTED","position":0,"admittedAt":"2026-08-12T00:00:00.000Z","admissionExpiresAt":"2026-08-12T00:10:00.000Z","enteredAt":"2026-08-12T00:00:00.000Z"}"""

  private fun draftJson(status: String = "PENDING_PAYMENT"): String =
    """{"id":"draft-1","status":"$status","performanceDateId":"performance-1","ticketIds":["ticket-1"],"amount":{"faceValueTotal":100000,"serviceFee":2000,"total":102000},"expiresAt":"2026-08-12T00:10:00.000Z"}"""

  private suspend fun createHttpsApi(storeCredential: Boolean = true): TicketGroundApiClient {
    val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    server.useHttps(serverCertificates.sslSocketFactory(), false)
    if (storeCredential) vault.store(BearerSession("secret-bearer"))
    return TicketGroundApiClient.forTesting(
      server.url("/"),
      vault,
      OkHttpClient.Builder().sslSocketFactory(
        clientCertificates.sslSocketFactory(),
        clientCertificates.trustManager,
      ).build(),
    )
  }

  private suspend inline fun <reified T : Throwable> assertFailsWith(
    noinline block: suspend () -> Unit,
  ): T {
    val error = assertFails(block)
    assertTrue("Expected ${T::class.java.name}, got ${error.javaClass.name}", error is T)
    return error as T
  }

  private suspend fun assertFails(block: suspend () -> Unit): Throwable = try {
    block()
    throw AssertionError("Expected operation to fail")
  } catch (error: AssertionError) {
    throw error
  } catch (error: Throwable) {
    error
  }
}
