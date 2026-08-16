package kr.ticketground.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kr.ticketground.app.AppDestination
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.WatchlistItem
import kr.ticketground.app.data.CheckoutOutcome
import kr.ticketground.app.data.TossCheckoutRequest
import kr.ticketground.app.data.TossWidgetResult
import kr.ticketground.app.data.AdmissionQr
import kr.ticketground.app.data.SupportThread

sealed interface CustomerRoute {
  data object Tab : CustomerRoute
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

class CustomerAppViewModel(private val repository: CustomerRepository) : ViewModel() {
  private val mutableDestination = MutableStateFlow(AppDestination.Home)
  val destination = mutableDestination.asStateFlow()
  private val mutableSearchQuery = MutableStateFlow("")
  val searchQuery = mutableSearchQuery.asStateFlow()
  private val mutableRoute = MutableStateFlow<CustomerRoute>(CustomerRoute.Tab)
  val route = mutableRoute.asStateFlow()
  private val mutableHome = MutableStateFlow<AsyncContent<HomeContent>>(AsyncContent.Loading)
  val home = mutableHome.asStateFlow()
  private val mutableSeatMap = MutableStateFlow<AsyncContent<SeatMap>>(AsyncContent.Loading)
  val seatMap = mutableSeatMap.asStateFlow()
  private val mutableDiscovery = MutableStateFlow<AsyncContent<List<CatalogEvent>>>(AsyncContent.Loading)
  val discovery = mutableDiscovery.asStateFlow()
  private val mutableWatchlist = MutableStateFlow<AsyncContent<List<WatchlistItem>>>(AsyncContent.Loading)
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

  init { loadHome() }

