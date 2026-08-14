package kr.ticketground.app.data

import java.time.Instant
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class PlatformBoundaryTest {
  private val binding = IntegrityChallengeBinding(
    id = "challenge-1",
    challenge = "bm9uY2U=",
    expiresAt = "2099-01-01T00:00:00Z",
    purpose = IntegrityPurpose.ISSUE_QR,
    principalId = "account-1",
    deviceId = "pixel-1",
    ticketId = "ticket-1",
  )

  @Test
  fun `production Play Integrity provider fails closed when project configuration is absent`() = runTest {
    val requester = RecordingIntegrityRequester("proof")
    val provider = PlayIntegrityProofProvider(null, requester) { Instant.parse("2026-08-12T00:00:00Z") }

    val error = assertFails { provider.prove(binding) }

    assertEquals(ExternalProviderError.PlayIntegrityUnavailable, error)
    assertEquals(0, requester.calls)
  }

  @Test
  fun `Play Integrity proof preserves every server binding and rejects expired challenge`() = runTest {
    val requester = RecordingIntegrityRequester("proof")
    val provider = PlayIntegrityProofProvider(123L, requester) { Instant.parse("2026-08-12T00:00:00Z") }
    assertEquals(IntegrityProof(binding, "proof"), provider.prove(binding))
    assertEquals(binding, requester.lastBinding)

    val expired = binding.copy(expiresAt = "2026-08-11T23:59:59Z")
    assertEquals(ExternalProviderError.InvalidChallenge, assertFails { provider.prove(expired) })
    assertEquals(1, requester.calls)
  }

  @Test
  fun `production FCM provider fails closed when unconfigured or token is blank`() = runTest {
    val source = RecordingPushTokenSource("")
    assertEquals(
      ExternalProviderError.PushUnavailable,
      assertFails { FirebasePushRegistrationProvider(false, source).token() },
    )
    assertEquals(0, source.calls)
    assertEquals(
      ExternalProviderError.PushUnavailable,
      assertFails { FirebasePushRegistrationProvider(true, source).token() },
    )
  }

  private suspend fun assertFails(block: suspend () -> Unit): Throwable = try {
    block()
    throw AssertionError("Expected failure")
  } catch (error: AssertionError) {
    throw error
  } catch (error: Throwable) {
    error
  }
}

private class RecordingIntegrityRequester(private val token: String) : PlayIntegrityTokenRequester {
  var calls = 0
  var lastBinding: IntegrityChallengeBinding? = null
  override suspend fun request(projectNumber: Long, binding: IntegrityChallengeBinding): String {
    calls += 1
    lastBinding = binding
    return token
  }
}

private class RecordingPushTokenSource(private val value: String) : FirebaseTokenSource {
  var calls = 0
  override suspend fun fetch(): String {
    calls += 1
    return value
  }
}
