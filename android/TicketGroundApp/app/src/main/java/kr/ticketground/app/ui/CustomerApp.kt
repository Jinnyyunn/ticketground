package kr.ticketground.app.ui

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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

sealed interface CustomerRoute {
  data object Tab : CustomerRoute
  data class Event(val event: CatalogEvent) : CustomerRoute
  data class SeatMapRoute(val event: CatalogEvent, val performanceDateId: String?) : CustomerRoute
  data class Checkout(val seatLabel: String, val amount: Int, val configured: Boolean) : CustomerRoute
  data object Support : CustomerRoute
}

class CustomerAppViewModel(private val repository: CustomerRepository) : ViewModel() {
  private val mutableDestination = MutableStateFlow(AppDestination.Home)
  val destination = mutableDestination.asStateFlow()
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

  fun loadHome() = viewModelScope.launch {
    mutableHome.value = AsyncContent.Loading
    mutableHome.value = runCatching { repository.home() }.fold(
      onSuccess = { if (it.events.isEmpty()) AsyncContent.Empty("공연이 없습니다", "새로운 공연이 등록되면 알려드릴게요.") else AsyncContent.Ready(it) },
      onFailure = { AsyncContent.Error(safeUiMessage(it)) },
    )
  }

  fun openEvent(event: CatalogEvent) { mutableRoute.value = CustomerRoute.Event(event) }

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
            mutableRoute.value = CustomerRoute.Checkout(progress.seatLabel, progress.amount + 2_000, progress.tossConfigured)
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
    mutableAccount.value = AsyncContent.Loading
    mutableAccount.value = runCatching { repository.accountOverview() }.fold(
      onSuccess = { AsyncContent.Ready(it) },
      onFailure = { error ->
        if (safeUiMessage(error).startsWith("로그인이 필요한")) AsyncContent.Ready(AccountOverview(signedIn = false))
        else AsyncContent.Error(safeUiMessage(error))
      },
    )
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

  fun platformUnavailable(label: String) {
    mutableActionMessage.value = "$label 외부 제공자 설정과 실제 기기 검증이 확인될 때까지 요청을 시작하지 않습니다."
  }

  fun openSupport() { mutableRoute.value = CustomerRoute.Support }
  fun paymentUnavailable() { mutableActionMessage.value = "Toss Payments SDK와 가맹점 설정이 확인될 때까지 결제를 시작하지 않습니다." }
}

@Composable
fun TicketGroundCustomerApp(viewModel: CustomerAppViewModel) {
  val destination by viewModel.destination.collectAsStateWithLifecycle()
  val route by viewModel.route.collectAsStateWithLifecycle()
  val home by viewModel.home.collectAsStateWithLifecycle()
  val seatMap by viewModel.seatMap.collectAsStateWithLifecycle()
  val watchlist by viewModel.watchlist.collectAsStateWithLifecycle()
  val account by viewModel.account.collectAsStateWithLifecycle()
  val selectedSeatId by viewModel.selectedSeatId.collectAsStateWithLifecycle()
  val heldSeatIds by viewModel.heldSeatIds.collectAsStateWithLifecycle()
  val pending by viewModel.bookingPending.collectAsStateWithLifecycle()
  val actionMessage by viewModel.actionMessage.collectAsStateWithLifecycle()

  BoxWithConstraints {
    TicketGroundNavigation(destination, maxWidth, viewModel::navigate) {
      when (val current = route) {
        CustomerRoute.Tab -> when (destination) {
          AppDestination.Home -> if (maxWidth >= TicketGroundLayout.expandedBreakpoint) {
            EventListScreen("티켓 랭킹", home.eventListState(), true, viewModel::loadHome, viewModel::openEvent)
          } else {
            HomeScreen(home, false, viewModel::loadHome, viewModel::openEvent, { viewModel.navigate(AppDestination.Search) }, viewModel::openSupport)
          }
          AppDestination.Search -> AsyncSurface(home, viewModel::loadHome) { SearchScreen(it.events, viewModel::openEvent) }
          AppDestination.Watchlist -> WatchlistScreen(watchlist, viewModel::loadWatchlist)
          AppDestination.MyPage -> LifecycleOverviewScreen(
            state = account,
            onRetry = viewModel::loadAccount,
            pending = pending,
            actionMessage = actionMessage,
            onCancellation = viewModel::requestCancellation,
            onResale = viewModel::listForResale,
            onDevice = { viewModel.platformUnavailable("Play Integrity") },
            onPush = { viewModel.platformUnavailable("FCM") },
            onQr = { viewModel.platformUnavailable("입장 QR") },
          )
        }
        is CustomerRoute.Event -> EventDetailScreen(current.event) { viewModel.openSeatMap(current.event, it) }
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
          CheckoutHandoffScreen(current.configured, pending, current.seatLabel, current.amount, viewModel::paymentUnavailable)
          actionMessage?.let { StateBanner(it) }
        }
        CustomerRoute.Support -> AsyncSurface(home, viewModel::loadHome) { SupportScreen(it) }
      }
    }
  }
}

@Composable
private fun StateBanner(message: String) {
  androidx.compose.material3.Surface(color = androidx.compose.material3.MaterialTheme.colorScheme.errorContainer) {
    androidx.compose.material3.Text(message, modifier = androidx.compose.ui.Modifier.padding(TicketGroundSpacing.md))
  }
}

private fun AsyncContent<HomeContent>.eventListState(): AsyncContent<List<CatalogEvent>> = when (this) {
  AsyncContent.Loading -> AsyncContent.Loading
  is AsyncContent.Empty -> this
  is AsyncContent.Error -> this
  is AsyncContent.Ready -> AsyncContent.Ready(value.events)
}
