package kr.ticketground.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kr.ticketground.app.AppDestination
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.CheckoutOutcome
import kr.ticketground.app.data.TossCheckoutRequest
import kr.ticketground.app.data.TossWidgetResult
import kr.ticketground.app.data.AdmissionQr
import kr.ticketground.app.data.SupportThread

sealed interface CustomerRoute {
  data object Tab : CustomerRoute
  data object Login : CustomerRoute
  data class Event(val event: CatalogEvent) : CustomerRoute
  data class Collection(val title: String, val events: List<CatalogEvent>) : CustomerRoute
  data object Ranking : CustomerRoute
  data class Region(val name: String) : CustomerRoute
  data class Venue(val venueId: String?, val venueName: String) : CustomerRoute
  data class Artist(val artistSlug: String?, val artistNames: List<String>) : CustomerRoute
  data object OpenCalendar : CustomerRoute
  data object Resale : CustomerRoute
  data class SeatMapRoute(val event: CatalogEvent, val performanceDateId: String?) : CustomerRoute
  data class Booking(val progress: BookingProgress) : CustomerRoute
  data class Checkout(val seatLabel: String, val amount: Int, val request: TossCheckoutRequest) : CustomerRoute
  data object Support : CustomerRoute
  data object Reservation : CustomerRoute
  data object Cancellation : CustomerRoute
  data object ResaleLifecycle : CustomerRoute
  data object TrustedDevice : CustomerRoute
  data object PushNotifications : CustomerRoute
  data object Inquiry : CustomerRoute
}

private data class NavSnapshot(val destination: AppDestination, val route: CustomerRoute)

class CustomerAppViewModel(private val repository: CustomerRepository) : ViewModel() {
  private val mutableDestination = MutableStateFlow(AppDestination.Home)
  val destination = mutableDestination.asStateFlow()
  private val mutableSearchQuery = MutableStateFlow("")
  val searchQuery = mutableSearchQuery.asStateFlow()
  private val mutableRoute = MutableStateFlow<CustomerRoute>(CustomerRoute.Tab)
  val route = mutableRoute.asStateFlow()
  private val backStack = ArrayDeque<NavSnapshot>()
  private val mutableCanGoBack = MutableStateFlow(false)
  val canGoBack = mutableCanGoBack.asStateFlow()
  private val mutableHome = MutableStateFlow<AsyncContent<HomeContent>>(AsyncContent.Loading)
  val home = mutableHome.asStateFlow()
  private val mutableSeatMap = MutableStateFlow<AsyncContent<SeatMap>>(AsyncContent.Loading)
  val seatMap = mutableSeatMap.asStateFlow()
  private val mutableDiscovery = MutableStateFlow<AsyncContent<List<CatalogEvent>>>(AsyncContent.Loading)
  val discovery = mutableDiscovery.asStateFlow()
  private val mutableWatchlist = MutableStateFlow<AsyncContent<WatchlistOverview>>(AsyncContent.Loading)
  val watchlist = mutableWatchlist.asStateFlow()
  private val mutableAccount = MutableStateFlow<AsyncContent<AccountOverview>>(AsyncContent.Loading)
  val account = mutableAccount.asStateFlow()
  private val mutableSelectedSeatId = MutableStateFlow<String?>(null)
  val selectedSeatId = mutableSelectedSeatId.asStateFlow()
  private val mutableHeldSeatIds = MutableStateFlow<Set<String>>(emptySet())
  val heldSeatIds = mutableHeldSeatIds.asStateFlow()
  private val mutableBookingPending = MutableStateFlow(false)
  val bookingPending = mutableBookingPending.asStateFlow()
  private val mutableActionMessage = MutableStateFlow<String?>(null)
  val actionMessage = mutableActionMessage.asStateFlow()
  private val mutableAdmissionQr = MutableStateFlow<AdmissionQr?>(null)
  val admissionQr = mutableAdmissionQr.asStateFlow()
  private val mutableInquiries = MutableStateFlow<AsyncContent<List<SupportThread>>>(AsyncContent.Loading)
  val inquiries = mutableInquiries.asStateFlow()
  private var lastBookingAttempt: BookingAttempt? = null
  private var bookingGeneration = 0L
  private var discoveryGeneration = 0L
  private var navigationListener: ((AppDestination, CustomerRoute) -> Unit)? = null

  init { loadHome() }

  /**
   * Optional hook the Compose layer uses to mirror route/destination changes into the real
   * NavController back stack (see TicketGroundCustomerApp). Invoked synchronously from inside
   * the same function call that mutates [route]/[destination] -- not from a recomposition-driven
   * effect -- so NavController is always updated in the exact same call frame as the ViewModel
   * state, regardless of whether the caller is a UI click, a test calling a ViewModel method
   * directly, or a coroutine callback (booking progress advancing after a network call). Relying
   * purely on Compose recomposition to notice the state change and react a pass later was flaky
   * under device load in practice.
   */
  fun setNavigationListener(listener: (AppDestination, CustomerRoute) -> Unit) {
    navigationListener = listener
  }

  private fun notifyNavigation() {
    navigationListener?.invoke(mutableDestination.value, mutableRoute.value)
  }

  /**
   * Minimal manual back stack for the hand-rolled navigator (interim fix ahead of the Phase 2
   * NavHost migration). Every forward navigation pushes the state it is leaving so the system
   * back button can step out one screen at a time instead of jumping straight to a tab root or
   * exiting the app.
   */
  private fun pushSnapshot() {
    backStack.addLast(NavSnapshot(mutableDestination.value, mutableRoute.value))
    mutableCanGoBack.value = true
  }

