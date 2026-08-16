package kr.ticketground.app

import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Environment
import android.provider.MediaStore
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.platform.app.InstrumentationRegistry
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.CatalogSchedule
import kr.ticketground.app.data.AdmissionQr
import kr.ticketground.app.data.OpenCalendarEntry
import kr.ticketground.app.data.Seat
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.SeatMapDetails
import kr.ticketground.app.data.SeatMapEvent
import kr.ticketground.app.data.SeatMapZone
import kr.ticketground.app.data.SeatPosition
import kr.ticketground.app.data.SupportFaq
import kr.ticketground.app.data.SupportNotice
import kr.ticketground.app.data.WatchlistEvent
import kr.ticketground.app.data.WatchlistItem
import kr.ticketground.app.ui.AccountOverview
import kr.ticketground.app.ui.AccountTicketOverview
import kr.ticketground.app.ui.AsyncContent
import kr.ticketground.app.ui.BookingProgress
import kr.ticketground.app.ui.CustomerAppViewModel
import kr.ticketground.app.ui.CustomerRepository
import kr.ticketground.app.ui.HomeContent
import kr.ticketground.app.ui.TicketGroundCustomerApp
import kr.ticketground.app.ui.TicketGroundTheme
import kotlinx.coroutines.awaitCancellation
import org.junit.Rule
import org.junit.Test
import org.junit.Assume.assumeTrue

class VisualCaptureTest {
  @get:Rule val composeRule = createComposeRule()

