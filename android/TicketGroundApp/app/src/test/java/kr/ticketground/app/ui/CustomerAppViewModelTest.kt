package kr.ticketground.app.ui

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kr.ticketground.app.data.ApiError
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.Seat
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.SeatMapDetails
import kr.ticketground.app.data.SeatMapEvent
import kr.ticketground.app.data.SeatMapZone
import kr.ticketground.app.data.SeatPosition
import kr.ticketground.app.data.WatchlistItem
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CustomerAppViewModelTest {
  private val dispatcher = StandardTestDispatcher()

  @Before fun setUp() { Dispatchers.setMain(dispatcher) }
  @After fun tearDown() { Dispatchers.resetMain() }

  @Test
  fun `failed home load exposes error and retry replaces it with server content`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(homeError = ApiError.Transport(java.io.IOException("offline")))
    val viewModel = CustomerAppViewModel(repository)

    advanceUntilIdle()
    assertEquals("네트워크 연결을 확인한 뒤 다시 시도해 주세요.", (viewModel.home.value as AsyncContent.Error).message)

    repository.homeError = null
    viewModel.loadHome()
    advanceUntilIdle()
    assertEquals("서울 콘서트", (viewModel.home.value as AsyncContent.Ready).value.events.single().title)
  }

  @Test
  fun `seat selection books backend coordinate and opens fail-closed checkout handoff`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")
    viewModel.book(event, "performance-1")
    advanceUntilIdle()

    assertEquals("seat-a1", repository.bookedSeatId)
    val checkout = viewModel.route.value as CustomerRoute.Checkout
    assertEquals("A구역 1열 1번", checkout.seatLabel)
    assertEquals(false, checkout.configured)
  }

  @Test
  fun `missing bearer becomes explicit sign-in-required account state`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(accountError = ApiError.MissingCredential())
    val viewModel = CustomerAppViewModel(repository)

    viewModel.loadAccount()
    advanceUntilIdle()

    val state = viewModel.account.value as AsyncContent.Ready
    assertTrue(!state.value.signedIn)
  }

  @Test
  fun `seat map load exposes backend held ids for map semantics`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    advanceUntilIdle()

    viewModel.loadSeatMap("event-1", "performance-1")
    advanceUntilIdle()

    assertEquals(setOf("seat-held"), viewModel.heldSeatIds.value)
  }
}

private class FakeCustomerRepository(
  var homeError: Throwable? = null,
  private val accountError: Throwable? = null,
) : CustomerRepository {
  val homeValue = HomeContent(listOf(event()), emptyList(), emptyList(), emptyList())
  var bookedSeatId: String? = null

  override suspend fun home(): HomeContent = homeError?.let { throw it } ?: homeValue
  override suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap = seatMapFixture()
  override suspend fun watchlist(): List<WatchlistItem> = emptyList()
  override suspend fun accountOverview(): AccountOverview = accountError?.let { throw it } ?: AccountOverview(true)
  override suspend fun book(performanceDateId: String, seatId: String, seatLabel: String, amount: Int): BookingProgress {
    bookedSeatId = seatId
    return BookingProgress.Held(seatId, seatLabel, amount, tossConfigured = false)
  }
  override suspend fun requestCancellation(ticketId: String, reason: String) = Unit
  override suspend fun listForResale(ticketId: String, price: Int) = Unit

  private fun event() = CatalogEvent(id = "event-1", title = "서울 콘서트", venue = "잠실주경기장", soldCount = 42)
  private fun seatMapFixture() = SeatMap(
    event = SeatMapEvent("event-1", "서울 콘서트", "venue-1", "잠실주경기장"),
    map = SeatMapDetails(title = "잠실 좌석도", image = "", description = "무대 기준 좌석도"),
    zones = listOf(SeatMapZone("zone-a", "A구역", 120000, 1)),
    seats = listOf(
      Seat(
        id = "seat-a1", label = "1열 1번", displayCode = "A구역 1열 1번", zoneId = "zone-a",
        zoneName = "A구역", price = 120000, status = "AVAILABLE", available = true,
        mapPosition = SeatPosition(30.0, 45.0, 4.0, 4.0, 0.0, "circle"),
      ),
      Seat(
        id = "seat-held", label = "1열 2번", displayCode = "A구역 1열 2번", zoneId = "zone-a",
        zoneName = "A구역", price = 120000, status = "HELD", available = false,
        mapPosition = SeatPosition(36.0, 45.0, 4.0, 4.0, 0.0, "circle"),
      ),
    ),
  )
}