  private fun pushRoute(newRoute: CustomerRoute) {
    if (mutableRoute.value != newRoute) pushSnapshot()
    mutableRoute.value = newRoute
    // A message set on the screen being left (an error, a success toast) is about that screen's
    // action, not the one being entered -- ~10 screens read this same shared actionMessage
    // StateFlow (see CustomerApp.kt's NavHost composables), so without clearing it here a stale
    // message keeps bleeding forward across every unrelated screen the user visits next until
    // some other action happens to overwrite it. completeNativeLogin()'s success message is the
    // one deliberate exception: it sets the message and then calls returnFromLogin() directly
    // (not pushRoute()), so that carry-forward keeps working.
    mutableActionMessage.value = null
    notifyNavigation()
  }

  fun navigate(destination: AppDestination) {
    if (mutableDestination.value != destination || mutableRoute.value != CustomerRoute.Tab) {
      pushSnapshot()
    }
    mutableDestination.value = destination
    mutableRoute.value = CustomerRoute.Tab
    mutableActionMessage.value = null // see pushRoute()'s comment -- same reasoning for tab switches
    notifyNavigation()
    when (destination) {
      AppDestination.Home, AppDestination.Search -> if (mutableHome.value is AsyncContent.Error) loadHome()
      AppDestination.Watchlist -> loadWatchlist()
      AppDestination.MyPage -> loadAccount()
    }
  }

  /**
   * Opens the dedicated login screen as a normal pushed route (unlike the AlertDialog it
   * replaced, this participates in the same back stack as every other screen -- system back
   * closes it like anything else).
   */
  fun openLoginScreen() { pushRoute(CustomerRoute.Login) }

  /**
   * Returns from the login screen to whatever screen was showing before it was opened. Distinct
   * from [closeRoute]: that one is deliberately UI-driven (paired with the Compose layer's own
   * NavController.popBackStack() call from the hardware back handler -- see its doc comment).
   * This one fires from inside a coroutine after an async login completes, with no UI-layer pop
   * counterpart, so it mirrors the forward-navigation convention instead and calls
   * [notifyNavigation] itself so NavHost follows.
   */
  private fun returnFromLogin() {
    val previous = backStack.removeLastOrNull() ?: return
    mutableDestination.value = previous.destination
    mutableRoute.value = previous.route
    mutableCanGoBack.value = backStack.isNotEmpty()
    notifyNavigation()
  }

  fun openCategory(category: String) {
    mutableSearchQuery.value = category
    navigate(AppDestination.Search)
  }

  fun loadHome() = viewModelScope.launch {
    mutableHome.value = AsyncContent.Loading
    mutableHome.value = runCatching { repository.home() }.fold(
      onSuccess = { if (it.events.isEmpty()) AsyncContent.Empty("공연이 없습니다", "새로운 공연이 등록되면 알려드릴게요.") else AsyncContent.Ready(it) },
      onFailure = { AsyncContent.Error(safeUiMessage(it)) },
    )
  }

  fun openEvent(event: CatalogEvent) { pushRoute(CustomerRoute.Event(event)) }

  /**
   * Entry point for App Links / deep links that only carry an event slug or id (e.g. a shared
   * `https://ticketground.co.kr/booking/{slug}` URL opened cold, before the catalog has loaded).
   * Looks the event up in whatever catalog is already cached, otherwise fetches it fresh; falls
   * back to the home tab rather than failing closed if the event can't be resolved.
   */
  fun openEventDeepLink(slugOrId: String) = viewModelScope.launch {
    val cached = (mutableHome.value as? AsyncContent.Ready)?.value?.events
      ?.firstOrNull { it.slug == slugOrId || it.id == slugOrId }
    val event = cached ?: runCatching { repository.home() }.getOrNull()?.events
      ?.firstOrNull { it.slug == slugOrId || it.id == slugOrId }
    if (event != null) openEvent(event) else navigate(AppDestination.Home)
  }

  /** Deep link entry point for the `/watchlist` web route. */
  fun openWatchlistDeepLink() { navigate(AppDestination.Watchlist) }

  fun openCollection(title: String, events: List<CatalogEvent>) {
    pushRoute(CustomerRoute.Collection(title, events))
  }

  fun openRanking(events: List<CatalogEvent>) {
    pushRoute(CustomerRoute.Ranking)
    loadDiscovery { repository.ranking() }
  }

  fun openRegion(name: String, events: List<CatalogEvent>) {
    pushRoute(CustomerRoute.Region(name))
    loadDiscovery { repository.region(name) }
  }

  fun openVenue(event: CatalogEvent) {
    pushRoute(CustomerRoute.Venue(event.venueId, event.venue))
    loadDiscovery { repository.venue(event.venueId, event.venue) }
  }

  fun openArtist(event: CatalogEvent) {
    val names = event.casts.orEmpty()
    pushRoute(CustomerRoute.Artist(event.artistSlug, names))
    loadDiscovery { repository.artist(event.artistSlug, names) }
  }

  fun retryDiscovery() {
    when (val current = mutableRoute.value) {
      CustomerRoute.Ranking -> loadDiscovery { repository.ranking() }
      is CustomerRoute.Region -> loadDiscovery { repository.region(current.name) }
      is CustomerRoute.Venue -> loadDiscovery { repository.venue(current.venueId, current.venueName) }
      is CustomerRoute.Artist -> loadDiscovery { repository.artist(current.artistSlug, current.artistNames) }
      else -> Unit
    }
  }

