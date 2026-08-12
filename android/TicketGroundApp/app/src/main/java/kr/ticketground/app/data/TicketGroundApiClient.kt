package kr.ticketground.app.data

import java.io.IOException
import java.net.URLEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import kr.ticketground.app.BuildConfig
import kr.ticketground.app.foundation.ApiBaseUrl
import kr.ticketground.app.foundation.SessionVault

sealed class ApiError(message: String, cause: Throwable? = null) : Exception(message, cause) {
  class Transport(cause: Throwable) : ApiError("API transport failed", cause)
  class MalformedResponse : ApiError("Malformed API response")
  class MissingCredential : ApiError("Bearer credential is required")
  class InsecureOrigin : ApiError("Bearer credentials require the configured HTTPS origin")
  class IncompatibleContract(val expected: String, val observed: String?) :
    ApiError("Incompatible API contract")
  class Unauthorized(val code: String, message: String) : ApiError(message)
  class Forbidden(val code: String, message: String) : ApiError(message)
  class NotFound(val code: String, message: String) : ApiError(message)
  class Conflict(
    val code: String,
    message: String,
    val idempotencyConflict: Boolean,
  ) : ApiError(message)
  class Retryable(val status: Int, val code: String, message: String) : ApiError(message)
  class Server(val status: Int, val code: String, message: String) : ApiError(message)
}

