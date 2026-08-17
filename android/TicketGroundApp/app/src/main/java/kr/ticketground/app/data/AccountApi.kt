package kr.ticketground.app.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.encodeToString

interface BookingApi {
  suspend fun enterQueue(performanceDateId: String, idempotencyKey: String): QueueEntry
  suspend fun createSeatHold(performanceDateId: String, ticketIds: List<String>, idempotencyKey: String): SeatHold
  suspend fun releaseSeatHold(holdId: String, idempotencyKey: String): SeatHold
  suspend fun createReservationDraft(holdId: String, idempotencyKey: String): ReservationDraft
  suspend fun cancelReservationDraft(draftId: String, idempotencyKey: String): ReservationDraft
}

class AccountApi internal constructor(private val client: TicketGroundApiClient) : BookingApi {
  suspend fun session(): AccountSession = read("/api/me", AccountSession.serializer(), ACCOUNT)
  suspend fun profile(): AccountSession = read("/api/me/profile", AccountSession.serializer(), ACCOUNT)

  suspend fun updateProfile(name: String, idempotencyKey: String): AccountSession {
    require(name.isNotBlank())
    return mutation("PATCH", "/api/me/profile", ProfileBody(name), idempotencyKey, AccountSession.serializer(), ACCOUNT)
  }

  suspend fun tickets(): List<OwnedTicket> = read("/api/me/tickets", ListSerializer(OwnedTicket.serializer()), ACCOUNT)
  suspend fun supportThreads(): List<SupportThread> =
    read("/api/me/support/threads", ListSerializer(SupportThread.serializer()), SUPPORT)

  suspend fun createSupportThread(subject: String, message: String, idempotencyKey: String): SupportThread = mutation(
    "POST", "/api/me/support/threads", SupportThreadBody(subject, message), idempotencyKey,
    SupportThread.serializer(), SUPPORT,
  )

  suspend fun addSupportMessage(threadId: String, message: String, idempotencyKey: String): SupportThread = mutation(
    "POST", "/api/me/support/messages", SupportMessageBody(threadId, message), idempotencyKey,
    SupportThread.serializer(), SUPPORT,
  )

  suspend fun watchlist(): List<WatchlistItem> =
    read("/api/me/watchlist", ListSerializer(WatchlistItem.serializer()), WATCHLIST)

  suspend fun upsertWatchlist(
    eventId: String,
    channels: List<String>,
    calendarEnabled: Boolean,
    notificationEnabled: Boolean,
    idempotencyKey: String,
  ): WatchlistItem = mutation(
    "PUT", "/api/me/watchlist/${pathSegment(eventId)}",
    WatchlistPreferences(channels, calendarEnabled, notificationEnabled), idempotencyKey,
    WatchlistItem.serializer(), WATCHLIST,
  )

  suspend fun deleteWatchlist(eventId: String, idempotencyKey: String): WatchlistDeletion = mutationWithoutBody(
    "DELETE", "/api/me/watchlist/${pathSegment(eventId)}", idempotencyKey,
    WatchlistDeletion.serializer(), WATCHLIST,
  )

  override suspend fun enterQueue(performanceDateId: String, idempotencyKey: String): QueueEntry = mutation(
    "POST", "/api/me/queue-entries", QueueEntryBody(performanceDateId), idempotencyKey,
    QueueEntry.serializer(), BOOKING,
  )

  suspend fun queueEntry(entryId: String): QueueEntry =
    read("/api/me/queue-entries/${pathSegment(entryId)}", QueueEntry.serializer(), BOOKING)

  suspend fun leaveQueue(entryId: String, idempotencyKey: String): QueueLeaveResult = mutationWithoutBody(
    "DELETE", "/api/me/queue-entries/${pathSegment(entryId)}", idempotencyKey,
    QueueLeaveResult.serializer(), BOOKING,
  )