  private fun loadDiscovery(block: suspend () -> List<CatalogEvent>) {
    val generation = ++discoveryGeneration
    viewModelScope.launch {
      mutableDiscovery.value = AsyncContent.Loading
      val content = runCatching { block() }.fold(
        onSuccess = { if (it.isEmpty()) AsyncContent.Empty("공연이 없습니다", "다른 조건을 확인해 주세요.") else AsyncContent.Ready(it) },
        onFailure = { AsyncContent.Error(safeUiMessage(it)) },
      )
      if (generation == discoveryGeneration) mutableDiscovery.value = content
    }
  }

  fun openBooking(progress: BookingProgress) {
    // Progress updates within an already-open booking flow (waiting -> held -> retry) replace the
    // current screen in place; only the first transition into the booking flow is pushed, so a
    // single back press returns to the seat map instead of stepping through every queue poll.
    if (mutableRoute.value !is CustomerRoute.Booking) pushSnapshot()
    mutableRoute.value = CustomerRoute.Booking(progress)
    notifyNavigation()
  }

  fun openReservation() { openAccountRoute(CustomerRoute.Reservation) }
  fun openCancellation() { openAccountRoute(CustomerRoute.Cancellation) }
  fun openResaleLifecycle() { openAccountRoute(CustomerRoute.ResaleLifecycle) }
  fun openTrustedDevice() { openAccountRoute(CustomerRoute.TrustedDevice) }
  fun openPushNotifications() { openAccountRoute(CustomerRoute.PushNotifications) }
  fun openInquiry() {
    openAccountRoute(CustomerRoute.Inquiry)
    loadInquiries()
  }

  private fun openAccountRoute(route: CustomerRoute) {
    pushRoute(route)
    if (mutableAccount.value is AsyncContent.Loading || mutableAccount.value is AsyncContent.Error) loadAccount()
  }

  fun openCalendar() { pushRoute(CustomerRoute.OpenCalendar) }

  fun openResale() { pushRoute(CustomerRoute.Resale) }

  fun closeRoute() {
    // Deliberately does NOT call notifyNavigation(): the Compose layer's BackHandler already
    // pops the NavController's own back stack explicitly (a real pop, restoring whatever entry
    // was already there) right alongside this call. Calling the listener here too would instead
    // navigate() to the previous route's key -- pushing a fresh/duplicate entry instead of
    // popping -- which fights the BackHandler's own pop for the same back-press.
    if (mutableBookingPending.value) bookingGeneration += 1
    val previous = backStack.removeLastOrNull()
    if (previous != null) {
      mutableDestination.value = previous.destination
      mutableRoute.value = previous.route
      // Same reasoning as pushRoute()/navigate(): back navigation leaves the current screen too,
      // and several of the screens a back-press can land on (e.g. mypage) read this same shared
      // actionMessage StateFlow, so an uncleared message from the screen just left would bleed
      // backward onto whatever screen the user returns to.
      mutableActionMessage.value = null
    }
    mutableCanGoBack.value = backStack.isNotEmpty()
  }

  fun addToWatchlist(event: CatalogEvent) = viewModelScope.launch {
    if (mutableBookingPending.value) return@launch
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { repository.addToWatchlist(event.id) }
      .onSuccess { mutableActionMessage.value = "관심공연에 추가했습니다." }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
    mutableBookingPending.value = false
  }

  fun openSeatMap(event: CatalogEvent, performanceDateId: String?) {
    bookingGeneration += 1
    lastBookingAttempt = null
    mutableSelectedSeatId.value = null
    mutableHeldSeatIds.value = emptySet()
    pushRoute(CustomerRoute.SeatMapRoute(event, performanceDateId))
    loadSeatMap(event.id, performanceDateId)
  }

  fun loadSeatMap(eventId: String, performanceDateId: String?) = viewModelScope.launch {
    mutableSeatMap.value = AsyncContent.Loading
    mutableHeldSeatIds.value = emptySet()
    mutableSeatMap.value = runCatching { repository.seatMap(eventId, performanceDateId) }.fold(
      onSuccess = { map ->
        mutableHeldSeatIds.value = map.seats.filter { it.status.equals("HELD", ignoreCase = true) }.mapTo(linkedSetOf()) { it.id }
        if (map.seats.none { it.mapPosition != null }) AsyncContent.Empty("좌석도가 비어 있습니다", "다른 회차를 확인해 주세요.")
        else AsyncContent.Ready(map)
      },
      onFailure = { AsyncContent.Error(safeUiMessage(it)) },
    )
  }

  fun selectSeat(seatId: String?) {
    if (!mutableBookingPending.value) mutableSelectedSeatId.value = seatId
  }

  fun book(event: CatalogEvent, performanceDateId: String?) {
    val map = (mutableSeatMap.value as? AsyncContent.Ready)?.value ?: return
    val seat = map.seats.firstOrNull { it.id == mutableSelectedSeatId.value && it.available } ?: return
    val performance = performanceDateId?.takeIf(String::isNotBlank)
    if (performance == null) {
      mutableActionMessage.value = "예매 회차를 확인할 수 없습니다. 공연 상세에서 회차를 다시 선택해 주세요."
      return
    }
    performBooking {
      BookingRequest.create(
        performance,
        seat.id,
        seat.displayCode.ifBlank { seat.label },
        seat.price,
      ).also { lastBookingAttempt = BookingAttempt(it) }
    }
  }

  fun retryBooking() {
    val attempt = lastBookingAttempt ?: return
    performBooking { attempt.request }
  }

