package kr.ticketground.app

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.Seat
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.SeatMapDetails
import kr.ticketground.app.data.SeatMapEvent
import kr.ticketground.app.data.SeatMapZone
import kr.ticketground.app.data.SeatPosition
import kr.ticketground.app.ui.AccountOverview
import kr.ticketground.app.ui.AsyncContent
import kr.ticketground.app.ui.EventListScreen
import kr.ticketground.app.ui.GraphicalSeatMapScreen
import kr.ticketground.app.ui.LifecycleOverviewScreen
import kr.ticketground.app.ui.TicketGroundNavigation
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
  fun tabletNavigation_exposesRailAndTwoPaneContent() {
    composeRule.setContent {
      MaterialTheme { TicketGroundNavigation(selected = AppDestination.Home, width = 840.dp, onNavigate = {}) {
        EventListScreen(
          title = "티켓 랭킹",
          state = AsyncContent.Ready(listOf(event())),
          expanded = true,
          onRetry = {},
          onEvent = {},
        )
      } }
    }

    composeRule.onNodeWithTag("navigation-rail").assertIsDisplayed()
    composeRule.onNodeWithTag("event-list-two-pane").assertIsDisplayed()
  }

  @Test
  fun graphicalSeatMap_selectsSeatDirectlyAndNeverShowsTicketList() {
    var selected: String? = null
    composeRule.setContent {
      MaterialTheme {
        GraphicalSeatMapScreen(
          state = AsyncContent.Ready(seatMap()),
          selectedSeatId = selected,
          heldSeatId = null,
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
    composeRule.onNodeWithText("실제 구매 가능한 티켓 선택").assertDoesNotExist()
  }

  @Test
  fun asyncSurfaces_showLoadingEmptyErrorAndRetryAction() {
    var retried = false
    composeRule.setContent {
      MaterialTheme {
        EventListScreen("검색 결과", AsyncContent.Error("네트워크 연결을 확인해 주세요"), false, { retried = true }, {})
      }
    }

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

  private fun seatMap() = SeatMap(
    event = SeatMapEvent("event-1", "서울 콘서트", "venue-1", "잠실주경기장"),
    map = SeatMapDetails(title = "잠실 좌석도", image = "", description = "무대 기준 좌석도"),
    zones = listOf(SeatMapZone("zone-a", "A구역", 120000, 1)),
    seats = listOf(
      Seat(
        id = "seat-a1", label = "1열 1번", displayCode = "A구역 1열 1번", zoneId = "zone-a",
        zoneName = "A구역", price = 120000, status = "AVAILABLE", available = true,
        mapPosition = SeatPosition(30.0, 45.0, 4.0, 4.0, 0.0, "circle"),
      ),
    ),
  )
}
