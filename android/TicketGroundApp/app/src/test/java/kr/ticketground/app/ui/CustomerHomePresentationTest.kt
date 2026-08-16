package kr.ticketground.app.ui

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.OpenCalendarEntry
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.WatchlistItem
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CustomerHomePresentationTest {
  private val dispatcher = StandardTestDispatcher()

  @Before
  fun setUp() {
    Dispatchers.setMain(dispatcher)
  }

  @After
  fun tearDown() {
    Dispatchers.resetMain()
  }

  @Test
  fun `home presentation preserves web section order`() {
    assertEquals(
      listOf("featured", "ranking", "opening", "resale", "genres", "editorial", "shortcuts"),
      CustomerHomeSection.entries.map(CustomerHomeSection::key),
    )
  }

  @Test
  fun `home presentation derives real customer destinations`() {
    val presentation = CustomerHomePresentation.from(homeFixture())

    assertEquals(CustomerRoute.Resale, presentation.resale.destination)
    assertEquals("콘서트", presentation.genres.first().label)
    assertEquals(CustomerRoute.OpenCalendar, presentation.opening.destination)
    assertEquals("ticketground-day", presentation.editorials.first().slug)
  }

  @Test
  fun `home presentation caps ordered calendar and genre events`() {
    val presentation = CustomerHomePresentation.from(homeFixture(includeEveryGenre = true))

    assertEquals(2, presentation.opening.entries.size)
    assertEquals(listOf("콘서트", "뮤지컬", "연극", "클래식", "전시", "아동", "스포츠"), presentation.genres.map { it.label })
    assertEquals(5, presentation.genres.first().events.size)
  }

  @Test
  fun `home presentation keeps safety metadata for empty catalog input`() {
    val presentation = CustomerHomePresentation.from(HomeContent(emptyList(), emptyList(), emptyList(), emptyList()))

    assertEquals(emptyList<OpenCalendarEntry>(), presentation.opening.entries)
    assertEquals(emptyList<GenreRecommendation>(), presentation.genres)
    assertEquals(emptyList<EditorialCard>(), presentation.editorials)
    assertEquals(
      listOf(
        "보유 티켓 확인" to "예매 내역에서 보유 티켓을 확인합니다.",
        "정책 자동 판별" to "정가 범위와 구매 이력을 자동으로 판별합니다.",
        "QR 보호" to "입장 직전에 보호된 QR을 발급합니다.",
      ),
      presentation.resale.safetyItems.map { it.title to it.detail },
    )
  }

  @Test
  fun `editorial collection preserves all real catalog events`() {
    val content = homeFixture()

    val editorial = CustomerHomePresentation.from(content).editorials.single()

    assertEquals(content.events, editorial.events)
    assertEquals(CustomerRoute.Collection("기획전", content.events), editorial.destination)
  }

  @Test
  fun `collection navigation sets typed route only`() {
    val content = homeFixture()

    assertRouteOnly(CustomerRoute.Collection("콘서트", content.events)) { viewModel ->
      viewModel.openCollection("콘서트", content.events)
    }
  }

  @Test
  fun `calendar navigation sets typed route only`() {
    assertRouteOnly(CustomerRoute.OpenCalendar, CustomerAppViewModel::openCalendar)
  }

  @Test
  fun `resale navigation sets typed route only`() {
    assertRouteOnly(CustomerRoute.Resale, CustomerAppViewModel::openResale)
  }

  private fun assertRouteOnly(expected: CustomerRoute, action: (CustomerAppViewModel) -> Unit) {
    val viewModel = CustomerAppViewModel(PresentationRepository(homeFixture()))
    val destination = viewModel.destination.value
    val searchQuery = viewModel.searchQuery.value
    val home = viewModel.home.value

    action(viewModel)

    assertEquals(expected, viewModel.route.value)
    assertEquals(destination, viewModel.destination.value)
    assertEquals(searchQuery, viewModel.searchQuery.value)
    assertEquals(home, viewModel.home.value)
  }
}

private class PresentationRepository(private val content: HomeContent) : CustomerRepository {
  override suspend fun home(): HomeContent = content
  override suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap = error("not used")
  override suspend fun watchlist(): List<WatchlistItem> = error("not used")
  override suspend fun accountOverview(): AccountOverview = error("not used")
  override suspend fun book(performanceDateId: String, seatId: String, seatLabel: String, amount: Int): BookingProgress = error("not used")
  override suspend fun requestCancellation(ticketId: String, reason: String) = error("not used")
  override suspend fun listForResale(ticketId: String, price: Int) = error("not used")
  override suspend fun addToWatchlist(eventId: String) = error("not used")
}

private fun homeFixture(includeEveryGenre: Boolean = false): HomeContent {
  val concertEvents = (1..6).map { index -> event("concert-$index", "concert", "콘서트 $index") }
  val otherEvents = if (includeEveryGenre) {
    listOf(
      event("musical-1", "musical", "뮤지컬 1"),
      event("play-1", "play", "연극 1"),
      event("classic-1", "classic", "클래식 1"),
      event("exhibition-1", "exhibition", "전시 1"),
      event("child-1", "child", "아동 1"),
      event("sports-1", "sports", "스포츠 1"),
    )
  } else {
    emptyList()
  }
  val events = concertEvents + otherEvents
  val calendar = (1..3).map { index ->
    OpenCalendarEntry(
      opensAt = "2026-08-${16 + index}T20:00:00+09:00",
      event = events[index - 1],
    )
  }
  return HomeContent(events, calendar, emptyList(), emptyList())
}

private fun event(id: String, category: String, title: String) = CatalogEvent(
  id = id,
  category = category,
  title = title,
  venue = "Ticketground Hall",
  soldCount = 100,
)
