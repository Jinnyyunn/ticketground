package kr.ticketground.app.ui

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

sealed interface CustomerRoute {
  data object Tab : CustomerRoute
  data class Event(val event: CatalogEvent) : CustomerRoute
  data class Collection(val title: String, val events: List<CatalogEvent>) : CustomerRoute
  data object OpenCalendar : CustomerRoute
  data object Resale : CustomerRoute
  data class SeatMapRoute(val event: CatalogEvent, val performanceDateId: String?) : CustomerRoute
  data class Checkout(val seatLabel: String, val amount: Int, val request: TossCheckoutRequest) : CustomerRoute
  data object Support : CustomerRoute
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

  fun openCalendar() { mutableRoute.value = CustomerRoute.OpenCalendar }

  fun openResale() { mutableRoute.value = CustomerRoute.Resale }

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
    mutableBookingPending.value = true
    mutableActionMessage.value = null
    runCatching { repository.book(performance, seat.id, seat.displayCode.ifBlank { seat.label }, seat.price) }
      .onSuccess { progress ->
        when (progress) {
          is BookingProgress.Waiting -> mutableActionMessage.value = "현재 대기 순서 ${progress.position}번입니다. 잠시 후 다시 시도해 주세요."
          is BookingProgress.Held -> {
            mutableHeldSeatIds.value = mutableHeldSeatIds.value + progress.seatId
            mutableRoute.value = CustomerRoute.Checkout(progress.seatLabel, progress.checkout.amount, progress.checkout)
          }
        }
      }
      .onFailure { mutableActionMessage.value = safeUiMessage(it) }
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
  val watchlist by viewModel.watchlist.collectAsStateWithLifecycle()
  val account by viewModel.account.collectAsStateWithLifecycle()
  val selectedSeatId by viewModel.selectedSeatId.collectAsStateWithLifecycle()
  val heldSeatIds by viewModel.heldSeatIds.collectAsStateWithLifecycle()
  val pending by viewModel.bookingPending.collectAsStateWithLifecycle()
  val actionMessage by viewModel.actionMessage.collectAsStateWithLifecycle()
  val admissionQr by viewModel.admissionQr.collectAsStateWithLifecycle()

  BoxWithConstraints(Modifier.fillMaxSize()) {
    TicketGroundNavigation(destination, maxWidth, viewModel::navigate) {
      when (val current = route) {
        CustomerRoute.Tab -> when (destination) {
          AppDestination.Home -> if (maxWidth >= TicketGroundLayout.expandedBreakpoint) {
            ExpandedHomeScreen(home, viewModel::loadHome, viewModel::openEvent, { viewModel.navigate(AppDestination.Search) }, viewModel::openCategory, viewModel::openSupport, openLogin) { showMenu = true }
          } else {
            HomeScreen(home, false, viewModel::loadHome, viewModel::openEvent, { viewModel.navigate(AppDestination.Search) }, viewModel::openCategory, viewModel::openSupport, openLogin) { showMenu = true }
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
          )
        }
        is CustomerRoute.Event -> EventDetailScreen(
          current.event,
          onSeatMap = { viewModel.openSeatMap(current.event, it) },
          onWatchlist = { viewModel.addToWatchlist(current.event) },
          actionMessage = actionMessage,
        )
        is CustomerRoute.Collection, CustomerRoute.OpenCalendar, CustomerRoute.Resale -> Unit
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
        is CustomerRoute.Checkout -> {
          CheckoutHandoffScreen(current.request, pending, current.seatLabel, current.amount) { result ->
            viewModel.completeCheckout(current.request, result)
          }
          actionMessage?.let { StateBanner(it) }
        }
        CustomerRoute.Support -> AsyncSurface(home, viewModel::loadHome) { SupportScreen(it) }
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
