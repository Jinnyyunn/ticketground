package kr.ticketground.app.data

import kotlinx.serialization.KSerializer

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
      if (next.isEmpty() || !seenCursors.add(next) || pageIndex == 19) throw ApiError.MalformedResponse()
      cursor = next
    }
    throw ApiError.MalformedResponse()
  }

  suspend fun regions(): RegionsResponse = discovery(
    "/api/discovery/v1/regions", RegionsResponse.serializer(),
  ) { it.version }

  suspend fun artist(slug: String): ArtistResponse {
    require(slug.isNotBlank())
    return discovery(
      "/api/discovery/v1/artists/${pathSegment(slug)}", ArtistResponse.serializer(),
    ) { it.version }
  }

  suspend fun openCalendar(): OpenCalendarResponse = discovery(
    "/api/discovery/v1/open-calendar", OpenCalendarResponse.serializer(),
  ) { it.version }

  suspend fun publicSupport(): PublicSupport = discovery(
    "/api/support/public", PublicSupport.serializer(),
  ) { it.version }

  suspend fun seatMap(eventId: String, performanceDateId: String? = null): SeatMap {
    require(eventId.isNotBlank())
    client.requireContract()
    val query = buildList {
      add("eventId" to eventId)
      performanceDateId?.let { add("performanceDateId" to it) }
    }
    val result = client.execute(ApiRequest(path = "/api/seat-map", query = query), SeatMap.serializer())
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
    if (observed != DISCOVERY_VERSION) throw ApiError.IncompatibleContract(DISCOVERY_VERSION, observed)
    return response
  }

  private companion object {
    const val DISCOVERY_VERSION = "1"
  }
}
