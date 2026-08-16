package kr.ticketground.app.ui

import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.OpenCalendarEntry

enum class CustomerHomeSection(val key: String) {
  Featured("featured"),
  Ranking("ranking"),
  Opening("opening"),
  Resale("resale"),
  Genres("genres"),
  Editorial("editorial"),
  Shortcuts("shortcuts"),
}

data class OpeningPresentation(
  val entries: List<OpenCalendarEntry>,
  val destination: CustomerRoute,
)

data class ResalePresentation(
  val destination: CustomerRoute,
  val safetyItems: List<ResaleSafetyItem>,
)

data class ResaleSafetyItem(
  val order: Int,
  val title: String,
  val detail: String,
)

data class GenreRecommendation(
  val label: String,
  val events: List<CatalogEvent>,
  val destination: CustomerRoute.Collection,
)

data class EditorialCard(
  val order: Int,
  val title: String,
  val slug: String,
  val events: List<CatalogEvent>,
  val destination: CustomerRoute.Collection,
)

data class CustomerHomePresentation(
  val opening: OpeningPresentation,
  val resale: ResalePresentation,
  val genres: List<GenreRecommendation>,
  val editorials: List<EditorialCard>,
) {
  companion object {
    fun from(content: HomeContent): CustomerHomePresentation {
      val genres = genreLabels.mapNotNull { (category, label) ->
        val events = content.events.filter { it.category.toGenreKey() == category }.take(5)
        if (events.isEmpty()) null
        else GenreRecommendation(label, events, CustomerRoute.Collection(label, events))
      }
      val editorialEvents = content.events
      val editorials = if (editorialEvents.isEmpty()) emptyList() else listOf(
        EditorialCard(
          order = 1,
          title = "Ticketground Day",
          slug = "ticketground-day",
          events = editorialEvents,
          destination = CustomerRoute.Collection("기획전", editorialEvents),
        ),
      )
      return CustomerHomePresentation(
        opening = OpeningPresentation(content.calendar.take(2), CustomerRoute.OpenCalendar),
        resale = ResalePresentation(CustomerRoute.Resale, resaleSafetyItems),
        genres = genres,
        editorials = editorials,
      )
    }

    private val genreLabels = listOf(
      "concert" to "콘서트",
      "musical" to "뮤지컬",
      "play" to "연극",
      "classic" to "클래식",
      "exhibition" to "전시",
      "child" to "아동",
      "sports" to "스포츠",
    )

    private val resaleSafetyItems = listOf(
      ResaleSafetyItem(1, "보유 티켓 확인", "예매 내역에서 보유 티켓을 확인합니다."),
      ResaleSafetyItem(2, "정책 자동 판별", "정가 범위와 구매 이력을 자동으로 판별합니다."),
      ResaleSafetyItem(3, "QR 보호", "입장 직전에 보호된 QR을 발급합니다."),
    )
  }
}

private fun String?.toGenreKey(): String? = when (this?.lowercase()) {
  "concert", "콘서트" -> "concert"
  "musical", "뮤지컬" -> "musical"
  "play", "theater", "연극" -> "play"
  "classic", "classical", "클래식" -> "classic"
  "exhibition", "전시" -> "exhibition"
  "child", "children", "family", "kids", "아동" -> "child"
  "sports", "스포츠" -> "sports"
  else -> null
}