class TicketGroundApiClient private constructor(
  private val baseUrl: HttpUrl,
  private val sessionVault: SessionVault,
  suppliedHttpClient: OkHttpClient,
) {
  private val httpClient = suppliedHttpClient.newBuilder()
    .followRedirects(false)
    .followSslRedirects(false)
    .build()
  private val publicApi = PublicApi(this)
  private val accountApi = AccountApi(this)
  private var compatibleHealth: ApiHealth? = null

  fun public(): PublicApi = publicApi

  fun account(): AccountApi = accountApi

  suspend fun health(): ApiHealth = execute(ApiRequest(path = "/api/health"), ApiHealth.serializer())

  internal suspend fun requireContract(capability: String? = null) {
    val health = compatibleHealth ?: health().also {
      if (it.version != API_VERSION) {
        throw ApiError.IncompatibleContract(API_VERSION, it.version)
      }
      compatibleHealth = it
    }
    if (capability != null && health.capabilities?.contains(capability) != true) {
      throw ApiError.IncompatibleContract(capability, health.capabilities?.joinToString(","))
    }
  }

  internal suspend fun requireAccountPrerequisites() {
    if (!baseUrl.isHttps) throw ApiError.InsecureOrigin()
    if (sessionVault.read()?.accessToken.isNullOrBlank()) throw ApiError.MissingCredential()
  }

  internal suspend fun <T> execute(request: ApiRequest, serializer: KSerializer<T>): T {
    val httpRequest = buildRequest(request)
    val responseBody = try {
      withContext(Dispatchers.IO) {
        httpClient.newCall(httpRequest).execute().use { response ->
          val body = response.body.string()
          if (!response.isSuccessful) throw mapFailure(response.code, body)
          body
        }
      }
    } catch (error: ApiError) {
      throw error
    } catch (error: IOException) {
      throw ApiError.Transport(error)
    }
    return decodeEnvelope(responseBody, serializer)
  }

  private suspend fun buildRequest(apiRequest: ApiRequest): Request {
    require(apiRequest.path.startsWith("/") && !apiRequest.path.startsWith("//"))
    val urlBuilder = baseUrl.newBuilder().encodedPath(apiRequest.path)
    apiRequest.query.forEach { (name, value) -> urlBuilder.addQueryParameter(name, value) }
    val url = urlBuilder.build()
    if (url.scheme != baseUrl.scheme || url.host != baseUrl.host || url.port != baseUrl.port) {
      throw ApiError.InsecureOrigin()
    }
    val builder = Request.Builder()
      .url(url)
      .header("Accept", "application/json")
    val body = apiRequest.body?.toRequestBody(JSON_MEDIA_TYPE)
      ?: if (apiRequest.method in METHODS_REQUIRING_BODY) ByteArray(0).toRequestBody(null) else null
    builder.method(apiRequest.method, body)
    if (body != null) builder.header("Content-Type", "application/json")
    apiRequest.idempotencyKey?.let { key ->
      require(key.isNotBlank())
      builder.header("X-Idempotency-Key", key)
    }
    if (apiRequest.authenticated) {
      if (!baseUrl.isHttps) throw ApiError.InsecureOrigin()
      val token = sessionVault.read()?.accessToken?.takeIf(String::isNotBlank)
        ?: throw ApiError.MissingCredential()
      builder.header("Authorization", "Bearer $token")
    }
    return builder.build()
  }

  private fun <T> decodeEnvelope(body: String, serializer: KSerializer<T>): T {
    val objectValue = try {
      JSON.parseToJsonElement(body).jsonObject
    } catch (_: Exception) {
      throw ApiError.MalformedResponse()
    }
    val ok = objectValue["ok"]?.jsonPrimitive?.booleanOrNull ?: throw ApiError.MalformedResponse()
    if (!ok) throw mapFailure(200, body)
    val data = objectValue["data"] ?: throw ApiError.MalformedResponse()
    return try {
      JSON.decodeFromJsonElement(serializer, data)
    } catch (_: Exception) {
      throw ApiError.MalformedResponse()
    }
  }

  private fun mapFailure(status: Int, body: String): ApiError {
    val errorObject = runCatching {
      JSON.parseToJsonElement(body).jsonObject["error"]?.jsonObject
    }.getOrNull()
    val code = errorObject.string("code") ?: "API_ERROR"
    val message = errorObject.string("message") ?: "Server request failed"
    return when {
      status == 401 -> ApiError.Unauthorized(code, message)
      status == 403 -> ApiError.Forbidden(code, message)
      status == 404 -> ApiError.NotFound(code, message)
      status == 409 || code.contains("CONFLICT") || code.contains("IDEMPOTENCY") ->
        ApiError.Conflict(code, message, code.contains("IDEMPOTENCY"))
      status == 429 || status in 500..599 -> ApiError.Retryable(status, code, message)
      else -> ApiError.Server(status, code, message)
    }
  }

  companion object {
    private const val API_VERSION = "78b3c7c"
    private val METHODS_REQUIRING_BODY = setOf("PATCH", "POST", "PUT")
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    internal val JSON = Json {
      ignoreUnknownKeys = true
      isLenient = false
      explicitNulls = false
    }

    fun create(sessionVault: SessionVault): TicketGroundApiClient = TicketGroundApiClient(
      ApiBaseUrl.parse(BuildConfig.API_BASE_URL).value.toHttpUrl(),
      sessionVault,
      OkHttpClient(),
    )

    internal fun forTesting(
      baseUrl: HttpUrl,
      sessionVault: SessionVault,
      httpClient: OkHttpClient = OkHttpClient(),
    ): TicketGroundApiClient = TicketGroundApiClient(baseUrl, sessionVault, httpClient)

    internal inline fun <reified T> decodeForTesting(body: String): T = JSON.decodeFromString(body)
  }
}

class PublicApi internal constructor(private val client: TicketGroundApiClient) {
  suspend fun catalog(limit: Int = 50): Catalog {
    require(limit in 1..100)
    client.requireContract()
    val events = mutableListOf<CatalogEvent>()
    val venues = mutableListOf<CatalogVenue>()
    var total: Int? = null
    var cursor: String? = null
    val seenCursors = mutableSetOf<String>()
    repeat(20) { pageIndex ->
      val query = buildList {
        add("limit" to limit.toString())
        cursor?.let { add("cursor" to it) }
      }
      val page = client.execute(ApiRequest(path = "/api/catalog", query = query), Catalog.serializer())
      events += page.events
      page.venues?.let { venues += it }
      if (total == null) total = page.total
      val next = page.nextCursor ?: return Catalog(events, venues, null, total)
      if (next.isEmpty() || !seenCursors.add(next) || pageIndex == 19) {
        throw ApiError.MalformedResponse()
      }
      cursor = next
    }
    throw ApiError.MalformedResponse()
  }

