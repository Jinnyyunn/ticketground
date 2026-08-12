package kr.ticketground.app.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString
import kr.ticketground.app.BuildConfig

class LifecycleApi internal constructor(private val client: TicketGroundApiClient) {
  suspend fun resalePools(): List<ResalePool> = read("/api/me/resale-pools", ListSerializer(ResalePool.serializer()))

  suspend fun createResalePool(
    ticketId: String, price: Int, showSlug: String?, idempotencyKey: String,
  ): ResalePool = mutate(
    "POST", "/api/me/resale-pools", ResaleBody(ticketId, price, showSlug), idempotencyKey, ResalePool.serializer(),
  )

  suspend fun joinResalePool(poolId: String, idempotencyKey: String): ResalePool = mutate(
    "POST", "/api/me/resale-pools/${pathSegment(poolId)}/join", EmptyBody, idempotencyKey, ResalePool.serializer(),
  )

  suspend fun cancelResalePool(poolId: String, idempotencyKey: String): ResalePool = noBody(
    "DELETE", "/api/me/resale-pools/${pathSegment(poolId)}", idempotencyKey, ResalePool.serializer(),
  )

  suspend fun cancellationRequests(): List<CancellationRequest> = read(
    "/api/me/cancellation-requests", ListSerializer(CancellationRequest.serializer()),
  )

  suspend fun createCancellationRequest(
    ticketId: String, reason: String, refundAcknowledged: Boolean, idempotencyKey: String,
  ): CancellationRequest {
    require(reason.isNotBlank() && refundAcknowledged)
    return mutate(
      "POST", "/api/me/cancellation-requests", CancellationBody(ticketId, reason, true), idempotencyKey,
      CancellationRequest.serializer(),
    )
  }

  suspend fun trustedDevices(): List<TrustedDevice> = read(
    "/api/me/devices", ListSerializer(TrustedDevice.serializer()),
  )

  suspend fun revokeTrustedDevice(deviceId: String): TrustedDevice = requestWithoutBody(
    "DELETE", "/api/me/devices/${pathSegment(deviceId)}", TrustedDevice.serializer(),
  )

  suspend fun pushTokens(): List<PushToken> = read("/api/me/push-tokens", ListSerializer(PushToken.serializer()))

  suspend fun registerPushToken(token: String, idempotencyKey: String): PushToken {
    require(token.isNotBlank())
    return mutate(
      "POST", "/api/me/push-tokens", PushBody("android", token), idempotencyKey, PushToken.serializer(),
    )
  }

  suspend fun integrityChallenge(
    purpose: IntegrityPurpose, deviceId: String, ticketId: String? = null,
  ): IntegrityChallengeBinding {
    require(deviceId.isNotBlank())
    require(purpose != IntegrityPurpose.ISSUE_QR || !ticketId.isNullOrBlank())
    val principal = client.account().session()
    val response = request(
      "POST", "/api/me/device-attestation/challenges", ChallengeBody("android", purpose, deviceId, ticketId),
      IntegrityChallengeResponse.serializer(),
    )
    if (response.platform != "android") throw ApiError.MalformedResponse()
    return IntegrityChallengeBinding(
      response.id, response.challenge, response.expiresAt, purpose, principal.id, deviceId, ticketId,
    )
  }

  suspend fun trustDevice(
    deviceName: String, biometricVerified: Boolean, proof: IntegrityProof,
  ): DeviceTrustResult {
    val binding = proof.binding
    require(binding.purpose == IntegrityPurpose.TRUST_DEVICE && proof.token.isNotBlank() && biometricVerified)
    return request(
      "POST", "/api/devices/trust",
      TrustBody(
        "android", BuildConfig.APPLICATION_ID, binding.deviceId, deviceName, true, binding.id, proof.token,
      ),
      DeviceTrustResult.serializer(),
    )
  }

  suspend fun virtualTicketQr(ticketId: String): VirtualTicketQr = request(
    "POST", "/api/tickets/virtual-qr", TicketBody(ticketId), VirtualTicketQr.serializer(),
  )

  suspend fun admissionQr(
    ticketId: String, deviceId: String, deviceToken: String, proof: IntegrityProof,
  ): AdmissionQr {
    val binding = proof.binding
    require(
      binding.purpose == IntegrityPurpose.ISSUE_QR && binding.ticketId == ticketId &&
        binding.deviceId == deviceId && deviceToken.isNotBlank() && proof.token.isNotBlank(),
    )
    return request(
      "POST", "/api/tickets/qr",
      AdmissionBody(
        ticketId, "APP", "android", BuildConfig.APPLICATION_ID, deviceId, deviceToken, binding.id, proof.token,
      ),
      AdmissionQr.serializer(),
    )
  }

  private suspend fun <T> read(path: String, serializer: KSerializer<T>): T {
    client.requireAccountPrerequisites()
    client.requireContract(CAPABILITY)
    return client.execute(ApiRequest(path = path, authenticated = true), serializer)
  }

  private suspend inline fun <reified B, T> mutate(
    method: String, path: String, body: B, key: String, serializer: KSerializer<T>,
  ): T {
    require(key.isNotBlank())
    return request(method, path, body, serializer, key)
  }

  private suspend fun <T> noBody(method: String, path: String, key: String, serializer: KSerializer<T>): T {
    require(key.isNotBlank())
    client.requireAccountPrerequisites()
    client.requireContract(CAPABILITY)
    return client.execute(ApiRequest(method, path, idempotencyKey = key, authenticated = true), serializer)
  }

  private suspend fun <T> requestWithoutBody(method: String, path: String, serializer: KSerializer<T>): T {
    client.requireAccountPrerequisites()
    client.requireContract(CAPABILITY)
    return client.execute(ApiRequest(method, path, authenticated = true), serializer)
  }

  private suspend inline fun <reified B, T> request(
    method: String, path: String, body: B, serializer: KSerializer<T>, key: String? = null,
  ): T {
    client.requireAccountPrerequisites()
    client.requireContract(CAPABILITY)
    return client.execute(
      ApiRequest(
        method, path, body = TicketGroundApiClient.JSON.encodeToString(body),
        idempotencyKey = key, authenticated = true,
      ),
      serializer,
    )
  }

  private companion object { const val CAPABILITY = "native-lifecycle-v1" }
}

@Serializable private data class ResaleBody(val ticketId: String, val price: Int, val showSlug: String?)
@Serializable private data class CancellationBody(val ticketId: String, val reason: String, val refundAcknowledged: Boolean)
@Serializable private data class PushBody(val platform: String, val token: String)
@Serializable private data class ChallengeBody(
  val platform: String, val purpose: IntegrityPurpose, val deviceId: String, val ticketId: String?,
)
@Serializable private data class TrustBody(
  val platform: String, val packageName: String, val deviceId: String, val deviceName: String,
  val biometricVerified: Boolean,
  val challengeId: String, val integrityToken: String,
)
@Serializable private data class TicketBody(val ticketId: String)
@Serializable private data class AdmissionBody(
  val ticketId: String, val channel: String, val platform: String, val packageName: String,
  val deviceId: String, val deviceToken: String,
  val challengeId: String, val integrityToken: String,
)
@Serializable private data object EmptyBody
