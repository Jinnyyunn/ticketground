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
import kr.ticketground.app.data.TossCheckoutRequest
import kr.ticketground.app.data.TossPaymentMethod
import kr.ticketground.app.data.TossWidgetResult
import kr.ticketground.app.data.CheckoutOutcome
import kr.ticketground.app.data.CheckoutError
import kr.ticketground.app.data.OwnedTicket
import kr.ticketground.app.data.AdmissionQr
import kr.ticketground.app.data.DisplayStatus
import kr.ticketground.app.data.SupportThread
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
  fun `unexpected error exposes concise natural Korean copy`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository(homeError = IllegalStateException("boom")))

    advanceUntilIdle()

    assertEquals("요청을 완료하지 못했습니다. 다시 시도해 주세요.", (viewModel.home.value as AsyncContent.Error).message)
  }

  @Test
  fun `seat selection books backend coordinate and opens configured checkout request`() = runTest(dispatcher) {
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
    val booking = viewModel.route.value as CustomerRoute.Booking
    val held = booking.progress as BookingProgress.Held
    assertEquals("A구역 1열 1번", held.seatLabel)
    assertEquals("ticket-1", held.checkout.ticketId)
    assertEquals("client-key", held.checkout.clientKey)
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

  @Test
  fun `platform actions execute repositories and expose observable success`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(
      accountValue = accountOverview(),
    )
    val viewModel = CustomerAppViewModel(repository)
    viewModel.loadAccount()
    advanceUntilIdle()

    viewModel.trustThisDevice()
    advanceUntilIdle()
    assertEquals(1, repository.trustCalls)
    assertEquals("이 기기가 신뢰 기기로 등록되었습니다.", viewModel.actionMessage.value)

    viewModel.registerPush()
    advanceUntilIdle()
    assertEquals(1, repository.pushCalls)

    viewModel.issueAdmissionQr()
    advanceUntilIdle()
    assertEquals("ticket-1", repository.qrTicketId)
    assertEquals("nonce.signature", viewModel.admissionQr.value?.let { "${it.nonce}.${it.signature}" })
    assertEquals("입장 QR이 안전하게 발급되었습니다.", viewModel.actionMessage.value)
  }

  @Test
  fun `selecting an owned ticket scopes cancellation resale and admission QR`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(accountValue = accountOverview(twoTickets = true))
    val viewModel = CustomerAppViewModel(repository)
    viewModel.loadAccount()
    advanceUntilIdle()

    viewModel.selectOwnedTicket("ticket-2")
    viewModel.issueAdmissionQr()
    advanceUntilIdle()

    assertEquals("ticket-2", repository.qrTicketId)
  }

  @Test
  fun `refreshing account preserves the selected owned ticket`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(accountValue = accountOverview(twoTickets = true))
    val viewModel = CustomerAppViewModel(repository)
    viewModel.loadAccount()
    advanceUntilIdle()

    viewModel.selectOwnedTicket("ticket-2")
    viewModel.loadAccount()
    advanceUntilIdle()

    val account = (viewModel.account.value as AsyncContent.Ready).value
    assertEquals("ticket-2", account.selectedTicketId)
  }

  @Test
  fun `event detail watchlist action persists the selected event`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.addToWatchlist(event)
    advanceUntilIdle()

    assertEquals("event-1", repository.watchlistedEventId)
    assertEquals("관심공연에 추가했습니다.", viewModel.actionMessage.value)
  }

  @Test
  fun `Toss result is confirmed by repository before checkout reports success`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")
    viewModel.book(event, "performance-1")
    advanceUntilIdle()
    val progress = (viewModel.route.value as CustomerRoute.Booking).progress as BookingProgress.Held
    viewModel.continueToCheckout(progress)
    val request = (viewModel.route.value as CustomerRoute.Checkout).request

    viewModel.completeCheckout(request, TossWidgetResult.Success("provider-payment-key"))
    advanceUntilIdle()

    assertEquals("provider-payment-key", repository.completedPaymentKey)
    assertEquals("결제가 승인되어 예매가 완료되었습니다.", viewModel.actionMessage.value)
  }

  @Test
  fun `missing Toss configuration remains on seat map with a fail closed message`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(bookError = CheckoutError.ProviderUnavailable)
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")

    viewModel.book(event, "performance-1")
    advanceUntilIdle()

    assertTrue(viewModel.route.value is CustomerRoute.SeatMapRoute)
    assertEquals("Toss Payments 설정을 확인할 수 없어 결제를 시작하지 않았습니다.", viewModel.actionMessage.value)
  }

  @Test
  fun `ranking opens a typed ranking destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()

    viewModel.openRanking(repository.homeValue.events)

    assertEquals(CustomerRoute.Ranking(repository.homeValue.events), viewModel.route.value)
  }

  @Test
  fun `region discovery opens a typed region destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()

    viewModel.openRegion("서울", repository.homeValue.events)

    assertEquals(CustomerRoute.Region("서울", repository.homeValue.events), viewModel.route.value)
  }

  @Test
  fun `venue discovery opens a typed venue destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openVenue(event)

    assertEquals(CustomerRoute.Venue(event.venueId, event.venue, repository.homeValue.events), viewModel.route.value)
  }

  @Test
  fun `artist discovery opens a typed artist destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openArtist(event)

    assertEquals(CustomerRoute.Artist(event.artistSlug, event.casts.orEmpty(), repository.homeValue.events), viewModel.route.value)
  }

  @Test
  fun `booking progress opens a typed queue hold and draft destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    advanceUntilIdle()
    val progress = BookingProgress.Waiting(3)

    viewModel.openBooking(progress)

    assertEquals(CustomerRoute.Booking(progress), viewModel.route.value)
  }

  @Test
  fun `reservation detail opens a typed principal destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    viewModel.openReservation()
    assertEquals(CustomerRoute.Reservation, viewModel.route.value)
  }

  @Test
  fun `cancellation request opens a typed principal destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    viewModel.openCancellation()
    assertEquals(CustomerRoute.Cancellation, viewModel.route.value)
  }

  @Test
  fun `official resale lifecycle opens a typed principal destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    viewModel.openResaleLifecycle()
    assertEquals(CustomerRoute.ResaleLifecycle, viewModel.route.value)
  }

  @Test
  fun `trusted device opens a typed fail closed destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    viewModel.openTrustedDevice()
    assertEquals(CustomerRoute.TrustedDevice, viewModel.route.value)
  }

  @Test
  fun `push notifications open a typed fail closed destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    viewModel.openPushNotifications()
    assertEquals(CustomerRoute.PushNotifications, viewModel.route.value)
  }

  @Test
  fun `inquiry opens a typed principal destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    viewModel.openInquiry()
    assertEquals(CustomerRoute.Inquiry, viewModel.route.value)
  }

  @Test
  fun `inquiry loads history and publishes only the server created thread`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(
      inquiryValue = listOf(supportThread("thread-old", "기존 문의")),
    )
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()

    viewModel.openInquiry()
    advanceUntilIdle()
    assertEquals("기존 문의", (viewModel.inquiries.value as AsyncContent.Ready).value.single().subject)

    viewModel.submitInquiry("새 문의", "서버에서 확인해 주세요.")
    advanceUntilIdle()

    assertEquals("새 문의", repository.createdInquirySubject)
    assertEquals("새 문의", (viewModel.inquiries.value as AsyncContent.Ready).value.first().subject)
  }
}

private class FakeCustomerRepository(
  var homeError: Throwable? = null,
  private val accountError: Throwable? = null,
  private val accountValue: AccountOverview = AccountOverview(true),
  private val bookError: Throwable? = null,
  private val inquiryValue: List<SupportThread> = emptyList(),
) : CustomerRepository {
  val homeValue = HomeContent(listOf(event()), emptyList(), emptyList(), emptyList())
  var bookedSeatId: String? = null
  var trustCalls = 0
  var pushCalls = 0
  var qrTicketId: String? = null
  var completedPaymentKey: String? = null
  var watchlistedEventId: String? = null
  var createdInquirySubject: String? = null

  override suspend fun home(): HomeContent = homeError?.let { throw it } ?: homeValue
  override suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap = seatMapFixture()
  override suspend fun watchlist(): List<WatchlistItem> = emptyList()
  override suspend fun accountOverview(): AccountOverview = accountError?.let { throw it } ?: accountValue
  override suspend fun book(performanceDateId: String, seatId: String, seatLabel: String, amount: Int): BookingProgress {
    bookError?.let { throw it }
    bookedSeatId = seatId
    return BookingProgress.Held(
      seatId,
      seatLabel,
      amount,
      TossCheckoutRequest("draft-1", "ticket-1", seatLabel, amount + 2_000, TossPaymentMethod.CREDIT_CARD, "client-key", "payment-key"),
    )
  }
  override suspend fun requestCancellation(ticketId: String, reason: String) = Unit
  override suspend fun listForResale(ticketId: String, price: Int) = Unit
  override suspend fun addToWatchlist(eventId: String) { watchlistedEventId = eventId }
  override suspend fun supportThreads(): List<SupportThread> = inquiryValue
  override suspend fun createSupportThread(subject: String, message: String): SupportThread {
    createdInquirySubject = subject
    return supportThread("thread-new", subject)
  }
  override suspend fun trustThisDevice() { trustCalls += 1 }
  override suspend fun registerPush() { pushCalls += 1 }
  override suspend fun issueAdmissionQr(ticketId: String): AdmissionQr {
    qrTicketId = ticketId
    return admissionQr(ticketId)
  }
  override suspend fun completeCheckout(
    request: TossCheckoutRequest,
    result: TossWidgetResult,
  ): CheckoutOutcome {
    completedPaymentKey = (result as TossWidgetResult.Success).paymentKey
    return CheckoutOutcome.Confirmed(
      OwnedTicket(
        "ticket-1", "event-1", "performance-1", "zone-a", "A구역 1열 1번", "OWNED", false,
        120000, 120000, 120000, 0, 1,
      ),
    )
  }

  private fun event() = CatalogEvent(
    id = "event-1",
    title = "서울 콘서트",
    venueId = "venue-1",
    venue = "잠실주경기장",
    artistSlug = "artist-1",
    casts = listOf("테스트 아티스트"),
    soldCount = 42,
  )

  private fun admissionQr(ticketId: String) = AdmissionQr(
    "ADMISSION", ticketId, "account-1", "2099-01-01T00:00:00Z", "nonce", "signature",
    "2026-08-12T00:00:00Z", "2026-08-20T10:00:00Z", "2026-08-19T10:00:00Z",
    "2026-08-20T07:00:00Z", 30, "TRACE", "APP",
  )
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

private fun supportThread(id: String, subject: String) = SupportThread(
  id = id,
  subject = subject,
  status = DisplayStatus.OPEN,
  updatedAt = "2026-08-17T00:00:00Z",
  messages = emptyList(),
)

private fun accountOverview(twoTickets: Boolean = false): AccountOverview = AccountOverview(
  signedIn = true,
  tickets = buildList {
    add(
    AccountTicketOverview("ticket-1", "서울 콘서트", "A구역 1열 1번", true, 80_000, 120_000, "입장 가능"),
    )
    if (twoTickets) add(
      AccountTicketOverview("ticket-2", "부산 콘서트", "B구역 2열 2번", true, 70_000, 110_000, "입장 가능")
    )
  },
  trustedDevice = true,
)