  fun navigate(destination: AppDestination) {
    mutableDestination.value = destination
    mutableRoute.value = CustomerRoute.Tab
    when (destination) {
      AppDestination.Home, AppDestination.Search -> if (mutableHome.value is AsyncContent.Error) loadHome()
      AppDestination.Watchlist -> loadWatchlist()
      AppDestination.MyPage -> loadAccount()
    }
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

  fun openEvent(event: CatalogEvent) { mutableRoute.value = CustomerRoute.Event(event) }

  fun openCollection(title: String, events: List<CatalogEvent>) {
    mutableRoute.value = CustomerRoute.Collection(title, events)
  }

  fun openRanking(events: List<CatalogEvent>) {
    mutableRoute.value = CustomerRoute.Ranking
    loadDiscovery { repository.ranking() }
  }

  fun openRegion(name: String, events: List<CatalogEvent>) {
    mutableRoute.value = CustomerRoute.Region(name)
    loadDiscovery { repository.region(name) }
  }

  fun openVenue(event: CatalogEvent) {
    mutableRoute.value = CustomerRoute.Venue(event.venueId, event.venue)
    loadDiscovery { repository.venue(event.venueId, event.venue) }
  }

  fun openArtist(event: CatalogEvent) {
    val names = event.casts.orEmpty()
    mutableRoute.value = CustomerRoute.Artist(event.artistSlug, names)
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

  private fun loadDiscovery(block: suspend () -> List<CatalogEvent>) = viewModelScope.launch {
    mutableDiscovery.value = AsyncContent.Loading
    mutableDiscovery.value = runCatching { block() }.fold(
      onSuccess = { if (it.isEmpty()) AsyncContent.Empty("공연이 없습니다", "다른 조건을 확인해 주세요.") else AsyncContent.Ready(it) },
      onFailure = { AsyncContent.Error(safeUiMessage(it)) },
    )
  }

  fun openBooking(progress: BookingProgress) { mutableRoute.value = CustomerRoute.Booking(progress) }

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
    mutableRoute.value = route
    if (mutableAccount.value is AsyncContent.Loading || mutableAccount.value is AsyncContent.Error) loadAccount()
  }

  fun openCalendar() { mutableRoute.value = CustomerRoute.OpenCalendar }

  fun openResale() { mutableRoute.value = CustomerRoute.Resale }

  fun closeRoute() { mutableRoute.value = CustomerRoute.Tab }

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
    mutableSelectedSeatId.value = null
    mutableHeldSeatIds.value = emptySet()
    mutableRoute.value = CustomerRoute.SeatMapRoute(event, performanceDateId)
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

  fun book(event: CatalogEvent, performanceDateId: String?) = viewModelScope.launch {
    val map = (mutableSeatMap.value as? AsyncContent.Ready)?.value ?: return@launch
    val seat = map.seats.firstOrNull { it.id == mutableSelectedSeatId.value && it.available } ?: return@launch
    val performance = performanceDateId?.takeIf(String::isNotBlank)
    if (performance == null) {
      mutableActionMessage.value = "예매 회차를 확인할 수 없습니다. 공연 상세에서 회차를 다시 선택해 주세요."
      return@launch
    }
    lastBookingAttempt = BookingAttempt(event, performance)
    performBooking(event, performance, seat.id)
  }

  fun retryBooking() {
    val attempt = lastBookingAttempt ?: return
    val seatId = mutableSelectedSeatId.value ?: return
    viewModelScope.launch { performBooking(attempt.event, attempt.performanceDateId, seatId) }
  }

  private suspend fun performBooking(event: CatalogEvent, performance: String, seatId: String) {
    val map = (mutableSeatMap.value as? AsyncContent.Ready)?.value ?: return
    val seat = map.seats.firstOrNull { it.id == seatId && it.available } ?: return
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { repository.book(performance, seat.id, seat.displayCode.ifBlank { seat.label }, seat.price) }
      .onSuccess { progress ->
        when (progress) {
          is BookingProgress.Waiting -> openBooking(progress)
          is BookingProgress.Held -> {
            mutableHeldSeatIds.value = mutableHeldSeatIds.value + progress.seatId
            openBooking(progress)
          }
          is BookingProgress.Expired, is BookingProgress.Conflict, is BookingProgress.Error -> openBooking(progress)
        }
      }
      .onFailure { openBooking(BookingProgress.Error(safeUiMessage(it))) }
    mutableBookingPending.value = false
  }

  fun loadWatchlist() = viewModelScope.launch {
    mutableWatchlist.value = AsyncContent.Loading
    mutableWatchlist.value = runCatching { repository.watchlist() }.fold(
      onSuccess = { if (it.isEmpty()) AsyncContent.Empty("관심공연이 없습니다", "공연 상세에서 찜하기를 눌러보세요.") else AsyncContent.Ready(it) },
      onFailure = { AsyncContent.Error(safeUiMessage(it)) },
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
    mutableRoute.value = CustomerRoute.Checkout(progress.seatLabel, progress.checkout.amount, progress.checkout)
  }

  fun openSupport() { mutableRoute.value = CustomerRoute.Support }

  fun completeNativeLogin(provider: String, code: String) = viewModelScope.launch {
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { repository.completeNativeLogin(provider, code) }
      .onSuccess {
        mutableActionMessage.value = "로그인되었습니다."
        loadAccount()
      }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
    mutableBookingPending.value = false
  }

  fun nativeLoginFailed(message: String) {
    mutableActionMessage.value = message
  }

  private data class BookingAttempt(val event: CatalogEvent, val performanceDateId: String)
}

@Composable
fun TicketGroundCustomerApp(
  viewModel: CustomerAppViewModel,
  onStartLogin: (String) -> Unit = {},
) {
  var showLoginChoices by remember { mutableStateOf(false) }
  var showMenu by remember { mutableStateOf(false) }
  val openLogin = { showLoginChoices = true }
  val destination by viewModel.destination.collectAsStateWithLifecycle()
  val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
  val route by viewModel.route.collectAsStateWithLifecycle()
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

  BackHandler(enabled = route != CustomerRoute.Tab, onBack = viewModel::closeRoute)

  BoxWithConstraints(Modifier.fillMaxSize()) {
    val expandedLayout = maxWidth >= TicketGroundLayout.expandedBreakpoint
    TicketGroundNavigation(destination, maxWidth, viewModel::navigate) {
      when (val current = route) {
        CustomerRoute.Tab -> when (destination) {
          AppDestination.Home -> if (expandedLayout) {
            ExpandedHomeScreen(
              state = home,
              onRetry = viewModel::loadHome,
              onEvent = viewModel::openEvent,
              onSearch = { viewModel.navigate(AppDestination.Search) },
              onCategory = viewModel::openCategory,
              onCollection = viewModel::openCollection,
              onRanking = viewModel::openRanking,
              onRegion = viewModel::openRegion,
              onOpenCalendar = viewModel::openCalendar,
              onOpenResale = viewModel::openResale,
              onSupport = viewModel::openSupport,
              onLogin = openLogin,
              onMenu = { showMenu = true },
            )
          } else {
            HomeScreen(
              state = home,
              onRetry = viewModel::loadHome,
              onEvent = viewModel::openEvent,
              onSearch = { viewModel.navigate(AppDestination.Search) },
              onCategory = viewModel::openCategory,
              onCollection = viewModel::openCollection,
              onRanking = viewModel::openRanking,
              onRegion = viewModel::openRegion,
              onOpenCalendar = viewModel::openCalendar,
              onOpenResale = viewModel::openResale,
              onSupport = viewModel::openSupport,
              onLogin = openLogin,
              onMenu = { showMenu = true },
            )
          }
          AppDestination.Search -> AsyncSurface(home, viewModel::loadHome) { SearchScreen(it.events, viewModel::openEvent, searchQuery) }
          AppDestination.Watchlist -> WatchlistScreen(watchlist, viewModel::loadWatchlist)
          AppDestination.MyPage -> LifecycleOverviewScreen(
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
            onReservationRoute = viewModel::openReservation,
            onCancellationRoute = viewModel::openCancellation,
            onResaleRoute = viewModel::openResaleLifecycle,
            onTrustedDeviceRoute = viewModel::openTrustedDevice,
            onPushRoute = viewModel::openPushNotifications,
            onInquiryRoute = viewModel::openInquiry,
          )
        }
        is CustomerRoute.Event -> EventDetailScreen(
          current.event,
          onSeatMap = { viewModel.openSeatMap(current.event, it) },
          onWatchlist = { viewModel.addToWatchlist(current.event) },
          onVenue = { viewModel.openVenue(current.event) },
          onArtist = { viewModel.openArtist(current.event) },
          actionMessage = actionMessage,
        )
        is CustomerRoute.Collection -> Box(
          Modifier.fillMaxSize().testTag("collection-screen-${current.title}"),
        ) {
          EventListScreen(
            title = current.title,
            state = AsyncContent.Ready(current.events),
            expanded = expandedLayout,
            onRetry = {},
            onEvent = viewModel::openEvent,
          )
        }
        CustomerRoute.Ranking -> Box(Modifier.fillMaxSize().testTag("ranking-screen")) {
          EventListScreen("실시간 예매 랭킹", discovery, expandedLayout, viewModel::retryDiscovery, viewModel::openEvent, ranking = true)
        }
        is CustomerRoute.Region -> Box(Modifier.fillMaxSize().testTag("region-screen-${current.name}")) {
          EventListScreen("${current.name} 공연", discovery, expandedLayout, viewModel::retryDiscovery, viewModel::openEvent)
        }
        is CustomerRoute.Venue -> Box(Modifier.fillMaxSize().testTag("venue-screen-${current.venueId ?: current.venueName}")) {
          EventListScreen(current.venueName, discovery, expandedLayout, viewModel::retryDiscovery, viewModel::openEvent)
        }
        is CustomerRoute.Artist -> Box(Modifier.fillMaxSize().testTag("artist-screen-${current.artistSlug ?: "unknown"}")) {
          EventListScreen(current.artistNames.firstOrNull() ?: "아티스트 공연", discovery, expandedLayout, viewModel::retryDiscovery, viewModel::openEvent)
        }
        CustomerRoute.OpenCalendar -> AsyncSurface(home, viewModel::loadHome) {
          OpenCalendarScreen(it.calendar, viewModel::openEvent)
        }
        CustomerRoute.Resale -> PublicResaleScreen {
          viewModel.navigate(AppDestination.MyPage)
        }
        is CustomerRoute.SeatMapRoute -> {
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
        is CustomerRoute.Booking -> BookingProgressScreen(current.progress, viewModel::retryBooking, viewModel::continueToCheckout)
        is CustomerRoute.Checkout -> {
          CheckoutHandoffScreen(current.request, pending, current.seatLabel, current.amount) { result ->
            viewModel.completeCheckout(current.request, result)
          }
          actionMessage?.let { StateBanner(it) }
        }
        CustomerRoute.Support -> AsyncSurface(home, viewModel::loadHome) { SupportScreen(it) }
        CustomerRoute.Reservation -> ReservationDetailScreen(account, viewModel::loadAccount, openLogin, viewModel::selectOwnedTicket)
        CustomerRoute.Cancellation -> CancellationRequestScreen(
          account, pending, actionMessage, viewModel::loadAccount, viewModel::requestCancellation, openLogin,
        )
        CustomerRoute.ResaleLifecycle -> AccountResaleLifecycleScreen(
          account, pending, actionMessage, viewModel::loadAccount, viewModel::listForResale, openLogin,
        )
        CustomerRoute.TrustedDevice -> TrustedDeviceScreen(
          account, pending, actionMessage, viewModel::loadAccount, viewModel::trustThisDevice, openLogin,
        )
        CustomerRoute.PushNotifications -> PushNotificationsScreen(
          account, pending, actionMessage, viewModel::loadAccount, viewModel::registerPush, openLogin,
        )
        CustomerRoute.Inquiry -> InquiryScreen(
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
  }
  if (showLoginChoices) {
    AlertDialog(
      onDismissRequest = { showLoginChoices = false },
      title = { androidx.compose.material3.Text("로그인") },
      text = { androidx.compose.material3.Text("로그인할 서비스를 선택해 주세요.") },
      confirmButton = {
        TextButton(onClick = { showLoginChoices = false; onStartLogin("kakao") }, modifier = androidx.compose.ui.Modifier.testTag("login-kakao")) { androidx.compose.material3.Text("카카오톡") }
      },
      dismissButton = {
        androidx.compose.foundation.layout.Row {
          TextButton(onClick = { showLoginChoices = false; onStartLogin("naver") }, modifier = androidx.compose.ui.Modifier.testTag("login-naver")) { androidx.compose.material3.Text("네이버") }
          TextButton(onClick = { showLoginChoices = false }) { androidx.compose.material3.Text("취소") }
        }
      },
    )
  }
  if (showMenu) {
    AlertDialog(
      onDismissRequest = { showMenu = false },
      title = { androidx.compose.material3.Text("전체 메뉴") },
      text = {
        androidx.compose.foundation.layout.Column {
          TextButton(onClick = { showMenu = false; viewModel.navigate(AppDestination.Home) }, modifier = androidx.compose.ui.Modifier.testTag("menu-home")) { androidx.compose.material3.Text("홈") }
          TextButton(onClick = { showMenu = false; viewModel.navigate(AppDestination.Search) }, modifier = androidx.compose.ui.Modifier.testTag("menu-search")) { androidx.compose.material3.Text("공연 검색") }
          TextButton(onClick = { showMenu = false; viewModel.navigate(AppDestination.Watchlist) }, modifier = androidx.compose.ui.Modifier.testTag("menu-watchlist")) { androidx.compose.material3.Text("관심공연") }
          TextButton(onClick = { showMenu = false; viewModel.navigate(AppDestination.MyPage) }, modifier = androidx.compose.ui.Modifier.testTag("menu-mypage")) { androidx.compose.material3.Text("마이페이지") }
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
