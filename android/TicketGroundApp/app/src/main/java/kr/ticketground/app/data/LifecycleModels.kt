package kr.ticketground.app.data

import kotlinx.serialization.Serializable

enum class ResalePoolStatus { OPEN, MATCHED, CANCELED, UNKNOWN }
object ResalePoolStatusSerializer : SafeEnumSerializer<ResalePoolStatus>(
  "ResalePoolStatus", ResalePoolStatus.entries.associateBy(ResalePoolStatus::name), ResalePoolStatus.UNKNOWN,
)

@Serializable
data class ResalePool(
  val id: String, val eventId: String, val performanceDateId: String, val zoneId: String,
  val ticketId: String, val showSlug: String? = null, val price: Int, val buyerFee: Int? = null,
  val buyerTotal: Int? = null, val sellerSettlement: Int? = null, val buyerCount: Int,
  @Serializable(with = ResalePoolStatusSerializer::class) val status: ResalePoolStatus,
  val createdAt: String, val matchedAt: String? = null,
)

enum class CancellationStatus { PENDING_REVIEW, UNKNOWN }
object CancellationStatusSerializer : SafeEnumSerializer<CancellationStatus>(
  "CancellationStatus", CancellationStatus.entries.associateBy(CancellationStatus::name), CancellationStatus.UNKNOWN,
)

@Serializable
data class CancellationRequest(
  val id: String, val ticketId: String, val reason: String, val refundAcknowledged: Boolean,
  @Serializable(with = CancellationStatusSerializer::class) val status: CancellationStatus,
  val createdAt: String, val updatedAt: String,
)

enum class TrustedDeviceStatus { TRUSTED, REVOKED, UNKNOWN }
object TrustedDeviceStatusSerializer : SafeEnumSerializer<TrustedDeviceStatus>(
  "TrustedDeviceStatus", TrustedDeviceStatus.entries.associateBy(TrustedDeviceStatus::name), TrustedDeviceStatus.UNKNOWN,
)

@Serializable
data class TrustedDevice(
  val id: String, val deviceId: String, val deviceName: String, val platform: String,
  @Serializable(with = TrustedDeviceStatusSerializer::class) val status: TrustedDeviceStatus,
  val createdAt: String, val lastVerifiedAt: String, val revokedAt: String? = null,
  private val tokenHash: String? = null, private val deviceToken: String? = null,
) {
  init { require(tokenHash == null && deviceToken == null) { "Trusted device inventory contained a secret" } }
}

enum class PushTokenStatus { ACTIVE, UNKNOWN }
object PushTokenStatusSerializer : SafeEnumSerializer<PushTokenStatus>(
  "PushTokenStatus", PushTokenStatus.entries.associateBy(PushTokenStatus::name), PushTokenStatus.UNKNOWN,
)

@Serializable
data class PushToken(
  val platform: String,
  @Serializable(with = PushTokenStatusSerializer::class) val status: PushTokenStatus,
  val suffix: String, val createdAt: String, val updatedAt: String,
  private val token: String? = null, private val tokenDigest: String? = null,
) {
  init { require(token == null && tokenDigest == null) { "Push inventory contained a secret" } }
}

enum class IntegrityPurpose { TRUST_DEVICE, ISSUE_QR }

@Serializable
internal data class IntegrityChallengeResponse(
  val id: String, val platform: String, val challenge: String, val expiresAt: String,
)

data class IntegrityChallengeBinding(
  val id: String, val challenge: String, val expiresAt: String, val purpose: IntegrityPurpose,
  val principalId: String, val deviceId: String, val ticketId: String? = null,
)

data class IntegrityProof(val binding: IntegrityChallengeBinding, val token: String)

@Serializable
data class DeviceTrustResult(val device: TrustedDeviceRegistration, val deviceToken: String)

@Serializable
data class TrustedDeviceRegistration(
  val id: String, val deviceId: String, val deviceName: String, val platform: String,
  @Serializable(with = TrustedDeviceStatusSerializer::class) val status: TrustedDeviceStatus,
  val lastVerifiedAt: String,
)

@Serializable
data class VirtualTicketQr(
  val type: String, val ticketId: String, val issuedAt: String, val eventTitle: String, val seatLabel: String,
  val performanceStartsAt: String, val qrPreparedAt: String, val realQrAvailableAt: String,
  val admissionCredentialStatus: String, val admissionChannel: String,
)

@Serializable
data class AdmissionQr(
  val type: String, val ticketId: String, val ownerId: String, val expiresAt: String, val nonce: String,
  val signature: String, val issuedAt: String, val performanceStartsAt: String, val preparedAt: String,
  val activeAt: String, val ttlSeconds: Int, val traceCode: String, val channel: String,
  val emergencyReason: String? = null,
)
