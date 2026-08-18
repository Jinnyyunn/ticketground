package kr.ticketground.app.ui

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kr.ticketground.app.data.AccountSession
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
import kr.ticketground.app.data.SecurityStatus
import kr.ticketground.app.data.AdmissionQr
import kr.ticketground.app.data.DisplayStatus
import kr.ticketground.app.data.SupportThread
import kr.ticketground.app.AppDestination
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
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
  fun `successful native login refreshes both mypage and watchlist and returns from the login screen`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    // Given: the user opened the login screen from the home header (any screen works the same way
    // -- watchlist and mypage below are the two screens whose state actually depends on the
    // session that login establishes).
    viewModel.openLoginScreen()
    advanceUntilIdle()
    assertEquals(CustomerRoute.Login, viewModel.route.value)

    // When: native login completes successfully.
    viewModel.completeNativeLogin("kakao", "one-use-code")
    advanceUntilIdle()

    // Then: the repository received the provider/code pair,
    assertEquals(listOf("kakao" to "one-use-code"), repository.nativeLoginRequests)
    // both account-scoped screens that were signed-out until this moment are refreshed without a
    // manual pull-to-refresh (loadAccount() alone was not enough -- watchlist has its own
    // independent signed-out state, see CustomerApp.kt's loadWatchlist()/loadAccount() comment),
    assertEquals(1, repository.watchlistCalls)
    assertTrue((viewModel.account.value as AsyncContent.Ready).value.signedIn)
    // and the login screen itself is left automatically, back to wherever the user came from.
    assertEquals(CustomerRoute.Tab, viewModel.route.value)
    assertEquals("로그인되었습니다.", viewModel.actionMessage.value)
  }

  @Test
  fun `failed native login keeps the login screen open and surfaces a message`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(nativeLoginError = ApiError.Transport(java.io.IOException("offline")))
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    viewModel.openLoginScreen()
    advanceUntilIdle()

    viewModel.completeNativeLogin("naver", "one-use-code")
    advanceUntilIdle()

    assertEquals(CustomerRoute.Login, viewModel.route.value)
    assertEquals("네트워크 연결을 확인한 뒤 다시 시도해 주세요.", viewModel.actionMessage.value)
    assertEquals(0, repository.watchlistCalls)
  }

  // --- logOut(): P0-3, operator-requested addition to the protected login/session boundary. ---

  @Test
  fun `logOut clears the session and every signed-in scoped state, returning to home`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(accountValue = accountOverview())
    val viewModel = CustomerAppViewModel(repository)
    viewModel.navigate(AppDestination.MyPage)
    advanceUntilIdle()
    assertTrue((viewModel.account.value as AsyncContent.Ready).value.signedIn)
    viewModel.issueAdmissionQr()
    advanceUntilIdle()
    assertTrue(viewModel.admissionQr.value != null)

    viewModel.logOut()
    advanceUntilIdle()

    assertEquals(1, repository.logOutCalls)
    assertFalse((viewModel.account.value as AsyncContent.Ready).value.signedIn)
    assertFalse((viewModel.watchlist.value as AsyncContent.Ready).value.signedIn)
    assertEquals(null, viewModel.admissionQr.value)
    assertEquals(AppDestination.Home, viewModel.destination.value)
    assertEquals(CustomerRoute.Tab, viewModel.route.value)
    assertEquals("로그아웃되었습니다.", viewModel.actionMessage.value)
  }

  @Test
  fun `logOut still clears local state even if the repository call fails`() = runTest(dispatcher) {
    // The biometric lock screen's logout escape hatch must work for a user who can no longer
    // authenticate at all -- it cannot depend on a network call succeeding first.
    val repository = FakeCustomerRepository(logOutError = IllegalStateException("boom"))
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()

    viewModel.logOut()
    advanceUntilIdle()

    assertEquals(1, repository.logOutCalls)
    assertFalse((viewModel.account.value as AsyncContent.Ready).value.signedIn)
    assertEquals(AppDestination.Home, viewModel.destination.value)
  }

  // --- actionMessage no longer bleeds across unrelated screens: P1-4. ---

  @Test
  fun `pushing a new route clears a stale action message left by the previous screen`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    viewModel.addToWatchlist(repository.homeValue.events.single())
    advanceUntilIdle()
    assertEquals("관심공연에 추가했습니다.", viewModel.actionMessage.value)

    viewModel.openCalendar()

    assertEquals(null, viewModel.actionMessage.value)
  }

  @Test
  fun `switching tabs clears a stale action message left by the previous screen`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    viewModel.addToWatchlist(repository.homeValue.events.single())
    advanceUntilIdle()
    assertEquals("관심공연에 추가했습니다.", viewModel.actionMessage.value)

    viewModel.navigate(AppDestination.Search)

    assertEquals(null, viewModel.actionMessage.value)
  }

  @Test
  fun `back navigation clears a stale action message left by the screen just left`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(accountValue = accountOverview())
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    viewModel.openCancellation()
    advanceUntilIdle()
    viewModel.requestCancellation("사유")
    advanceUntilIdle()
    assertEquals("취소 요청이 접수되어 검토 중입니다.", viewModel.actionMessage.value)

    viewModel.closeRoute()

    assertEquals(null, viewModel.actionMessage.value)
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
  fun `missing Toss configuration opens observable fail closed booking error`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(bookError = CheckoutError.ProviderUnavailable)
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")

    viewModel.book(event, "performance-1")
    advanceUntilIdle()

    val progress = (viewModel.route.value as CustomerRoute.Booking).progress as BookingProgress.Error
    assertEquals("Toss Payments 설정을 확인할 수 없어 결제를 시작하지 않았습니다.", progress.message)
  }

  @Test
  fun `ranking opens a typed ranking destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(discoveryError = ApiError.Transport(java.io.IOException("offline")))
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()

    viewModel.openRanking(repository.homeValue.events)
    advanceUntilIdle()
    assertTrue(viewModel.discovery.value is AsyncContent.Error)

    repository.discoveryError = null
    viewModel.retryDiscovery()
    advanceUntilIdle()

    assertEquals(CustomerRoute.Ranking, viewModel.route.value)
    assertEquals("서울 콘서트", (viewModel.discovery.value as AsyncContent.Ready).value.single().title)
    assertEquals(2, repository.rankingCalls)
  }

  @Test
  fun `region discovery opens a typed region destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()

    viewModel.openRegion("서울", repository.homeValue.events)

    advanceUntilIdle()
    assertEquals(CustomerRoute.Region("서울"), viewModel.route.value)
  }

  @Test
  fun `venue discovery opens a typed venue destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openVenue(event)

    advanceUntilIdle()
    assertEquals(CustomerRoute.Venue(event.venueId, event.venue), viewModel.route.value)
  }

  @Test
  fun `artist discovery opens a typed artist destination`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openArtist(event)

    advanceUntilIdle()
    assertEquals(CustomerRoute.Artist(event.artistSlug, event.casts.orEmpty()), viewModel.route.value)
  }

  @Test
  fun `late ranking success cannot replace newer artist discovery`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val ranking = repository.deferRanking()
    val artist = repository.deferArtist()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openRanking(repository.homeValue.events)
    runCurrent()
    viewModel.openArtist(event)
    runCurrent()
    artist.complete(listOf(event.copy(title = "최신 아티스트 공연")))
    runCurrent()
    ranking.complete(listOf(event.copy(title = "오래된 랭킹 공연")))
    advanceUntilIdle()

    assertEquals(CustomerRoute.Artist(event.artistSlug, event.casts.orEmpty()), viewModel.route.value)
    assertEquals("최신 아티스트 공연", (viewModel.discovery.value as AsyncContent.Ready).value.single().title)
  }

  @Test
  fun `late ranking error cannot replace newer artist discovery`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val ranking = repository.deferRanking()
    val artist = repository.deferArtist()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openRanking(repository.homeValue.events)
    runCurrent()
    viewModel.openArtist(event)
    runCurrent()
    artist.complete(listOf(event.copy(title = "최신 아티스트 공연")))
    runCurrent()
    ranking.completeExceptionally(ApiError.Transport(java.io.IOException("late offline")))
    advanceUntilIdle()

    assertEquals(CustomerRoute.Artist(event.artistSlug, event.casts.orEmpty()), viewModel.route.value)
    assertEquals("최신 아티스트 공연", (viewModel.discovery.value as AsyncContent.Ready).value.single().title)
  }

  @Test
  fun `late initial completion cannot replace ranking retry generation`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val initial = repository.deferRanking()
    val retry = repository.deferRanking()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()

    viewModel.openRanking(repository.homeValue.events)
    runCurrent()
    viewModel.retryDiscovery()
    runCurrent()
    retry.complete(listOf(event.copy(title = "재시도 랭킹 공연")))
    runCurrent()
    initial.complete(listOf(event.copy(title = "오래된 최초 공연")))
    advanceUntilIdle()

    assertEquals(CustomerRoute.Ranking, viewModel.route.value)
    assertEquals("재시도 랭킹 공연", (viewModel.discovery.value as AsyncContent.Ready).value.single().title)
  }

  @Test
  fun `booking progress opens a typed queue hold and draft destination`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())
    advanceUntilIdle()
    val progress = BookingProgress.Waiting("queue-1", 3)

    viewModel.openBooking(progress)

    assertEquals(CustomerRoute.Booking(progress), viewModel.route.value)
  }

  @Test
  fun `waiting refresh advances on observed admission and rejects a rapid duplicate`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val initial = repository.deferBooking()
    val refresh = repository.deferBookingRefresh()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")
    viewModel.book(event, "performance-1")
    initial.complete(BookingProgress.Waiting("queue-1", 3))
    advanceUntilIdle()
    val originalRequest = repository.bookingRequests.single()

    viewModel.refreshBooking()
    assertTrue(viewModel.bookingPending.value)
    viewModel.refreshBooking()
    runCurrent()

    assertEquals(1, repository.bookingRefreshCalls)
    assertEquals(listOf("queue-1"), repository.refreshedQueueIds)
    assertSame(originalRequest, repository.bookingRefreshRequests.single())
    refresh.complete(repository.heldBooking())
    advanceUntilIdle()
    assertTrue((viewModel.route.value as CustomerRoute.Booking).progress is BookingProgress.Held)
  }

  @Test
  fun `waiting refresh failure publishes a fail closed booking error`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(refreshBookingError = ApiError.Transport(java.io.IOException("offline")))
    val initial = repository.deferBooking()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")
    viewModel.book(event, "performance-1")
    initial.complete(BookingProgress.Waiting("queue-1", 3))
    advanceUntilIdle()

    viewModel.refreshBooking()
    advanceUntilIdle()

    assertTrue((viewModel.route.value as CustomerRoute.Booking).progress is BookingProgress.Error)
    assertEquals(1, repository.bookingRefreshCalls)
  }

  @Test
  fun `booking failure is observable and retry never fabricates success`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(bookError = ApiError.Transport(java.io.IOException("offline")))
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")

    viewModel.book(event, "performance-1")
    advanceUntilIdle()
    assertTrue((viewModel.route.value as CustomerRoute.Booking).progress is BookingProgress.Error)

    repository.bookError = null
    viewModel.retryBooking()
    advanceUntilIdle()
    assertTrue((viewModel.route.value as CustomerRoute.Booking).progress is BookingProgress.Held)
    assertEquals(2, repository.bookCalls)
  }

  @Test
  fun `rapid repeated booking retry is a no-op and preserves the admitted request`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(bookError = ApiError.Transport(java.io.IOException("offline")))
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")
    viewModel.book(event, "performance-1")
    advanceUntilIdle()
    val admittedRequest = repository.bookingRequests.single()
    repository.bookError = null
    val retry = repository.deferBooking()

    viewModel.retryBooking()
    assertTrue(viewModel.bookingPending.value)
    viewModel.retryBooking()
    runCurrent()

    assertEquals(2, repository.bookCalls)
    assertEquals(2, repository.bookingRequests.size)
    assertSame(admittedRequest, repository.bookingRequests[1])
    retry.completeExceptionally(ApiError.Transport(java.io.IOException("still offline")))
    advanceUntilIdle()
    assertTrue(!viewModel.bookingPending.value)

    viewModel.retryBooking()
    advanceUntilIdle()

    assertEquals(3, repository.bookCalls)
    assertSame(admittedRequest, repository.bookingRequests[2])
  }

  @Test
  fun `rapid repeated initial booking preserves the admitted request through retry`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val firstBooking = repository.deferBooking()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")

    viewModel.book(event, "performance-1")
    viewModel.book(event, "performance-1")
    runCurrent()

    assertTrue(viewModel.bookingPending.value)
    assertEquals(1, repository.bookCalls)
    assertEquals(1, repository.bookingRequests.size)
    val admittedRequest = repository.bookingRequests.single()

    firstBooking.completeExceptionally(ApiError.Transport(java.io.IOException("offline")))
    advanceUntilIdle()
    assertTrue((viewModel.route.value as CustomerRoute.Booking).progress is BookingProgress.Error)

    viewModel.retryBooking()
    advanceUntilIdle()

    assertEquals(2, repository.bookCalls)
    assertSame(admittedRequest, repository.bookingRequests[1])
    assertSame(admittedRequest.operationKeys, repository.bookingRequests[1].operationKeys)
  }

  @Test
  fun `retry reuses the same booking operation identities`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(bookError = ApiError.Transport(java.io.IOException("offline")))
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")

    viewModel.book(event, "performance-1")
    advanceUntilIdle()
    viewModel.retryBooking()
    advanceUntilIdle()

    assertSame(repository.bookingRequests[0].operationKeys, repository.bookingRequests[1].operationKeys)
  }

  @Test
  fun `new booking attempt creates fresh operation identities for the same seat`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository(bookError = ApiError.Transport(java.io.IOException("offline")))
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")

    viewModel.book(event, "performance-1")
    advanceUntilIdle()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")
    viewModel.book(event, "performance-1")
    advanceUntilIdle()

    assertNotSame(repository.bookingRequests[0].operationKeys, repository.bookingRequests[1].operationKeys)
  }

  @Test
  fun `late booking completion cannot reopen a route the user closed`() = runTest(dispatcher) {
    val repository = FakeCustomerRepository()
    val booking = repository.deferBooking()
    val viewModel = CustomerAppViewModel(repository)
    advanceUntilIdle()
    val event = repository.homeValue.events.single()
    viewModel.openSeatMap(event, "performance-1")
    advanceUntilIdle()
    viewModel.selectSeat("seat-a1")

    viewModel.book(event, "performance-1")
    runCurrent()
    viewModel.closeRoute()
    booking.complete(repository.heldBooking())
    advanceUntilIdle()

    assertEquals(CustomerRoute.Tab, viewModel.route.value)
    assertTrue(!viewModel.bookingPending.value)
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
  fun `closing a tab destination restores home instead of exiting the activity`() = runTest(dispatcher) {
    val viewModel = CustomerAppViewModel(FakeCustomerRepository())

    viewModel.navigate(AppDestination.Search)
    viewModel.closeRoute()

    assertEquals(AppDestination.Home, viewModel.destination.value)
    assertEquals(CustomerRoute.Tab, viewModel.route.value)
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
  var bookError: Throwable? = null,
  var discoveryError: Throwable? = null,
  private var refreshBookingError: Throwable? = null,
  private val inquiryValue: List<SupportThread> = emptyList(),
  private var nativeLoginError: Throwable? = null,
  private var logOutError: Throwable? = null,
) : CustomerRepository {
  var logOutCalls = 0
  val homeValue = HomeContent(listOf(event()), emptyList(), emptyList(), emptyList())
  private val rankingDeferreds = ArrayDeque<CompletableDeferred<List<CatalogEvent>>>()
  private val artistDeferreds = ArrayDeque<CompletableDeferred<List<CatalogEvent>>>()
  private val bookingDeferreds = ArrayDeque<CompletableDeferred<BookingProgress>>()
  private val bookingRefreshDeferreds = ArrayDeque<CompletableDeferred<BookingProgress>>()
  var bookedSeatId: String? = null
  var trustCalls = 0
  var pushCalls = 0
  var watchlistCalls = 0
  val nativeLoginRequests = mutableListOf<Pair<String, String>>()
  var qrTicketId: String? = null
  var completedPaymentKey: String? = null
  var watchlistedEventId: String? = null
  var createdInquirySubject: String? = null
  var rankingCalls = 0
  var bookCalls = 0
  var bookingRefreshCalls = 0
  val bookingRequests = mutableListOf<BookingRequest>()
  val bookingRefreshRequests = mutableListOf<BookingRequest>()
  val refreshedQueueIds = mutableListOf<String>()

  fun deferRanking() = CompletableDeferred<List<CatalogEvent>>().also(rankingDeferreds::addLast)
  fun deferArtist() = CompletableDeferred<List<CatalogEvent>>().also(artistDeferreds::addLast)
  fun deferBooking() = CompletableDeferred<BookingProgress>().also(bookingDeferreds::addLast)
  fun deferBookingRefresh() = CompletableDeferred<BookingProgress>().also(bookingRefreshDeferreds::addLast)
  fun heldBooking() = BookingProgress.Held(
    "seat-a1",
    "A구역 1열 1번",
    120_000,
    TossCheckoutRequest(
      "draft-1", "ticket-1", "A구역 1열 1번", 122_000,
      TossPaymentMethod.CREDIT_CARD, "client-key", "payment-key",
    ),
  )

  override suspend fun home(): HomeContent = homeError?.let { throw it } ?: homeValue
  override suspend fun ranking(): List<CatalogEvent> {
    rankingCalls += 1
    if (rankingDeferreds.isNotEmpty()) return rankingDeferreds.removeFirst().await()
    discoveryError?.let { throw it }
    return homeValue.events
  }
  override suspend fun region(name: String): List<CatalogEvent> = discovery()
  override suspend fun venue(venueId: String?, venueName: String): List<CatalogEvent> = discovery()
  override suspend fun artist(artistSlug: String?, artistNames: List<String>): List<CatalogEvent> {
    if (artistDeferreds.isNotEmpty()) return artistDeferreds.removeFirst().await()
    return discovery()
  }
  private fun discovery(): List<CatalogEvent> {
    discoveryError?.let { throw it }
    return homeValue.events
  }
  override suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap = seatMapFixture()
  override suspend fun watchlist(): List<WatchlistItem> {
    watchlistCalls += 1
    return emptyList()
  }
  override suspend fun completeNativeLogin(provider: String, code: String): AccountSession {
    nativeLoginRequests += provider to code
    nativeLoginError?.let { throw it }
    return AccountSession("account-1", "테스트 사용자", SecurityStatus.ACTIVE, 90, true)
  }
  override suspend fun accountOverview(): AccountOverview = accountError?.let { throw it } ?: accountValue
  override suspend fun logOut() {
    logOutCalls += 1
    logOutError?.let { throw it }
  }
  override suspend fun book(request: BookingRequest): BookingProgress {
    bookCalls += 1
    bookingRequests += request
    if (bookingDeferreds.isNotEmpty()) return bookingDeferreds.removeFirst().await()
    bookError?.let { throw it }
    bookedSeatId = request.seatId
    return heldBooking()
  }
  override suspend fun refreshBooking(request: BookingRequest, entryId: String): BookingProgress {
    bookingRefreshCalls += 1
    bookingRefreshRequests += request
    refreshedQueueIds += entryId
    if (bookingRefreshDeferreds.isNotEmpty()) return bookingRefreshDeferreds.removeFirst().await()
    refreshBookingError?.let { throw it }
    return heldBooking()
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
