package kr.ticketground.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.Seat
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.SeatMapDetails
import kr.ticketground.app.data.SeatMapEvent
import kr.ticketground.app.data.SeatMapZone
import kr.ticketground.app.data.SeatPosition
import kr.ticketground.app.data.OpenCalendarEntry
import kr.ticketground.app.data.SupportFaq
import kr.ticketground.app.data.SupportNotice
import kr.ticketground.app.ui.AccountOverview
import kr.ticketground.app.ui.AsyncContent
import kr.ticketground.app.ui.EventListScreen
import kr.ticketground.app.ui.GraphicalSeatMapScreen
import kr.ticketground.app.ui.LifecycleOverviewScreen
import kr.ticketground.app.ui.TicketGroundNavigation
import kr.ticketground.app.ui.TicketGroundCustomerApp
import kr.ticketground.app.ui.CustomerAppViewModel
import kr.ticketground.app.ui.CustomerRepository
import kr.ticketground.app.ui.HomeContent
import kr.ticketground.app.ui.BookingProgress
import kr.ticketground.app.ui.TicketGroundTheme
import kr.ticketground.app.data.WatchlistItem
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class TicketGroundAppShellTest {
  @get:Rule val composeRule = createComposeRule()

  @Test
  fun phoneNavigation_exposesFourCustomerDestinations() {
    composeRule.setContent {
      MaterialTheme { TicketGroundNavigation(selected = AppDestination.Home, width = 390.dp, onNavigate = {}) {} }
    }

    listOf("홈", "검색", "찜", "마이페이지").forEach {
      composeRule.onNodeWithText(it).assertIsDisplayed().assertHasClickAction()
    }
  }

  @Test
  fun tabletProductionHome_exposesRailTwoPaneSearchCalendarAndSupport() {
    val viewModel = CustomerAppViewModel(ComposeCustomerRepository())
    composeRule.setContent {
      TicketGroundTheme {
        Box(Modifier.wrapContentWidth(Alignment.Start, unbounded = true).width(840.dp)) {
          TicketGroundCustomerApp(viewModel)
        }
      }
    }

    composeRule.waitUntil(timeoutMillis = 5_000) {
      composeRule.onAllNodesWithTag("event-list-two-pane").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithTag("navigation-rail").assertIsDisplayed()
    composeRule.onNodeWithTag("event-list-two-pane").assertIsDisplayed()
    composeRule.onNodeWithText("공연, 아티스트 또는 공연장 검색").assertIsDisplayed().assertHasClickAction()
    composeRule.onNodeWithText("오픈 캘린더").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("2026-08-14 20:00").performScrollTo().assertIsDisplayed()
    composeRule.onNodeWithText("공지·자주 묻는 질문").performScrollTo().assertIsDisplayed().performClick()
    composeRule.onNodeWithText("배송 문의").assertIsDisplayed()
  }

  @Test
  fun expandedCustomerHome_searchCtaNavigatesToSearch() {
    val viewModel = CustomerAppViewModel(ComposeCustomerRepository())
    composeRule.setContent {
      TicketGroundTheme {
        Box(Modifier.wrapContentWidth(Alignment.Start, unbounded = true).width(840.dp)) {
          TicketGroundCustomerApp(viewModel)
        }
      }
    }

    composeRule.waitUntil(timeoutMillis = 5_000) {
      composeRule.onAllNodesWithText("공연, 아티스트 또는 공연장 검색").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithText("공연, 아티스트 또는 공연장 검색").performClick()
    composeRule.onNodeWithText("공연 검색").assertIsDisplayed()
  }

  @Test
  fun graphicalSeatMap_selectsSeatDirectlyAndNeverShowsTicketList() {
    var selected by mutableStateOf<String?>(null)
    composeRule.setContent {
      TicketGroundTheme {
        GraphicalSeatMapScreen(
          state = AsyncContent.Ready(seatMap()),
          selectedSeatId = selected,
          heldSeatIds = emptySet(),
          pending = false,
          onRetry = {},
          onSeatSelected = { selected = it },
          onBook = {},
        )
      }
    }

    composeRule.onNodeWithContentDescription("A구역 1열 1번, 선택 가능, 120,000원")
      .assertIsDisplayed().performClick()
    composeRule.runOnIdle { assertEquals("seat-a1", selected) }
    composeRule.onNodeWithContentDescription("A구역 1열 1번, 선택됨, 120,000원").assertIsDisplayed()
    composeRule.onNodeWithText("실제 구매 가능한 티켓 선택").assertDoesNotExist()
  }

  @Test
  fun graphicalSeatMap_usesSafeImageGeometryAndKeepsFallbackSeatsUsable() {
    composeRule.setContent {
      TicketGroundTheme {
        Box(Modifier.width(400.dp)) {
          GraphicalSeatMapScreen(
            state = AsyncContent.Ready(seatMap(image = "https://attacker.example/map.svg")),
            selectedSeatId = null,
            pending = false,
            onRetry = {},
            onSeatSelected = {},
            onBook = {},
          )
        }
      }
    }

    composeRule.onNodeWithTag("seat-map-image-fallback").assertIsDisplayed()
    composeRule.onNodeWithTag("seat-seat-a1").assertIsDisplayed().assertHasClickAction()
    composeRule.onNodeWithTag("seat-marker-seat-a1", useUnmergedTree = true)
      .assertWidthIsEqualTo(16.dp).assertHeightIsEqualTo(16.dp)
  }

  @Test
  fun graphicalSeatMap_rendersConfiguredOriginImageBelowSelectableSeats() {
    composeRule.setContent {
      TicketGroundTheme {
        GraphicalSeatMapScreen(
          state = AsyncContent.Ready(seatMap(image = "/maps/venue.svg")),
          selectedSeatId = null,
          pending = false,
          onRetry = {},
          onSeatSelected = {},
          onBook = {},
        )
      }
    }

    composeRule.onNodeWithTag("seat-map-image").assertIsDisplayed()
    composeRule.onNodeWithContentDescription("A구역 1열 1번, 선택 가능, 120,000원").assertIsDisplayed()
  }

  @Test
  fun graphicalSeatMap_exposesHeldSoldAndUnavailableAsDistinctDisabledStates() {
    composeRule.setContent {
      TicketGroundTheme {
        GraphicalSeatMapScreen(
          state = AsyncContent.Ready(seatMapWithUnavailableStates()),
          selectedSeatId = null,
          pending = false,
          onRetry = {},
          onSeatSelected = {},
          onBook = {},
        )
      }
    }

    composeRule.onNodeWithContentDescription("A구역 1열 2번, 점유됨, 120,000원").assertIsNotEnabled()
    composeRule.onNodeWithContentDescription("A구역 1열 3번, 판매 완료, 120,000원").assertIsNotEnabled()
    composeRule.onNodeWithContentDescription("A구역 1열 4번, 선택 불가, 120,000원").assertIsNotEnabled()
  }

  @Test
  fun asyncSurfaces_showLoadingEmptyErrorAndRetryAction() {
    var retried = false
    var state by mutableStateOf<AsyncContent<List<CatalogEvent>>>(AsyncContent.Loading)
    composeRule.setContent {
      MaterialTheme {
        EventListScreen("검색 결과", state, false, { retried = true }, {})
      }
    }

    composeRule.onNodeWithContentDescription("콘텐츠를 불러오는 중").assertIsDisplayed()
    composeRule.runOnIdle { state = AsyncContent.Empty("검색 결과가 없습니다", "다른 검색어를 입력해 주세요.") }
    composeRule.onNodeWithText("검색 결과가 없습니다").assertIsDisplayed()
    composeRule.runOnIdle { state = AsyncContent.Error("네트워크 연결을 확인해 주세요") }
    composeRule.onNodeWithText("네트워크 연결을 확인해 주세요").assertIsDisplayed()
    composeRule.onNodeWithText("다시 시도").performClick()
    composeRule.runOnIdle { assertEquals(true, retried) }
  }

  @Test
  fun lifecycleActions_disableWhenTicketIsIneligibleAndRedactSecrets() {
    composeRule.setContent {
      MaterialTheme {
        LifecycleOverviewScreen(
          AsyncContent.Ready(
            AccountOverview(
              signedIn = true,
              ticketTitle = "서울 콘서트",
              seatLabel = "A구역 1열 1번",
              ticketEligible = false,
              trustedDevice = false,
              pushSuffix = "4821",
              qrState = "입장 가능 시간 전",
            ),
          ),
          onRetry = {},
        )
      }
    }

    composeRule.onNodeWithText("취소 요청").assertIsNotEnabled()
    composeRule.onNodeWithText("공식 재판매 등록").assertIsNotEnabled()
    composeRule.onNodeWithText("입장 QR 발급").assertIsNotEnabled()
    listOf("token", "proof", "signature", "nonce", "ticket-id").forEach {
      composeRule.onNodeWithText(it, substring = true, ignoreCase = true).assertDoesNotExist()
    }
    composeRule.onNodeWithText("끝자리 4821", substring = true).assertIsDisplayed()
  }

  @Test
  fun paymentHandoff_failsClosedUntilTossIsConfigured() {
    composeRule.setContent {
      MaterialTheme {
        kr.ticketground.app.ui.CheckoutHandoffScreen(
          configured = false,
          pending = false,
          seatLabel = "A구역 1열 1번",
          amount = 122000,
          onOpenProvider = {},
        )
      }
    }

    composeRule.onNodeWithText("Toss Payments 연결이 필요합니다").assertIsDisplayed()
    composeRule.onNodeWithText("결제창 열기").assertIsNotEnabled()
  }

  private fun event() = CatalogEvent(
    id = "event-1", title = "서울 콘서트", venue = "잠실주경기장", soldCount = 42,
  )

  private fun seatMap(image: String = "") = SeatMap(
    event = SeatMapEvent("event-1", "서울 콘서트", "venue-1", "잠실주경기장"),
    map = SeatMapDetails(title = "잠실 좌석도", image = image, description = "무대 기준 좌석도"),
    zones = listOf(SeatMapZone("zone-a", "A구역", 120000, 1)),
    seats = listOf(
      Seat(
        id = "seat-a1", label = "1열 1번", displayCode = "A구역 1열 1번", zoneId = "zone-a",
        zoneName = "A구역", price = 120000, status = "AVAILABLE", available = true,
        mapPosition = SeatPosition(30.0, 45.0, 4.0, 4.0, 0.0, "circle"),
      ),
    ),
  )

  private fun seatMapWithUnavailableStates() = seatMap().copy(
    seats = listOf(
      Seat("seat-held", "1열 2번", "A구역 1열 2번", "zone-a", "A구역", 120000, "HELD", false, SeatPosition(36.0, 45.0, 4.0, 4.0, 0.0, "circle")),
      Seat("seat-sold", "1열 3번", "A구역 1열 3번", "zone-a", "A구역", 120000, "SOLD", false, SeatPosition(42.0, 45.0, 4.0, 4.0, 0.0, "circle")),
      Seat("seat-blocked", "1열 4번", "A구역 1열 4번", "zone-a", "A구역", 120000, "BLOCKED", false, SeatPosition(48.0, 45.0, 4.0, 4.0, 0.0, "circle")),
    ),
  )
}

private class ComposeCustomerRepository : CustomerRepository {
  private val event = CatalogEvent(id = "event-1", title = "서울 콘서트", venue = "잠실주경기장", soldCount = 42)
  override suspend fun home() = HomeContent(
    events = listOf(event),
    calendar = listOf(OpenCalendarEntry("2026-08-14 20:00", event = event)),
    faq = listOf(SupportFaq("faq-1", "배송 문의", "모바일 티켓으로 제공됩니다.")),
    notices = listOf(SupportNotice("notice-1", "예매 안내", "좌석도에서 선택해 주세요.")),
  )
  override suspend fun seatMap(eventId: String, performanceDateId: String?) = error("not used")
  override suspend fun watchlist(): List<WatchlistItem> = emptyList()
  override suspend fun accountOverview() = AccountOverview(signedIn = false)
  override suspend fun book(performanceDateId: String, seatId: String, seatLabel: String, amount: Int): BookingProgress = error("not used")
  override suspend fun requestCancellation(ticketId: String, reason: String) = Unit
  override suspend fun listForResale(ticketId: String, price: Int) = Unit
}
