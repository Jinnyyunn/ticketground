package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.tls.HandshakeCertificates
import okhttp3.tls.HeldCertificate
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import kr.ticketground.app.foundation.BearerSession
import kr.ticketground.app.foundation.InMemorySessionVault

abstract class ApiTestSupport {
  protected lateinit var server: MockWebServer
  protected lateinit var vault: InMemorySessionVault

  @Before
  fun setUpApiTest() {
    server = MockWebServer()
    vault = InMemorySessionVault()
  }

  @After
  fun tearDownApiTest() {
    server.close()
  }

  protected fun success(data: String): MockResponse = MockResponse()
    .setHeader("Content-Type", "application/json")
    .setBody("""{"ok":true,"data":$data}""")

  protected fun failure(status: Int, code: String): MockResponse = MockResponse()
    .setResponseCode(status)
    .setHeader("Content-Type", "application/json")
    .setBody("""{"ok":false,"error":{"code":"$code","message":"failed"}}""")

  protected fun healthWithCapabilities(): String =
    """{"status":"UP","version":"78b3c7c","capabilities":["native-account-v1","native-support-v1","native-watchlist-v1","native-booking-holds-v1","native-lifecycle-v1"]}"""

  protected fun catalogPage(cursor: String): String =
    """{"events":[],"venues":[],"nextCursor":"$cursor","total":0}"""

  protected fun seatHoldJson(status: String = "ACTIVE"): String =
    """{"id":"hold-1","status":"$status","performanceDateId":"performance-1","ticketIds":["ticket-1"],"expiresAt":"2026-08-12T12:00:00.000Z","extensionsUsed":0}"""

  protected fun sessionJson(name: String): String =
    """{"id":"account-1","name":"$name","status":"ACTIVE","trustScore":90,"profileConfirmed":true}"""

  protected fun supportThreadJson(): String =
    """{"id":"thread-1","subject":"문의","status":"OPEN","category":"GENERAL","createdAt":"2026-08-12T00:00:00.000Z","updatedAt":"2026-08-12T00:00:00.000Z","messages":[{"id":"message-1","role":"CUSTOMER","body":"도와주세요","at":"2026-08-12T00:00:00.000Z"}]}"""

  protected fun watchlistJson(): String =
    """{"id":"watch-1","eventId":"event/한","channels":["APP_PUSH"],"calendarEnabled":true,"notificationEnabled":false,"notificationJobs":[]}"""

  protected fun queueJson(): String =
    """{"id":"queue-1","performanceDateId":"performance-1","status":"ADMITTED","position":0,"admittedAt":"2026-08-12T00:00:00.000Z","admissionExpiresAt":"2026-08-12T00:10:00.000Z","enteredAt":"2026-08-12T00:00:00.000Z"}"""

  protected fun draftJson(status: String = "PENDING_PAYMENT"): String =
    """{"id":"draft-1","status":"$status","performanceDateId":"performance-1","ticketIds":["ticket-1"],"amount":{"faceValueTotal":100000,"serviceFee":2000,"total":102000},"expiresAt":"2026-08-12T00:10:00.000Z"}"""

  protected fun resalePoolJson(status: String = "OPEN"): String =
    """{"id":"pool-1","eventId":"event-1","performanceDateId":"date-1","zoneId":"zone-1","ticketId":"ticket-1","showSlug":"show","price":100000,"buyerFee":8000,"buyerTotal":108000,"sellerSettlement":92000,"buyerCount":0,"status":"$status","createdAt":"2026-08-12T00:00:00Z","matchedAt":null}"""

  protected fun cancellationJson(): String =
    """{"id":"cancel-1","ticketId":"ticket-1","reason":"일정 변경","refundAcknowledged":true,"status":"PENDING_REVIEW","createdAt":"2026-08-12T00:00:00Z","updatedAt":"2026-08-12T00:00:00Z"}"""

  protected fun challengeJson(): String =
    """{"id":"challenge-1","platform":"android","challenge":"bm9uY2U=","expiresAt":"2099-01-01T00:00:00Z"}"""

  protected fun pushTokenJson(): String =
    """{"platform":"android","status":"ACTIVE","suffix":"9876","createdAt":"2026-08-12T00:00:00Z","updatedAt":"2026-08-12T00:00:00Z"}"""

  protected fun virtualQrJson(): String =
    """{"type":"VIRTUAL","ticketId":"ticket-1","issuedAt":"2026-08-12T00:00:00Z","eventTitle":"공연","seatLabel":"A1","performanceStartsAt":"2026-08-13T12:00:00Z","qrPreparedAt":"2026-08-12T00:00:00Z","realQrAvailableAt":"2026-08-13T09:00:00Z","admissionCredentialStatus":"READY","admissionChannel":"APP"}"""

  protected fun admissionQrJson(): String =
    """{"type":"ADMISSION","ticketId":"ticket-1","ownerId":"account-1","expiresAt":"2026-08-12T00:00:20Z","nonce":"nonce","signature":"signature","issuedAt":"2026-08-12T00:00:00Z","performanceStartsAt":"2026-08-13T12:00:00Z","preparedAt":"2026-08-12T00:00:00Z","activeAt":"2026-08-13T09:00:00Z","ttlSeconds":20,"traceCode":"TRACE","channel":"APP","emergencyReason":null}"""

  protected suspend fun createHttpsApi(storeCredential: Boolean = true): TicketGroundApiClient {
    val certificate = HeldCertificate.Builder().addSubjectAlternativeName("localhost").build()
    val serverCertificates = HandshakeCertificates.Builder().heldCertificate(certificate).build()
    val clientCertificates = HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate).build()
    server.useHttps(serverCertificates.sslSocketFactory(), false)
    if (storeCredential) vault.store(BearerSession("secret-bearer"))
    return TicketGroundApiClient.forTesting(
      server.url("/"),
      vault,
      OkHttpClient.Builder().sslSocketFactory(
        clientCertificates.sslSocketFactory(), clientCertificates.trustManager,
      ).build(),
    )
  }

  protected suspend inline fun <reified T : Throwable> assertFailsWith(
    noinline block: suspend () -> Unit,
  ): T {
    val error = assertFails(block)
    assertTrue("Expected ${T::class.java.name}, got ${error.javaClass.name}", error is T)
    return error as T
  }

  protected suspend fun assertFails(block: suspend () -> Unit): Throwable = try {
    block()
    throw AssertionError("Expected operation to fail")
  } catch (error: AssertionError) {
    throw error
  } catch (error: Throwable) {
    error
  }
}