  @Test
  fun capture01_phoneHome() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository())
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) {
      composeRule.onAllNodesWithText("서울 콘서트").fetchSemanticsNodes().isNotEmpty()
    }
    writeCapture("01-phone-home.png")
  }

  @Test
  fun capture02_phoneEventDetail() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository()).also { it.openEvent(fixtureEvent()) }
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    writeCapture("02-phone-event-detail.png")
  }

  @Test
  fun capture03_phoneSeatMapSelectedHeldSold() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository()).also {
      it.openSeatMap(fixtureEvent(), "performance-1")
    }
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag("seat-seat-selected").fetchSemanticsNodes().isNotEmpty() }
    composeRule.runOnIdle { viewModel.selectSeat("seat-selected") }
    writeCapture("03-phone-seat-map-selected-held-sold.png")
  }

  @Test
  fun capture04_phoneWatchlist() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository()).also { it.navigate(AppDestination.Watchlist) }
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("관심공연·알림").fetchSemanticsNodes().isNotEmpty() }
    writeCapture("04-phone-watchlist.png")
  }

  @Test
  fun capture05_phoneSupport() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository()).also { it.openSupport() }
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("배송 문의").fetchSemanticsNodes().isNotEmpty() }
    writeCapture("05-phone-support.png")
  }

  @Test
  fun capture06_phoneLifecycleOverview() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository()).also { it.navigate(AppDestination.MyPage) }
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(10_000) { composeRule.onAllNodesWithTag("lifecycle-overview-list").fetchSemanticsNodes().isNotEmpty() }
    writeCapture("06-phone-lifecycle-overview.png")
  }

  @Test
  fun capture07_phoneLifecycleQr() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository()).also { it.navigate(AppDestination.MyPage) }
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag("lifecycle-overview-list").fetchSemanticsNodes().isNotEmpty() }
    composeRule.onNodeWithTag("lifecycle-overview-list")
      .performScrollToNode(hasText("입장 QR 발급"))
    composeRule.onNodeWithText("입장 QR 발급").performClick()
    composeRule.waitUntil(5_000) {
      composeRule.onAllNodesWithContentDescription("입장 QR 코드").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithTag("lifecycle-overview-list")
      .performScrollToNode(hasText("확인 코드 QA-4821"))
    writeCapture("07-phone-lifecycle-qr.png")
  }

  @Test
  fun capture08_phoneBlockedToss() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository()).also { it.openSeatMap(fixtureEvent(), "performance-1") }
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag("seat-seat-selected").fetchSemanticsNodes().isNotEmpty() }
    composeRule.runOnIdle { viewModel.selectSeat("seat-selected"); viewModel.book(fixtureEvent(), "performance-1") }
    composeRule.waitUntil(10_000) { composeRule.onAllNodesWithTag("booking-progress").fetchSemanticsNodes().isNotEmpty() }
    writeCapture("08-phone-toss-blocked.png")
  }

  @Test
  fun capture09_tabletExpandedHome() {
    val smallestWidthDp = InstrumentationRegistry.getInstrumentation().targetContext.resources.configuration.smallestScreenWidthDp
    assumeTrue("capture09_tabletExpandedHome requires a tablet form factor", smallestWidthDp >= 600)
    val viewModel = CustomerAppViewModel(VisualFixtureRepository())
    setCapture(TabletWidth, TabletHeight) {
      TicketGroundCustomerApp(viewModel)
    }
    composeRule.waitUntil(10_000) {
      composeRule.onAllNodesWithTag("event-list-two-pane").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithTag("home-list").performScrollToIndex(4)
    writeCapture("09-tablet-expanded-home-parity.png")
  }

  @Test
  fun capture10_loadingState() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository(HomeMode.Loading))
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    writeCapture("10-state-loading.png")
  }

  @Test
  fun capture11_emptyState() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository(HomeMode.Empty))
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("공연이 없습니다").fetchSemanticsNodes().isNotEmpty() }
    writeCapture("11-state-empty.png")
  }

  @Test
  fun capture12_errorState() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository(HomeMode.Error))
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("문제가 발생했어요").fetchSemanticsNodes().isNotEmpty() }
    writeCapture("12-state-error-retry.png")
  }

  @Test
  fun capture13_phoneHomeOpeningAndResale() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository())
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) {
      composeRule.onAllNodesWithTag("home-list").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithTag("home-list").performScrollToIndex(4)
    writeCapture("13-phone-home-opening-resale.png")
  }

  @Test
  fun capture14_phoneHomeGenreAndEditorial() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository())
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) {
      composeRule.onAllNodesWithTag("home-list").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithTag("home-list").performScrollToIndex(6)
    writeCapture("14-phone-home-genre-editorial.png")
  }

  @Test
  fun capture15_phoneHomeShortcuts() {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository())
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) {
      composeRule.onAllNodesWithTag("home-list").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithTag("home-list").performScrollToIndex(8)
    writeCapture("15-phone-home-shortcuts.png")
  }

  @Test
  fun capture16_phoneReservationDetail() {
    openMyPageDestination("open-reservation-detail", "reservation-ticket-ticket-1")
    writeCapture("16-phone-reservation-detail.png")
  }

  @Test
  fun capture17_phoneCancellationRequest() {
    openMyPageDestination("open-cancellation-request", "cancellation-state")
    writeCapture("17-phone-cancellation-request.png")
  }

  @Test
  fun capture18_phoneAccountResale() {
    openMyPageDestination("open-resale-lifecycle", "account-resale-state")
    writeCapture("18-phone-account-resale.png")
  }

  @Test
  fun capture19_phoneTrustedDevice() {
    openMyPageDestination("open-trusted-device", "trusted-device-active")
    writeCapture("19-phone-trusted-device.png")
  }

  @Test
  fun capture20_phonePushNotifications() {
    openMyPageDestination("open-push-notifications", "push-active")
    writeCapture("20-phone-push-notifications.png")
  }

  @Test
  fun capture21_tabletBookingConflict() {
    val viewModel = CustomerAppViewModel(
      VisualFixtureRepository(bookingProgress = BookingProgress.Conflict("좌석 상태가 변경되어 확보하지 않았습니다. 다시 확인해 주세요.")),
    )
    setCapture(TabletWidth, TabletHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag("home-hero").fetchSemanticsNodes().isNotEmpty() }
    composeRule.onNodeWithTag("home-hero").performClick()
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("좌석도에서 예매하기").fetchSemanticsNodes().isNotEmpty() }
    composeRule.onNodeWithText("9월 12일 19:00").performClick()
    composeRule.onNodeWithText("좌석도에서 예매하기").performClick()
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag("seat-seat-selected").fetchSemanticsNodes().isNotEmpty() }
    composeRule.onNodeWithTag("seat-seat-selected").performClick()
    composeRule.onNodeWithText("선택한 좌석 예매하기").performScrollTo().performClick()
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag("booking-conflict").fetchSemanticsNodes().isNotEmpty() }
    writeCapture("21-tablet-booking-conflict.png")
  }

  private fun openMyPageDestination(buttonTag: String, expectedTag: String) {
    val viewModel = CustomerAppViewModel(VisualFixtureRepository())
    setCapture(PhoneWidth, PhoneHeight) { TicketGroundCustomerApp(viewModel) }
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithText("마이페이지").fetchSemanticsNodes().isNotEmpty() }
    composeRule.onNodeWithText("마이페이지").performClick()
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag("lifecycle-overview-list").fetchSemanticsNodes().isNotEmpty() }
    composeRule.onNodeWithTag("lifecycle-overview-list").performScrollToNode(hasTestTag(buttonTag))
    composeRule.onNodeWithTag(buttonTag).performClick()
    composeRule.waitUntil(5_000) { composeRule.onAllNodesWithTag(expectedTag).fetchSemanticsNodes().isNotEmpty() }
  }

  private fun setCapture(
    width: Dp,
    height: Dp,
    content: @Composable () -> Unit,
  ) {
    composeRule.setContent {
      TicketGroundTheme {
        Box(Modifier.size(width, height).testTag(CaptureRoot)) { content() }
      }
    }
  }

  private fun writeCapture(name: String) {
    composeRule.waitForIdle()
    composeRule.waitUntil(5_000) {
      AppDestination.entries.all { destination ->
        runCatching {
          val icon = composeRule
            .onNodeWithTag("navigation-icon-${destination.name.lowercase()}", useUnmergedTree = true)
            .assertIsDisplayed()
            .captureToImage()
            .asAndroidBitmap()
          val pixels = IntArray(icon.width * icon.height)
          icon.getPixels(pixels, 0, icon.width, 0, 0, icon.width, icon.height)
          pixels.any { pixel ->
            Color.alpha(pixel) > 0 && Color.red(pixel) < 128 && Color.green(pixel) < 128 && Color.blue(pixel) < 128
          }
        }.getOrDefault(false)
      }
    }
    composeRule.mainClock.advanceTimeByFrame()
    composeRule.mainClock.advanceTimeByFrame()
    composeRule.waitForIdle()
    val captureNode = composeRule.onNodeWithTag(CaptureRoot)
    val bitmap = captureNode.captureToImage().asAndroidBitmap()
    val resolver = InstrumentationRegistry.getInstrumentation().targetContext.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Images.Media.DISPLAY_NAME, name)
      put(MediaStore.Images.Media.MIME_TYPE, "image/png")
      put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$CaptureCollection/")
    }
    val uri = checkNotNull(resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values))
    resolver.openOutputStream(uri, "w").use { output ->
      checkNotNull(output)
      check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) { "Failed to encode $name" }
    }
    val signature = ByteArray(PngSignature.size)
    val bytesRead = resolver.openInputStream(uri).use { input -> checkNotNull(input).read(signature) }
    check(bytesRead == PngSignature.size && signature.contentEquals(PngSignature)) {
      "Invalid PNG signature for $uri"
    }
  }

  companion object {
    private const val CaptureRoot = "visual-capture-root"
    private val CaptureCollection = "TicketGroundVisualQA-${System.currentTimeMillis()}"
    private val PngSignature = byteArrayOf(
      0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    )
    private val PhoneWidth = 390.dp
    private val PhoneHeight = 720.dp
    private val TabletWidth = 1120.dp
    private val TabletHeight = 720.dp

  }
}

