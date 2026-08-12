package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class LifecycleApiWireTest : ApiTestSupport() {
  @Test
  fun `resale and cancellation mutations use owner routes and stable keys`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(resalePoolJson()))
    server.enqueue(success(resalePoolJson(status = "MATCHED")))
    server.enqueue(success(resalePoolJson(status = "CANCELED")))
    server.enqueue(success(cancellationJson()))
    val api = createHttpsApi().lifecycle()

    api.createResalePool("ticket-1", 100_000, "show", "resale-create")
    api.joinResalePool("pool/1", "resale-join")
    api.cancelResalePool("pool/1", "resale-cancel")
    api.createCancellationRequest("ticket-1", "일정 변경", true, "cancel-create")

    server.takeRequest()
    val create = server.takeRequest()
    val join = server.takeRequest()
    val cancel = server.takeRequest()
    val cancellation = server.takeRequest()
    assertEquals("/api/me/resale-pools", create.path)
    assertEquals("{\"ticketId\":\"ticket-1\",\"price\":100000,\"showSlug\":\"show\"}", create.body.readUtf8())
    assertEquals("resale-create", create.getHeader("X-Idempotency-Key"))
    assertEquals("/api/me/resale-pools/pool%2F1/join", join.path)
    assertEquals("resale-join", join.getHeader("X-Idempotency-Key"))
    assertEquals("DELETE", cancel.method)
    assertEquals("resale-cancel", cancel.getHeader("X-Idempotency-Key"))
    assertEquals("/api/me/cancellation-requests", cancellation.path)
    assertEquals("cancel-create", cancellation.getHeader("X-Idempotency-Key"))
    assertFalse(cancellation.body.readUtf8().contains("userId"))
  }

  @Test
  fun `device push and qr operations bind Android proof fields without owner ids`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(sessionJson("계정")))
    server.enqueue(success(challengeJson()))
    server.enqueue(success(pushTokenJson()))
    server.enqueue(success(virtualQrJson()))
    server.enqueue(success(admissionQrJson()))
    val api = createHttpsApi().lifecycle()

    val binding = api.integrityChallenge(IntegrityPurpose.ISSUE_QR, "pixel-1", "ticket-1")
    api.registerPushToken("fcm-secret-token-9876", "push-register")
    api.virtualTicketQr("ticket-1")
    api.admissionQr(
      ticketId = "ticket-1",
      deviceId = "pixel-1",
      deviceToken = "ephemeral-device-token",
      proof = IntegrityProof(binding, "raw-integrity-proof"),
    )

    server.takeRequest()
    server.takeRequest()
    val challenge = server.takeRequest()
    val push = server.takeRequest()
    server.takeRequest()
    val qr = server.takeRequest()
    assertEquals(
      "{\"platform\":\"android\",\"purpose\":\"ISSUE_QR\",\"deviceId\":\"pixel-1\",\"ticketId\":\"ticket-1\"}",
      challenge.body.readUtf8(),
    )
    assertEquals("{\"platform\":\"android\",\"token\":\"fcm-secret-token-9876\"}", push.body.readUtf8())
    val qrBody = qr.body.readUtf8()
    assertEquals("/api/tickets/qr", qr.path)
    assertEquals(true, qrBody.contains("\"challengeId\":\"challenge-1\""))
    assertEquals(true, qrBody.contains("\"integrityToken\":\"raw-integrity-proof\""))
    assertEquals(true, qrBody.contains("\"packageName\":\"kr.ticketground.app.dev\""))
    assertFalse(qrBody.contains("userId"))
  }

  @Test
  fun `device trust refuses to claim biometric verification unless owner authentication succeeded`() = runTest {
    server.start()
    val api = TicketGroundApiClient.forTesting(server.url("/"), vault).lifecycle()
    val binding = IntegrityChallengeBinding(
      "challenge-1", "challenge", "2099-01-01T00:00:00Z", IntegrityPurpose.TRUST_DEVICE,
      "account-1", "pixel-1",
    )

    assertFailsWith<IllegalArgumentException> {
      api.trustDevice("Pixel", biometricVerified = false, proof = IntegrityProof(binding, "proof"))
    }
    assertEquals(0, server.requestCount)
  }

  @Test
  fun `secret-bearing inventory responses are rejected as malformed`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success("[${pushTokenJson().dropLast(1)},\"token\":\"leak\"}]") )
    val api = createHttpsApi().lifecycle()

    assertFailsWith<ApiError.MalformedResponse> { api.pushTokens() }
  }

  @Test
  fun `integrity rejection maps to a non actionable forbidden error`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(failure(403, "PLAY_INTEGRITY_REQUIRED"))
    val api = createHttpsApi().lifecycle()

    val error = assertFailsWith<ApiError.Forbidden> { api.trustedDevices() }

    assertEquals("PLAY_INTEGRITY_REQUIRED", error.code)
  }
}