  override suspend fun createSeatHold(
    performanceDateId: String,
    ticketIds: List<String>,
    idempotencyKey: String,
  ): SeatHold = mutation(
    "POST", "/api/me/seat-holds", SeatHoldBody(performanceDateId, ticketIds), idempotencyKey,
    SeatHold.serializer(), BOOKING,
  )

  suspend fun seatHold(holdId: String): SeatHold =
    read("/api/me/seat-holds/${pathSegment(holdId)}", SeatHold.serializer(), BOOKING)

  suspend fun extendSeatHold(holdId: String, idempotencyKey: String): SeatHold = mutationWithoutBody(
    "PATCH", "/api/me/seat-holds/${pathSegment(holdId)}/extend", idempotencyKey,
    SeatHold.serializer(), BOOKING,
  )

  override suspend fun releaseSeatHold(holdId: String, idempotencyKey: String): SeatHold = mutationWithoutBody(
    "DELETE", "/api/me/seat-holds/${pathSegment(holdId)}", idempotencyKey,
    SeatHold.serializer(), BOOKING,
  )

  override suspend fun createReservationDraft(holdId: String, idempotencyKey: String): ReservationDraft = mutation(
    "POST", "/api/me/reservation-drafts", ReservationDraftBody(holdId), idempotencyKey,
    ReservationDraft.serializer(), BOOKING,
  )

  suspend fun reservationDraft(draftId: String): ReservationDraft =
    read("/api/me/reservation-drafts/${pathSegment(draftId)}", ReservationDraft.serializer(), BOOKING)

  override suspend fun cancelReservationDraft(draftId: String, idempotencyKey: String): ReservationDraft = mutationWithoutBody(
    "DELETE", "/api/me/reservation-drafts/${pathSegment(draftId)}", idempotencyKey,
    ReservationDraft.serializer(), BOOKING,
  )

  private suspend fun <T> read(path: String, serializer: KSerializer<T>, capability: String): T {
    client.requireAccountPrerequisites()
    client.requireContract(capability)
    return client.execute(ApiRequest(path = path, authenticated = true), serializer)
  }

  private suspend inline fun <reified B, T> mutation(
    method: String,
    path: String,
    body: B,
    idempotencyKey: String,
    serializer: KSerializer<T>,
    capability: String,
  ): T {
    require(idempotencyKey.isNotBlank())
    client.requireAccountPrerequisites()
    client.requireContract(capability)
    return client.execute(
      ApiRequest(
        method = method,
        path = path,
        body = TicketGroundApiClient.JSON.encodeToString(body),
        idempotencyKey = idempotencyKey,
        authenticated = true,
      ),
      serializer,
    )
  }

  private suspend fun <T> mutationWithoutBody(
    method: String,
    path: String,
    idempotencyKey: String,
    serializer: KSerializer<T>,
    capability: String,
  ): T {
    require(idempotencyKey.isNotBlank())
    client.requireAccountPrerequisites()
    client.requireContract(capability)
    return client.execute(
      ApiRequest(method, path, idempotencyKey = idempotencyKey, authenticated = true), serializer,
    )
  }

  private companion object {
    const val ACCOUNT = "native-account-v1"
    const val SUPPORT = "native-support-v1"
    const val WATCHLIST = "native-watchlist-v1"
    const val BOOKING = "native-booking-holds-v1"
  }
}

@Serializable
private data class SupportThreadBody(val subject: String, val message: String)

@Serializable
private data class ProfileBody(val name: String)

@Serializable
private data class SupportMessageBody(val threadId: String, val message: String)

@Serializable
private data class WatchlistPreferences(
  val channels: List<String>,
  val calendarEnabled: Boolean,
  val notificationEnabled: Boolean,
)

@Serializable
private data class QueueEntryBody(val performanceDateId: String)

@Serializable
private data class SeatHoldBody(val performanceDateId: String, val ticketIds: List<String>)

@Serializable
private data class ReservationDraftBody(val holdId: String)
