package kr.ticketground.app.data

import java.time.Instant
import kr.ticketground.app.BuildConfig

sealed class ExternalProviderError(message: String) : Exception(message) {
  data object PlayIntegrityUnavailable : ExternalProviderError("Play Integrity is not configured")
  data object PushUnavailable : ExternalProviderError("FCM is not configured")
  data object TossUnavailable : ExternalProviderError("Toss Payments is not configured")
  data object DeviceTrustRequired : ExternalProviderError("Trusted device registration is required")
  data object InvalidChallenge : ExternalProviderError("Integrity challenge is invalid or expired")
}

fun interface PlayIntegrityTokenRequester {
  suspend fun request(projectNumber: Long, binding: IntegrityChallengeBinding): String
}

class PlayIntegrityProofProvider(
  private val cloudProjectNumber: Long?,
  private val requester: PlayIntegrityTokenRequester,
  private val now: () -> Instant = Instant::now,
) {
  suspend fun prove(binding: IntegrityChallengeBinding): IntegrityProof {
    val projectNumber = cloudProjectNumber?.takeIf { it > 0 }
      ?: throw ExternalProviderError.PlayIntegrityUnavailable
    val expiry = runCatching { Instant.parse(binding.expiresAt) }.getOrNull()
      ?: throw ExternalProviderError.InvalidChallenge
    if (!expiry.isAfter(now())) throw ExternalProviderError.InvalidChallenge
    val token = requester.request(projectNumber, binding).takeIf(String::isNotBlank)
      ?: throw ExternalProviderError.PlayIntegrityUnavailable
    return IntegrityProof(binding, token)
  }
}

fun interface FirebaseTokenSource { suspend fun fetch(): String }

interface DeviceTokenStore {
  fun read(): String?
  fun write(value: String)
}

class InMemoryDeviceTokenStore : DeviceTokenStore {
  private var value: String? = null
  override fun read(): String? = value
  override fun write(value: String) { this.value = value }
}

class FirebasePushRegistrationProvider(
  private val configured: Boolean? = null,
  private val source: FirebaseTokenSource,
) {
  suspend fun token(): String {
    if (configured == false) throw ExternalProviderError.PushUnavailable
    return runCatching { source.fetch() }.getOrNull()?.takeIf(String::isNotBlank)
      ?: throw ExternalProviderError.PushUnavailable
  }
}

object PlatformProviderFactory {
  fun playIntegrity(requester: PlayIntegrityTokenRequester): PlayIntegrityProofProvider =
    PlayIntegrityProofProvider(BuildConfig.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER.toLongOrNull(), requester)

  fun push(source: FirebaseTokenSource): FirebasePushRegistrationProvider =
    FirebasePushRegistrationProvider(source = source)
}