  fun refreshBooking() {
    val waiting = (mutableRoute.value as? CustomerRoute.Booking)?.progress as? BookingProgress.Waiting ?: return
    val attempt = lastBookingAttempt ?: return
    if (!mutableBookingPending.compareAndSet(expect = false, update = true)) return
    val generation = ++bookingGeneration
    mutableActionMessage.value = null
    viewModelScope.launch {
      try {
        runCatching { repository.refreshBooking(attempt.request, waiting.entryId) }
          .onSuccess { progress ->
            if (generation != bookingGeneration) return@onSuccess
            when (progress) {
              is BookingProgress.Waiting -> openBooking(progress)
              is BookingProgress.Held -> {
                mutableHeldSeatIds.value = mutableHeldSeatIds.value + progress.seatId
                openBooking(progress)
              }
              is BookingProgress.Expired, is BookingProgress.Conflict, is BookingProgress.Error -> openBooking(progress)
            }
          }
          .onFailure {
            if (generation == bookingGeneration) openBooking(BookingProgress.Error(safeUiMessage(it)))
          }
      } finally {
        mutableBookingPending.value = false
      }
    }
  }

  private fun performBooking(requestFactory: () -> BookingRequest) {
    if (!mutableBookingPending.compareAndSet(expect = false, update = true)) return
    val request = requestFactory()
    val generation = ++bookingGeneration
    mutableActionMessage.value = null
    viewModelScope.launch {
      try {
        runCatching { repository.book(request) }
          .onSuccess { progress ->
            if (generation != bookingGeneration) return@onSuccess
            when (progress) {
              is BookingProgress.Waiting -> openBooking(progress)
              is BookingProgress.Held -> {
                mutableHeldSeatIds.value = mutableHeldSeatIds.value + progress.seatId
                openBooking(progress)
              }
              is BookingProgress.Expired, is BookingProgress.Conflict, is BookingProgress.Error -> openBooking(progress)
            }
          }
          .onFailure {
            if (generation == bookingGeneration) openBooking(BookingProgress.Error(safeUiMessage(it)))
          }
      } finally {
        mutableBookingPending.value = false
      }
    }
  }

  fun loadWatchlist() = viewModelScope.launch {
    mutableWatchlist.value = AsyncContent.Loading
    mutableWatchlist.value = runCatching { repository.watchlist() }.fold(
      onSuccess = {
        if (it.isEmpty()) AsyncContent.Empty("관심공연이 없습니다", "공연 상세에서 찜하기를 눌러보세요.")
        else AsyncContent.Ready(WatchlistOverview(signedIn = true, items = it))
      },
      onFailure = { error ->
        // Same not-logged-in detection as loadAccount(): surface the calm signed-out state
        // instead of the generic error card so the two tabs read consistently.
        if (safeUiMessage(error).startsWith("로그인이 필요한")) AsyncContent.Ready(WatchlistOverview(signedIn = false))
        else AsyncContent.Error(safeUiMessage(error))
      },
    )
  }

  fun loadAccount() = viewModelScope.launch {
    val previouslySelectedTicketId = (mutableAccount.value as? AsyncContent.Ready)?.value?.selectedTicketId
    mutableAccount.value = AsyncContent.Loading
    mutableAccount.value = runCatching { repository.accountOverview() }.fold(
      onSuccess = { overview ->
        val selected = previouslySelectedTicketId?.takeIf { id -> overview.tickets.any { it.id == id } }
          ?: overview.tickets.firstOrNull()?.id
        AsyncContent.Ready(overview.copy(selectedTicketId = selected))
      },
      onFailure = { error ->
        if (safeUiMessage(error).startsWith("로그인이 필요한")) AsyncContent.Ready(AccountOverview(signedIn = false))
        else AsyncContent.Error(safeUiMessage(error))
      },
    )
  }

  fun loadInquiries() = viewModelScope.launch {
    mutableInquiries.value = AsyncContent.Loading
    mutableInquiries.value = runCatching { repository.supportThreads() }.fold(
      onSuccess = {
        if (it.isEmpty()) AsyncContent.Empty("문의 내역이 없습니다", "새 문의를 작성할 수 있습니다.")
        else AsyncContent.Ready(it)
      },
      onFailure = { AsyncContent.Error(safeUiMessage(it)) },
    )
  }

  fun submitInquiry(subject: String, message: String) = viewModelScope.launch {
    if (subject.isBlank() || message.isBlank() || mutableBookingPending.value) return@launch
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { repository.createSupportThread(subject.trim(), message.trim()) }
      .onSuccess { created ->
        val previous = (mutableInquiries.value as? AsyncContent.Ready)?.value.orEmpty()
        mutableInquiries.value = AsyncContent.Ready(listOf(created) + previous.filterNot { it.id == created.id })
        mutableActionMessage.value = "문의 요청이 접수되었습니다."
      }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
    mutableBookingPending.value = false
  }

  fun selectOwnedTicket(ticketId: String) {
    val current = (mutableAccount.value as? AsyncContent.Ready)?.value ?: return
    if (current.tickets.none { it.id == ticketId }) return
    mutableAccount.value = AsyncContent.Ready(current.copy(selectedTicketId = ticketId))
    mutableAdmissionQr.value = null
    mutableActionMessage.value = null
  }

  fun requestCancellation(reason: String) = mutateAccount("취소 요청이 접수되어 검토 중입니다.") { account ->
    repository.requestCancellation(requireNotNull(account.ticketId), reason)
  }

  fun listForResale(price: Int) = mutateAccount("공식 재판매 등록이 완료되었습니다.") { account ->
    repository.listForResale(requireNotNull(account.ticketId), price)
  }

