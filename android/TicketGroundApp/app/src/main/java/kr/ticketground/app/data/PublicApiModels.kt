package kr.ticketground.app.data

import kotlinx.serialization.Serializable

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
