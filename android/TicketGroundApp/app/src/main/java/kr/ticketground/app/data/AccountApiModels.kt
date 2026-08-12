package kr.ticketground.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AccountSession(
  val id: String,
  val name: String,
  @Serializable(with = SecurityStatusSerializer::class)
  val status: SecurityStatus,
  val trustScore: Int,
  val profileConfirmed: Boolean? = null,
) {
  val isTrusted: Boolean get() = status == SecurityStatus.ACTIVE
}

enum class SecurityStatus { ACTIVE, SUSPENDED, BLOCKED, UNKNOWN }

object SecurityStatusSerializer : SafeEnumSerializer<SecurityStatus>(
  "SecurityStatus",
  SecurityStatus.entries.associateBy(SecurityStatus::name),
  SecurityStatus.UNKNOWN,
)

@Serializable
data class OwnedTicket(
  val id: String,
  val eventId: String,
  val performanceDateId: String,
  val zoneId: String,
  val seatLabel: String,
  val status: String,
  val available: Boolean,
  val faceValue: Int,
  val minPrice: Int,
  val maxPrice: Int,
  val transferCount: Int,
  val maxTransferCount: Int,
  val issuedAt: String? = null,
  @SerialName("virtualQr") val virtualQr: VirtualQr? = null,
  val event: TicketEvent? = null,
  val payment: TicketPayment? = null,
)

@Serializable
data class VirtualQr(val type: String, val issuedAt: String)

@Serializable
data class TicketEvent(
  val id: String,
  val title: String,
  val venue: String? = null,
  val performance: TicketPerformance? = null,
)

@Serializable
data class TicketPerformance(val id: String, val label: String? = null, val startsAt: String)

@Serializable
data class TicketPayment(val amount: Int, val method: String, val status: String)

@Serializable
data class WatchlistItem(
  val id: String,
  val userId: String? = null,
  val eventId: String,
  val channels: List<String>,
  val calendarEnabled: Boolean,
  val notificationEnabled: Boolean,
  val createdAt: String? = null,
  val updatedAt: String? = null,
  val event: WatchlistEvent? = null,
  val notificationJobs: List<NotificationJob>,
)

@Serializable
data class WatchlistEvent(
  val id: String,
  val title: String,
  val venue: String? = null,
  val venueId: String,
  val category: String,
  val saleState: String,
)

@Serializable
data class NotificationJob(
  val id: String,
  val type: String,
  val title: String,
  val status: String,
  val scheduledAt: String,
)

@Serializable
data class WatchlistDeletion(val deleted: Boolean, val eventId: String)

enum class LifecycleStatus {
  WAITING,
  ADMITTED,
  ACTIVE,
  PENDING_PAYMENT,
  EXPIRED,
  LEFT,
  RELEASED,
  CONVERTED,
  CANCELLED,
  CONFIRMED,
  UNKNOWN,
}

object LifecycleStatusSerializer : SafeEnumSerializer<LifecycleStatus>(
  "LifecycleStatus",
  LifecycleStatus.entries.associateBy(LifecycleStatus::name),
  LifecycleStatus.UNKNOWN,
)

@Serializable
data class QueueEntry(
  val id: String,
  val performanceDateId: String,
  @Serializable(with = LifecycleStatusSerializer::class)
  val status: LifecycleStatus,
  val position: Int,
  val admittedAt: String? = null,
  val admissionExpiresAt: String? = null,
  val enteredAt: String,
) {
  val canLeave: Boolean get() = status == LifecycleStatus.WAITING || status == LifecycleStatus.ADMITTED
}

@Serializable
data class QueueLeaveResult(
  val id: String,
  @Serializable(with = LifecycleStatusSerializer::class)
  val status: LifecycleStatus,
)

@Serializable
data class SeatHold(
  val id: String,
  @Serializable(with = LifecycleStatusSerializer::class)
  val status: LifecycleStatus,
  val performanceDateId: String,
  val ticketIds: List<String>,
  val expiresAt: String,
  val extensionsUsed: Int,
) {
  val canExtend: Boolean get() = status == LifecycleStatus.ACTIVE && extensionsUsed < 1
  val canRelease: Boolean get() = status == LifecycleStatus.ACTIVE
}

@Serializable
data class ReservationAmount(val faceValueTotal: Int, val serviceFee: Int, val total: Int)

@Serializable
data class ReservationDraft(
  val id: String,
  @Serializable(with = LifecycleStatusSerializer::class)
  val status: LifecycleStatus,
  val performanceDateId: String,
  val ticketIds: List<String>,
  val amount: ReservationAmount,
  val expiresAt: String,
) {
  val canCancel: Boolean get() = status == LifecycleStatus.PENDING_PAYMENT
}

enum class DisplayStatus { OPEN, ANSWERED, CLOSED, UNKNOWN }

object DisplayStatusSerializer : SafeEnumSerializer<DisplayStatus>(
  "DisplayStatus",
  DisplayStatus.entries.associateBy(DisplayStatus::name),
  DisplayStatus.UNKNOWN,
)

enum class SupportRole { CUSTOMER, ADMIN, UNKNOWN }

object SupportRoleSerializer : SafeEnumSerializer<SupportRole>(
  "SupportRole",
  SupportRole.entries.associateBy(SupportRole::name),
  SupportRole.UNKNOWN,
)

@Serializable
data class SupportThread(
  val id: String,
  val subject: String,
  @Serializable(with = DisplayStatusSerializer::class)
  val status: DisplayStatus,
  val category: String? = null,
  val createdAt: String? = null,
  val updatedAt: String,
  val messages: List<SupportMessage>,
)

@Serializable
data class SupportMessage(
  val id: String,
  @Serializable(with = SupportRoleSerializer::class)
  val role: SupportRole,
  val body: String,
  val at: String,
)