  private fun mutateAccount(successMessage: String, operation: suspend (AccountOverview) -> Unit) = viewModelScope.launch {
    val account = (mutableAccount.value as? AsyncContent.Ready)?.value ?: return@launch
    if (!account.ticketEligible || account.ticketId == null || mutableBookingPending.value) return@launch
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { operation(account) }
      .onSuccess { mutableActionMessage.value = successMessage }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
    mutableBookingPending.value = false
  }

  fun trustThisDevice() = mutatePlatform("이 기기가 신뢰 기기로 등록되었습니다.") { repository.trustThisDevice() }

  fun registerPush() = mutatePlatform("푸시 알림 등록이 완료되었습니다.") { repository.registerPush() }

  fun issueAdmissionQr() = mutateAccount("입장 QR이 안전하게 발급되었습니다.") { account ->
    mutableAdmissionQr.value = repository.issueAdmissionQr(requireNotNull(account.ticketId))
  }

  private fun mutatePlatform(successMessage: String, operation: suspend () -> Unit) = viewModelScope.launch {
    if (mutableBookingPending.value) return@launch
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { operation() }
      .onSuccess {
        mutableActionMessage.value = successMessage
        loadAccount()
      }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
    mutableBookingPending.value = false
  }

  fun completeCheckout(request: TossCheckoutRequest, result: TossWidgetResult) = viewModelScope.launch {
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { repository.completeCheckout(request, result) }
      .onSuccess { outcome ->
        mutableActionMessage.value = when (outcome) {
          is CheckoutOutcome.Confirmed -> "결제가 승인되어 예매가 완료되었습니다."
          is CheckoutOutcome.Failed -> "결제를 완료하지 못했습니다. (${outcome.code})"
          CheckoutOutcome.Cancelled -> "결제가 취소되었습니다."
        }
      }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
    mutableBookingPending.value = false
  }

  fun continueToCheckout(progress: BookingProgress.Held) {
    pushRoute(CustomerRoute.Checkout(progress.seatLabel, progress.checkout.amount, progress.checkout))
  }

  fun openSupport() { pushRoute(CustomerRoute.Support) }

  fun completeNativeLogin(provider: String, code: String) = viewModelScope.launch {
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { repository.completeNativeLogin(provider, code) }
      .onSuccess {
        mutableActionMessage.value = "로그인되었습니다."
        // Both mypage and watchlist read account-scoped state that was signed-out until this
        // exact moment -- neither screen polls, and the login screen is reached from either one
        // (or from the home header, unrelated to both), so both need an explicit refresh here or
        // whichever of the two the user isn't currently looking at silently stays stale until a
        // manual pull-to-refresh.
        loadAccount()
        loadWatchlist()
        if (mutableRoute.value == CustomerRoute.Login) returnFromLogin()
      }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
    mutableBookingPending.value = false
  }

  fun nativeLoginFailed(message: String) {
    mutableActionMessage.value = message
  }

  private data class BookingAttempt(val request: BookingRequest)
}

/**
 * Stable string key for the NavHost graph. [CustomerAppViewModel.route]/[CustomerAppViewModel.destination]
 * remain the single source of truth for *which* screen is showing and *what data* it renders
 * (an event, a discovery list, a booking draft, ...) — those flows are exercised directly by
 * [CustomerAppViewModelTest] with no Compose/NavController involved, and complex payloads
 * (CatalogEvent, TossCheckoutRequest, BookingProgress) are read from that state rather than
 * threaded through NavHost arguments. NavHost is the real back-stack/rendering backbone: every
 * forward push mirrors into a `navController.navigate(key)` call keyed by this function, and
 * every content lambda below is keyed identically, so NavHost always shows the composable that
 * matches the ViewModel's current route.
 */
private fun navKeyFor(destination: AppDestination, route: CustomerRoute): String = when (route) {
  CustomerRoute.Tab -> "tab_${destination.name.lowercase()}"
  CustomerRoute.Login -> "login"
  is CustomerRoute.Event -> "event"
  is CustomerRoute.Collection -> "collection"
  CustomerRoute.Ranking -> "ranking"
  is CustomerRoute.Region -> "region"
  is CustomerRoute.Venue -> "venue"
  is CustomerRoute.Artist -> "artist"
  CustomerRoute.OpenCalendar -> "calendar"
  CustomerRoute.Resale -> "resale"
  is CustomerRoute.SeatMapRoute -> "seatmap"
  is CustomerRoute.Booking -> "booking"
  is CustomerRoute.Checkout -> "checkout"
  CustomerRoute.Support -> "support"
  CustomerRoute.Reservation -> "reservation"
  CustomerRoute.Cancellation -> "cancellation"
  CustomerRoute.ResaleLifecycle -> "resaleLifecycle"
  CustomerRoute.TrustedDevice -> "trustedDevice"
  CustomerRoute.PushNotifications -> "pushNotifications"
  CustomerRoute.Inquiry -> "inquiry"
}