  suspend fun regions(): RegionsResponse = discovery(
    "/api/discovery/v1/regions",
    RegionsResponse.serializer(),
  ) { it.version }

  suspend fun artist(slug: String): ArtistResponse {
    require(slug.isNotBlank())
    return discovery(
      "/api/discovery/v1/artists/${pathSegment(slug)}",
      ArtistResponse.serializer(),
    ) { it.version }
  }

  suspend fun openCalendar(): OpenCalendarResponse = discovery(
    "/api/discovery/v1/open-calendar",
    OpenCalendarResponse.serializer(),
  ) { it.version }

  suspend fun publicSupport(): PublicSupport = discovery(
    "/api/support/public",
    PublicSupport.serializer(),
  ) { it.version }

  suspend fun seatMap(eventId: String, performanceDateId: String? = null): SeatMap {
    require(eventId.isNotBlank())
    client.requireContract()
    val query = buildList {
      add("eventId" to eventId)
      performanceDateId?.let { add("performanceDateId" to it) }
    }
    val result = client.execute(
      ApiRequest(path = "/api/seat-map", query = query),
      SeatMap.serializer(),
    )
    if (result.event.id.isBlank() || result.event.id != eventId) throw ApiError.MalformedResponse()
    return result
  }

  private suspend fun <T> contracted(path: String, serializer: KSerializer<T>): T {
    client.requireContract()
    return client.execute(ApiRequest(path = path), serializer)
  }

  private suspend fun <T> discovery(
    path: String,
    serializer: KSerializer<T>,
    version: (T) -> String,
  ): T {
    val response = contracted(path, serializer)
    val observed = version(response)
    if (observed != DISCOVERY_VERSION) {
      throw ApiError.IncompatibleContract(DISCOVERY_VERSION, observed)
    }
    return response
  }

  private companion object {
    const val DISCOVERY_VERSION = "1"
  }
}

class AccountApi internal constructor(private val client: TicketGroundApiClient) {
  suspend fun session(): AccountSession = read("/api/me", AccountSession.serializer(), ACCOUNT)

  suspend fun profile(): AccountSession = read("/api/me/profile", AccountSession.serializer(), ACCOUNT)

  suspend fun updateProfile(name: String, idempotencyKey: String): AccountSession {
    require(name.isNotBlank())
    return mutation(
      "PATCH",
      "/api/me/profile",
      ProfileBody(name),
      idempotencyKey,
      AccountSession.serializer(),
      ACCOUNT,
    )
  }

  suspend fun tickets(): List<OwnedTicket> = read(
    "/api/me/tickets",
    kotlinx.serialization.builtins.ListSerializer(OwnedTicket.serializer()),
    ACCOUNT,
  )

  suspend fun supportThreads(): List<SupportThread> = read(
    "/api/me/support/threads",
    kotlinx.serialization.builtins.ListSerializer(SupportThread.serializer()),
    SUPPORT,
  )

  suspend fun createSupportThread(
    subject: String,
    message: String,
    idempotencyKey: String,
  ): SupportThread = mutation(
    "POST",
    "/api/me/support/threads",
    SupportThreadBody(subject, message),
    idempotencyKey,
    SupportThread.serializer(),
    SUPPORT,
  )

  suspend fun addSupportMessage(
    threadId: String,
    message: String,
    idempotencyKey: String,
  ): SupportThread = mutation(
    "POST",
    "/api/me/support/messages",
    SupportMessageBody(threadId, message),
    idempotencyKey,
    SupportThread.serializer(),
    SUPPORT,
  )

  suspend fun watchlist(): List<WatchlistItem> = read(
    "/api/me/watchlist",
    kotlinx.serialization.builtins.ListSerializer(WatchlistItem.serializer()),
    WATCHLIST,
  )

  suspend fun upsertWatchlist(
    eventId: String,
    channels: List<String>,
    calendarEnabled: Boolean,
    notificationEnabled: Boolean,
    idempotencyKey: String,
  ): WatchlistItem = mutation(
    "PUT",
    "/api/me/watchlist/${pathSegment(eventId)}",
    WatchlistPreferences(channels, calendarEnabled, notificationEnabled),
    idempotencyKey,
    WatchlistItem.serializer(),
    WATCHLIST,
  )

