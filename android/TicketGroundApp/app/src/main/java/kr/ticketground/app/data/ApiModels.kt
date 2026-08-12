package kr.ticketground.app.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

@Serializable
data class ApiHealth(
  val status: String? = null,
  val time: String? = null,
  val version: String? = null,
  val capabilities: List<String>? = null,
)

@Serializable
data class Catalog(
  val events: List<CatalogEvent>,
  val venues: List<CatalogVenue>? = null,
  val nextCursor: String? = null,
  val total: Int? = null,
)

@Serializable
data class CatalogVenue(
  val id: String,
  val name: String,
  val address: String? = null,
  val mapType: String? = null,
  val imageUrl: String? = null,
)

@Serializable
data class CatalogEvent(
  val id: String,
  val slug: String? = null,
  val category: String? = null,
  val title: String,
  val shortTitle: String? = null,
  val venueId: String? = null,
  val venue: String,
  val date: String? = null,
  val dates: List<CatalogSchedule>? = null,
  val schedules: List<CatalogSchedule>? = null,
  val period: String? = null,
  val runtime: String? = null,
  val ageLimit: String? = null,
  val image: String? = null,
  val badge: String? = null,
  val artistSlug: String? = null,
  val summary: String? = null,
  val casts: List<String>? = null,
  val notices: List<String>? = null,
  val prices: List<CatalogPrice>? = null,
  val saleState: String? = null,
  val saleNote: String? = null,
  val pinnedRank: Int? = null,
  val soldCount: Int,
  val sale: CatalogSale? = null,
)

@Serializable
data class CatalogSchedule(
  val id: String? = null,
  val label: String? = null,
  val date: String? = null,
  val startsAt: String? = null,
  val times: List<String>? = null,
)

@Serializable
data class CatalogPrice(
  val grade: String? = null,
  val seat: String? = null,
  val price: Int? = null,
)

@Serializable
data class CatalogSale(
  val state: String? = null,
  val label: String? = null,
  val note: String? = null,
)

@Serializable
data class RegionsResponse(val version: String, val regions: List<RegionGroup>)

@Serializable
data class RegionGroup(
  val slug: String,
  val name: String,
  val eventCount: Int,
  val events: List<CatalogEvent>,
)

@Serializable
data class ArtistResponse(
  val version: String,
  val artist: ArtistIdentity,
  val events: List<CatalogEvent>,
)

@Serializable
data class ArtistIdentity(val slug: String, val name: String)

@Serializable
data class OpenCalendarResponse(val version: String, val entries: List<OpenCalendarEntry>)

@Serializable
data class OpenCalendarEntry(
  val opensAt: String,
  val saleState: String? = null,
  val event: CatalogEvent,
)

@Serializable
data class PublicSupport(
  val version: String,
  val faqs: List<SupportFaq>,
  val notices: List<SupportNotice>,
)

@Serializable
data class SupportFaq(val id: String, val question: String, val answer: String)

@Serializable
data class SupportNotice(val id: String, val title: String, val body: String)

@Serializable
data class SeatMap(
  val category: String? = null,
  val date: String? = null,
  val event: SeatMapEvent,
  val map: SeatMapDetails,
  val zones: List<SeatMapZone>,
  val seats: List<Seat>,
)

@Serializable
data class SeatMapEvent(val id: String, val title: String, val venueId: String, val venue: String)

@Serializable
data class SeatMapDetails(
  val id: String? = null,
  val venue: String? = null,
  val title: String,
  val image: String,
  val description: String,
)

@Serializable
data class SeatMapZone(val id: String, val name: String, val price: Int, val available: Int)

@Serializable
data class Seat(
  val id: String,
  val label: String,
  val displayCode: String,
  val zoneId: String,
  val zoneName: String,
  val price: Int,
  val status: String,
  val available: Boolean,
  val mapPosition: SeatPosition? = null,
)

@Serializable
data class SeatPosition(
  val x: Double,
  val y: Double,
  val width: Double,
  val height: Double,
  val rotate: Double,
  val shape: String,
)

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

abstract class SafeEnumSerializer<T : Enum<T>>(
  name: String,
  private val values: Map<String, T>,
  private val unknown: T,
) : KSerializer<T> {
  override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor(name, PrimitiveKind.STRING)

  override fun deserialize(decoder: Decoder): T = values[decoder.decodeString()] ?: unknown

  override fun serialize(encoder: Encoder, value: T) {
    encoder.encodeString(value.name)
  }
}