@Composable
fun TicketGroundCustomerApp(
  viewModel: CustomerAppViewModel,
  onStartLogin: (String) -> Unit = {},
  biometricLoginGateAvailable: Boolean = false,
  biometricLoginGateEnabled: Boolean = false,
  onToggleBiometricLoginGate: (Boolean) -> Unit = {},
) {
  var showMenu by remember { mutableStateOf(false) }
  val destination by viewModel.destination.collectAsStateWithLifecycle()
  val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
  val route by viewModel.route.collectAsStateWithLifecycle()
  val canGoBack by viewModel.canGoBack.collectAsStateWithLifecycle()
  val home by viewModel.home.collectAsStateWithLifecycle()
  val seatMap by viewModel.seatMap.collectAsStateWithLifecycle()
  val discovery by viewModel.discovery.collectAsStateWithLifecycle()
  val watchlist by viewModel.watchlist.collectAsStateWithLifecycle()
  val account by viewModel.account.collectAsStateWithLifecycle()
  val selectedSeatId by viewModel.selectedSeatId.collectAsStateWithLifecycle()
  val heldSeatIds by viewModel.heldSeatIds.collectAsStateWithLifecycle()
  val pending by viewModel.bookingPending.collectAsStateWithLifecycle()
  val actionMessage by viewModel.actionMessage.collectAsStateWithLifecycle()
  val admissionQr by viewModel.admissionQr.collectAsStateWithLifecycle()
  val inquiries by viewModel.inquiries.collectAsStateWithLifecycle()

  val navController = rememberNavController()

  // Authoritative forward-navigation sync: CustomerAppViewModel calls this listener synchronously
  // from inside pushRoute()/navigate()/openBooking() -- the exact same function call that mutates
  // route/destination -- so NavController is always updated in that same call frame regardless of
  // whether the caller is a UI click, a coroutine callback (booking progress advancing after a
  // network call), or a test calling a ViewModel method directly. Registered once per viewModel
  // instance. Relying purely on a Compose effect that reacts to route/destination a composition
  // pass later proved flaky on real devices under load (two ViewModel pushes issued close
  // together, e.g. reservation -> cancellation, could have the second navigate() land while
  // NavHost was still settling the first, and NavHost silently dropped it).
  remember(viewModel) {
    viewModel.setNavigationListener { destination, route ->
      val key = navKeyFor(destination, route)
      if (navController.currentDestination?.route != key) {
        navController.navigate(key) { launchSingleTop = true }
      }
    }
    true
  }

  // Thin convenience wrapper so UI click handlers read the same way they did before this
  // listener existed. Functionally redundant with the listener above (which already runs inside
  // the ViewModel call `action()` makes) but harmless -- navController.navigate() with
  // launchSingleTop is a documented no-op when already at that destination.
  fun push(key: String, action: () -> Unit) {
    action()
    navController.navigate(key) { launchSingleTop = true }
  }

  val openLogin = { push("login") { viewModel.openLoginScreen() } }

  BoxWithConstraints(Modifier.fillMaxSize()) {
    val expandedLayout = maxWidth >= TicketGroundLayout.expandedBreakpoint
    TicketGroundNavigation(
      selected = destination,
      width = maxWidth,
      onNavigate = { d -> push(navKeyFor(d, CustomerRoute.Tab)) { viewModel.navigate(d) } },
    ) {
      // Snapshot the ViewModel's CURRENT route/destination at mount time rather than hardcoding
      // Home/Tab: callers (production and tests alike) sometimes navigate the ViewModel before
      // TicketGroundCustomerApp is ever composed (e.g. VisualCaptureTest builds a ViewModel and
      // calls openSeatMap()/navigate() on it before passing it to setContent). The navigation
      // listener above is only registered once composition starts, so it can't retroactively
      // sync a push that already happened -- NavHost has to start on the right destination
      // itself instead of always starting at Home and hoping something corrects it later.
      val initialNavKey = remember(viewModel) { navKeyFor(destination, route) }
      NavHost(
        navController = navController,
        startDestination = initialNavKey,
        // Instant swaps, no crossfade: content is driven by ViewModel state (see the navigation
        // listener above), and a multi-frame animated transition left a window where a second
        // navigate() arriving before the first transition settled could be dropped by NavHost --
        // this showed up as flaky "destination tag not displayed" failures on real devices when
        // two navigations happened back to back (e.g. reservation -> cancellation). Matches the
        // old when()-based screen swap's instant, single-frame behavior anyway.
        enterTransition = { EnterTransition.None },
        exitTransition = { ExitTransition.None },
        popEnterTransition = { EnterTransition.None },
        popExitTransition = { ExitTransition.None },
      ) {
        composable("tab_home") {
          Column(Modifier.fillMaxSize()) {
            // First-reach soft-ask: a one-time explanation card before the real system
            // POST_NOTIFICATIONS prompt (Android 13+), rather than cold-prompting. Rendered as
            // its own banner ABOVE the scrollable home content (not a floating overlay on top of
            // it) -- an overlay positioned over the list intercepted clicks meant for whatever
            // list content happened to be scrolled underneath it (e.g. the shortcut cards at the
            // bottom of the list), which is a real, confirmed click-stealing bug, not just a
            // cosmetic concern.
            PushPermissionSoftAskCard(
              modifier = Modifier.padding(horizontal = TicketGroundSpacing.lg, vertical = TicketGroundSpacing.sm),
            )
            Box(Modifier.weight(1f)) {
              if (expandedLayout) {
                ExpandedHomeScreen(
                  state = home,
                  onRetry = viewModel::loadHome,
                  onEvent = { e -> push("event") { viewModel.openEvent(e) } },
                  onSearch = { push("tab_search") { viewModel.navigate(AppDestination.Search) } },
                  onCategory = { c -> push("tab_search") { viewModel.openCategory(c) } },
                  onCollection = { title, events -> push("collection") { viewModel.openCollection(title, events) } },
                  onRanking = { events -> push("ranking") { viewModel.openRanking(events) } },
                  onRegion = { name, events -> push("region") { viewModel.openRegion(name, events) } },
                  onOpenCalendar = { push("calendar") { viewModel.openCalendar() } },
                  onOpenResale = { push("resale") { viewModel.openResale() } },
                  onSupport = { push("support") { viewModel.openSupport() } },
                  onLogin = openLogin,
                  onMenu = { showMenu = true },
                )
              } else {
                HomeScreen(
                  state = home,
                  onRetry = viewModel::loadHome,
                  onEvent = { e -> push("event") { viewModel.openEvent(e) } },
                  onSearch = { push("tab_search") { viewModel.navigate(AppDestination.Search) } },
                  onCategory = { c -> push("tab_search") { viewModel.openCategory(c) } },
                  onCollection = { title, events -> push("collection") { viewModel.openCollection(title, events) } },
                  onRanking = { events -> push("ranking") { viewModel.openRanking(events) } },
                  onRegion = { name, events -> push("region") { viewModel.openRegion(name, events) } },
                  onOpenCalendar = { push("calendar") { viewModel.openCalendar() } },
                  onOpenResale = { push("resale") { viewModel.openResale() } },
                  onSupport = { push("support") { viewModel.openSupport() } },
                  onLogin = openLogin,
                  onMenu = { showMenu = true },
                )
              }
            }
          }
        }
        composable("tab_search") {
          AsyncSurface(home, viewModel::loadHome, loadingContent = { EventListLoadingSkeleton() }) {
            SearchScreen(it.events, { e -> push("event") { viewModel.openEvent(e) } }, searchQuery)
          }
        }
        composable("tab_watchlist") {
          WatchlistScreen(watchlist, viewModel::loadWatchlist, openLogin)
        }
        composable("tab_mypage") {
          LifecycleOverviewScreen(
            state = account,
            onRetry = viewModel::loadAccount,
            pending = pending,
            actionMessage = actionMessage,
            onCancellation = viewModel::requestCancellation,
            onResale = viewModel::listForResale,
            onDevice = viewModel::trustThisDevice,
            onPush = viewModel::registerPush,
            onQr = viewModel::issueAdmissionQr,
            onTicketSelected = viewModel::selectOwnedTicket,
            admissionQr = admissionQr,
            onLogin = openLogin,
            onReservationRoute = { push("reservation") { viewModel.openReservation() } },
            onCancellationRoute = { push("cancellation") { viewModel.openCancellation() } },
            onResaleRoute = { push("resaleLifecycle") { viewModel.openResaleLifecycle() } },
            onTrustedDeviceRoute = { push("trustedDevice") { viewModel.openTrustedDevice() } },
            onPushRoute = { push("pushNotifications") { viewModel.openPushNotifications() } },
            onInquiryRoute = { push("inquiry") { viewModel.openInquiry() } },
          )
        }
        composable("event") {
          (route as? CustomerRoute.Event)?.let { current ->
            EventDetailScreen(
              current.event,
              onSeatMap = { performanceId -> push("seatmap") { viewModel.openSeatMap(current.event, performanceId) } },
              onWatchlist = { viewModel.addToWatchlist(current.event) },
              onVenue = { push("venue") { viewModel.openVenue(current.event) } },
              onArtist = { push("artist") { viewModel.openArtist(current.event) } },
              actionMessage = actionMessage,
            )
          }
        }
        composable("collection") {
          (route as? CustomerRoute.Collection)?.let { current ->
            Box(Modifier.fillMaxSize().testTag("collection-screen-${current.title}")) {
              EventListScreen(
                title = current.title,
                state = AsyncContent.Ready(current.events),
                expanded = expandedLayout,
                onRetry = {},
                onEvent = { e -> push("event") { viewModel.openEvent(e) } },
              )
            }
          }
        }
        composable("ranking") {
          Box(Modifier.fillMaxSize().testTag("ranking-screen")) {
            EventListScreen(
              "실시간 예매 랭킹", discovery, expandedLayout, viewModel::retryDiscovery,
              { e -> push("event") { viewModel.openEvent(e) } }, ranking = true,
            )
          }
        }
        composable("region") {
          (route as? CustomerRoute.Region)?.let { current ->
            Box(Modifier.fillMaxSize().testTag("region-screen-${current.name}")) {
              EventListScreen(
                "${current.name} 공연", discovery, expandedLayout, viewModel::retryDiscovery,
                { e -> push("event") { viewModel.openEvent(e) } },
              )
            }
          }
        }
        composable("venue") {
          (route as? CustomerRoute.Venue)?.let { current ->
            Box(Modifier.fillMaxSize().testTag("venue-screen-${current.venueId ?: current.venueName}")) {
              EventListScreen(
                current.venueName, discovery, expandedLayout, viewModel::retryDiscovery,
                { e -> push("event") { viewModel.openEvent(e) } },
              )
            }
          }
        }
        composable("artist") {
          (route as? CustomerRoute.Artist)?.let { current ->
            Box(Modifier.fillMaxSize().testTag("artist-screen-${current.artistSlug ?: "unknown"}")) {
              EventListScreen(
                current.artistNames.firstOrNull() ?: "아티스트 공연", discovery, expandedLayout, viewModel::retryDiscovery,
                { e -> push("event") { viewModel.openEvent(e) } },
              )
            }
          }
        }
        composable("calendar") {
          AsyncSurface(home, viewModel::loadHome) {
            OpenCalendarScreen(it.calendar) { e -> push("event") { viewModel.openEvent(e) } }
          }
        }
        composable("resale") {
          PublicResaleScreen { push(navKeyFor(AppDestination.MyPage, CustomerRoute.Tab)) { viewModel.navigate(AppDestination.MyPage) } }
        }
        composable("seatmap") {
          (route as? CustomerRoute.SeatMapRoute)?.let { current ->
            GraphicalSeatMapScreen(
              state = seatMap,
              selectedSeatId = selectedSeatId,
              heldSeatIds = heldSeatIds,
              pending = pending,
              onRetry = { viewModel.loadSeatMap(current.event.id, current.performanceDateId) },
              onSeatSelected = viewModel::selectSeat,
              onBook = { viewModel.book(current.event, current.performanceDateId) },
            )
            actionMessage?.let { StateBanner(it) }
          }
        }
        composable("booking") {
          (route as? CustomerRoute.Booking)?.let { current ->
            BookingProgressScreen(
              BookingProgressState(current.progress, pending),
              viewModel::retryBooking,
              viewModel::refreshBooking,
              { held -> push("checkout") { viewModel.continueToCheckout(held) } },
            )
          }
        }
        composable("checkout") {
          (route as? CustomerRoute.Checkout)?.let { current ->
            CheckoutHandoffScreen(current.request, pending, current.seatLabel, current.amount) { result ->
              viewModel.completeCheckout(current.request, result)
            }
            actionMessage?.let { StateBanner(it) }
          }
        }
        composable("support") {
          AsyncSurface(home, viewModel::loadHome) { SupportScreen(it) }
        }
        composable("reservation") {
          ReservationDetailScreen(account, viewModel::loadAccount, openLogin, viewModel::selectOwnedTicket)
        }
        composable("cancellation") {
          CancellationRequestScreen(
            account, pending, actionMessage, viewModel::loadAccount, viewModel::requestCancellation, openLogin,
          )
        }
        composable("resaleLifecycle") {
          AccountResaleLifecycleScreen(
            account, pending, actionMessage, viewModel::loadAccount, viewModel::listForResale, openLogin,
          )
        }
        composable("login") {
          LoginScreen(
            onProviderSelected = onStartLogin,
            onClose = { viewModel.closeRoute(); navController.popBackStack() },
          )
        }
        composable("trustedDevice") {
          TrustedDeviceScreen(
            account, pending, actionMessage, viewModel::loadAccount, viewModel::trustThisDevice, openLogin,
            biometricGateAvailable = biometricLoginGateAvailable,
            biometricGateEnabled = biometricLoginGateEnabled,
            onToggleBiometricGate = onToggleBiometricLoginGate,
          )
        }
        composable("pushNotifications") {
          PushNotificationsScreen(
            account, pending, actionMessage, viewModel::loadAccount, viewModel::registerPush, openLogin,
          )
        }
        composable("inquiry") {
          InquiryScreen(
            accountState = account,
            inquiryState = inquiries,
            pending = pending,
            actionMessage = actionMessage,
            onRetry = viewModel::loadInquiries,
            onSubmit = viewModel::submitInquiry,
            onLogin = openLogin,
          )
        }
      }
      // Declared after NavHost so it wins priority on the OnBackPressedDispatcher's LIFO stack
      // (Compose registers back callbacks in composition order; the most recently added enabled
      // callback intercepts first). System back stays routed through the already-tested
      // ViewModel.closeRoute()/canGoBack contract, and we pop the mirrored NavController entry in
      // the same handler so both stacks stay in lockstep. When canGoBack is false this handler is
      // disabled and the event falls through to the default Activity back behavior (exits to the
      // launcher at the Home tab root), matching the Phase 1-verified baseline.
      BackHandler(enabled = canGoBack) {
        viewModel.closeRoute()
        navController.popBackStack()
      }
    }
  }
  if (showMenu) {
    AlertDialog(
      onDismissRequest = { showMenu = false },
      title = { androidx.compose.material3.Text("전체 메뉴") },
      text = {
        androidx.compose.foundation.layout.Column {
          TextButton(onClick = { showMenu = false; push(navKeyFor(AppDestination.Home, CustomerRoute.Tab)) { viewModel.navigate(AppDestination.Home) } }, modifier = androidx.compose.ui.Modifier.testTag("menu-home")) { androidx.compose.material3.Text("홈") }
          TextButton(onClick = { showMenu = false; push(navKeyFor(AppDestination.Search, CustomerRoute.Tab)) { viewModel.navigate(AppDestination.Search) } }, modifier = androidx.compose.ui.Modifier.testTag("menu-search")) { androidx.compose.material3.Text("공연 검색") }
          TextButton(onClick = { showMenu = false; push(navKeyFor(AppDestination.Watchlist, CustomerRoute.Tab)) { viewModel.navigate(AppDestination.Watchlist) } }, modifier = androidx.compose.ui.Modifier.testTag("menu-watchlist")) { androidx.compose.material3.Text("관심공연") }
          TextButton(onClick = { showMenu = false; push(navKeyFor(AppDestination.MyPage, CustomerRoute.Tab)) { viewModel.navigate(AppDestination.MyPage) } }, modifier = androidx.compose.ui.Modifier.testTag("menu-mypage")) { androidx.compose.material3.Text("마이페이지") }
        }
      },
      confirmButton = { TextButton(onClick = { showMenu = false }) { androidx.compose.material3.Text("닫기") } },
    )
  }
}

@Composable
private fun StateBanner(message: String) {
  androidx.compose.material3.Surface(color = androidx.compose.material3.MaterialTheme.colorScheme.errorContainer) {
    androidx.compose.material3.Text(message, modifier = androidx.compose.ui.Modifier.padding(TicketGroundSpacing.md))
  }
}