private fun fixtureEvent() = CatalogEvent(
  id = "event-1",
  category = "콘서트",
  title = "서울 콘서트",
  venue = "잠실주경기장",
  period = "2026-09-12 ~ 2026-09-13",
  runtime = "120분",
  ageLimit = "만 7세 이상",
  summary = "객석과 함께 즐기는 라이브 공연입니다.",
  notices = listOf("공연 시작 30분 전까지 입장해 주세요.", "좌석 변경은 지원하지 않습니다."),
  schedules = listOf(
    CatalogSchedule(id = "performance-1", label = "9월 12일 19:00"),
    CatalogSchedule(id = "performance-2", label = "9월 13일 17:00"),
  ),
  saleState = "ON_SALE",
  soldCount = 42,
)

private fun fixtureHome() = HomeContent(
  events = listOf(
    fixtureEvent(),
    fixtureEvent().copy(id = "event-2", title = "부산 재즈 나이트", venue = "부산문화회관", soldCount = 31),
    fixtureEvent().copy(id = "event-3", category = "뮤지컬", title = "뮤지컬 별빛", venue = "예술의전당", soldCount = 24),
  ),
  calendar = listOf(
    OpenCalendarEntry("2026-08-14 20:00", event = fixtureEvent()),
    OpenCalendarEntry(
      "2026-08-16 14:00",
      event = fixtureEvent().copy(id = "event-3", category = "뮤지컬", title = "뮤지컬 별빛", venue = "예술의전당"),
    ),
  ),
  faq = listOf(SupportFaq("faq-1", "배송 문의", "모바일 티켓으로 제공됩니다.")),
  notices = listOf(SupportNotice("notice-1", "예매 안내", "좌석도에서 원하는 좌석을 직접 선택해 주세요.")),
)