  suspend fun deleteWatchlist(eventId: String, idempotencyKey: String): WatchlistDeletion =
    mutationWithoutBody(
      "DELETE",
      "/api/me/watchlist/${pathSegment(eventId)}",
      idempotencyKey,
      WatchlistDeletion.serializer(),
      WATCHLIST,
    )

  suspend fun enterQueue(performanceDateId: String, idempotencyKey: String): QueueEntry = mutation(
    "POST",
    "/api/me/queue-entries",
    QueueEntryBody(performanceDateId),
    idempotencyKey,
    QueueEntry.serializer(),
    BOOKING,
  )

  suspend fun queueEntry(entryId: String): QueueEntry = read(
    "/api/me/queue-entries/${pathSegment(entryId)}",
    QueueEntry.serializer(),
    BOOKING,
  )

  suspend fun leaveQueue(entryId: String, idempotencyKey: String): QueueLeaveResult =
    mutationWithoutBody(
      "DELETE",
      "/api/me/queue-entries/${pathSegment(entryId)}",
      idempotencyKey,
      QueueLeaveResult.serializer(),
      BOOKING,
    )

  suspend fun createSeatHold(
    performanceDateId: String,
    ticketIds: List<String>,
    idempotencyKey: String,
  ): SeatHold = mutation(
    "POST",
    "/api/me/seat-holds",
    SeatHoldBody(performanceDateId, ticketIds),
    idempotencyKey,
    SeatHold.serializer(),
    BOOKING,
  )

  suspend fun seatHold(holdId: String): SeatHold = read(
    "/api/me/seat-holds/${pathSegment(holdId)}",
    SeatHold.serializer(),
    BOOKING,
  )

  suspend fun extendSeatHold(holdId: String, idempotencyKey: String): SeatHold =
    mutationWithoutBody(
      "PATCH",
      "/api/me/seat-holds/${pathSegment(holdId)}/extend",
      idempotencyKey,
      SeatHold.serializer(),
      BOOKING,
    )

  suspend fun releaseSeatHold(holdId: String, idempotencyKey: String): SeatHold =
    mutationWithoutBody(
      "DELETE",
      "/api/me/seat-holds/${pathSegment(holdId)}",
      idempotencyKey,
      SeatHold.serializer(),
      BOOKING,
    )

  suspend fun createReservationDraft(
    holdId: String,
    idempotencyKey: String,
  ): ReservationDraft = mutation(
    "POST",
    "/api/me/reservation-drafts",
    ReservationDraftBody(holdId),
    idempotencyKey,
    ReservationDraft.serializer(),
    BOOKING,
  )

  suspend fun reservationDraft(draftId: String): ReservationDraft = read(
    "/api/me/reservation-drafts/${pathSegment(draftId)}",
    ReservationDraft.serializer(),
    BOOKING,
  )

  suspend fun cancelReservationDraft(draftId: String, idempotencyKey: String): ReservationDraft =
    mutationWithoutBody(
      "DELETE",
      "/api/me/reservation-drafts/${pathSegment(draftId)}",
      idempotencyKey,
      ReservationDraft.serializer(),
      BOOKING,
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
      ApiRequest(
        method = method,
        path = path,
        idempotencyKey = idempotencyKey,
        authenticated = true,
      ),
      serializer,
    )
  }

  private companion object {
    const val ACCOUNT = "native-account-v1"
    const val SUPPORT = "native-support-v1"
    const val WATCHLIST = "native-watchlist-v1"
    const val BOOKING = "native-booking-holds-v1"
  }
}

internal data class ApiRequest(
  val method: String = "GET",
  val path: String,
  val query: List<Pair<String, String>> = emptyList(),
  val body: String? = null,
  val idempotencyKey: String? = null,
  val authenticated: Boolean = false,
)

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

private fun JsonObject?.string(name: String): String? = this?.get(name)?.jsonPrimitive?.content

internal fun pathSegment(value: String): String {
  require(value.isNotBlank())
  return URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
}