private fun fixtureSeatMap() = SeatMap(
  event = SeatMapEvent("event-1", "서울 콘서트", "venue-1", "잠실주경기장"),
  map = SeatMapDetails(title = "잠실 좌석도", image = "", description = "무대 기준 좌석도"),
  zones = listOf(SeatMapZone("zone-a", "A구역", 120_000, 4)),
  seats = listOf(
    Seat("seat-selected", "1열 1번", "A구역 1열 1번", "zone-a", "A구역", 120_000, "AVAILABLE", true, SeatPosition(25.0, 48.0, 5.0, 5.0, 0.0, "circle")),
    Seat("seat-available", "2열 1번", "A구역 2열 1번", "zone-a", "A구역", 120_000, "AVAILABLE", true, SeatPosition(25.0, 62.0, 5.0, 5.0, 0.0, "circle")),
    Seat("seat-held", "1열 2번", "A구역 1열 2번", "zone-a", "A구역", 120_000, "HELD", false, SeatPosition(42.0, 48.0, 5.0, 5.0, 0.0, "circle")),
    Seat("seat-sold", "1열 3번", "A구역 1열 3번", "zone-a", "A구역", 120_000, "SOLD", false, SeatPosition(59.0, 48.0, 5.0, 5.0, 0.0, "circle")),
    Seat("seat-blocked", "1열 4번", "A구역 1열 4번", "zone-a", "A구역", 120_000, "BLOCKED", false, SeatPosition(76.0, 48.0, 5.0, 5.0, 0.0, "circle")),
  ),
)

private fun fixtureWatchlistItem() = WatchlistItem(
  id = "watch-1",
  eventId = "event-1",
  channels = listOf("PUSH"),
  calendarEnabled = true,
  notificationEnabled = true,
  event = WatchlistEvent("event-1", "서울 콘서트", "잠실주경기장", "venue-1", "콘서트", "ON_SALE"),
  notificationJobs = emptyList(),
)

private fun fixtureAccount() = AccountOverview(
  signedIn = true,
  tickets = listOf(
    AccountTicketOverview(
      "ticket-1", "서울 콘서트", "A구역 1열 1번", true, 80_000, 120_000, "입장 가능",
    ),
    AccountTicketOverview(
      "ticket-2", "부산 재즈 나이트", "B구역 3열 8번", false, 60_000, 90_000, "입장 가능 시간 전",
    ),
  ),
  trustedDevice = true,
  trustedDeviceId = "device-capture",
  pushSuffix = "4821",
  cancellationPending = true,
  resaleState = "OPEN",
)

private enum class HomeMode { Ready, Loading, Empty, Error }

private class VisualFixtureRepository(
  private val homeMode: HomeMode = HomeMode.Ready,
  private val bookingProgress: BookingProgress? = null,
) : CustomerRepository {
  override suspend fun home() = when (homeMode) {
    HomeMode.Ready -> fixtureHome()
    HomeMode.Loading -> awaitCancellation()
    HomeMode.Empty -> fixtureHome().copy(events = emptyList())
    HomeMode.Error -> error("visual fixture network error")
  }
  override suspend fun seatMap(eventId: String, performanceDateId: String?) = fixtureSeatMap()
  override suspend fun watchlist() = listOf(fixtureWatchlistItem())
  override suspend fun accountOverview() = fixtureAccount()
  override suspend fun book(performanceDateId: String, seatId: String, seatLabel: String, amount: Int): BookingProgress =
    bookingProgress ?: BookingProgress.Held(
      seatId,
      seatLabel,
      amount,
      kr.ticketground.app.data.TossCheckoutRequest(
        "draft-capture", seatId, seatLabel, amount + 2_000, kr.ticketground.app.data.TossPaymentMethod.CREDIT_CARD,
        "test_ck_capture", "capture-idempotency",
      ),
    )
  override suspend fun requestCancellation(ticketId: String, reason: String) = Unit
  override suspend fun listForResale(ticketId: String, price: Int) = Unit
  override suspend fun addToWatchlist(eventId: String) = Unit
  override suspend fun issueAdmissionQr(ticketId: String) = AdmissionQr(
    type = "admissionQr",
    ticketId = ticketId,
    ownerId = "owner-capture",
    expiresAt = "2026-09-12 19:05",
    nonce = "capture-nonce",
    signature = "capture-signature",
    issuedAt = "2026-09-12 18:55",
    performanceStartsAt = "2026-09-12 19:00",
    preparedAt = "2026-09-12 18:50",
    activeAt = "2026-09-12 18:55",
    ttlSeconds = 600,
    traceCode = "QA-4821",
    channel = "APP",
  )
}
