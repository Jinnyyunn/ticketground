package kr.ticketground.app.ui

import java.util.UUID
import kr.ticketground.app.data.AccountApi
import kr.ticketground.app.data.ApiError
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.LifecycleApi
import kr.ticketground.app.data.LifecyclePolicy
import kr.ticketground.app.data.LifecycleStatus
import kr.ticketground.app.data.OpenCalendarEntry
import kr.ticketground.app.data.PublicApi
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.SupportFaq
import kr.ticketground.app.data.SupportNotice
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.data.WatchlistItem

sealed interface AsyncContent<out T> {
  data object Loading : AsyncContent<Nothing>
  data class Empty(val title: String, val message: String) : AsyncContent<Nothing>
  data class Error(val message: String) : AsyncContent<Nothing>
  data class Ready<T>(val value: T) : AsyncContent<T>
}

data class HomeContent(
  val events: List<CatalogEvent>,
  val calendar: List<OpenCalendarEntry>,
  val faq: List<SupportFaq>,
  val notices: List<SupportNotice>,
)

data class AccountOverview(
  val signedIn: Boolean,
  val ticketId: String? = null,
  val ticketTitle: String? = null,
  val seatLabel: String? = null,
  val ticketEligible: Boolean = false,
  val minimumResalePrice: Int = 0,
  val maximumResalePrice: Int = 0,
  val trustedDevice: Boolean = false,
  val pushSuffix: String? = null,
  val qrState: String = "입장 QR 준비 전",
)

sealed interface BookingProgress {
  data class Waiting(val position: Int) : BookingProgress
  data class Held(val seatLabel: String, val amount: Int, val tossConfigured: Boolean) : BookingProgress
}

interface CustomerRepository {
  suspend fun home(): HomeContent
  suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap
  suspend fun watchlist(): List<WatchlistItem>
  suspend fun accountOverview(): AccountOverview
  suspend fun book(performanceDateId: String, seatId: String, seatLabel: String, amount: Int): BookingProgress
  suspend fun requestCancellation(ticketId: String, reason: String)
  suspend fun listForResale(ticketId: String, price: Int)
}

class TypedCustomerRepository(
  private val publicApi: PublicApi,
  private val accountApi: AccountApi,
  private val lifecycleApi: LifecycleApi,
  private val client: TicketGroundApiClient,
) : CustomerRepository {
  override suspend fun home(): HomeContent {
    val catalog = publicApi.catalog()
    val calendar = publicApi.openCalendar()
    val support = publicApi.publicSupport()
    return HomeContent(catalog.events, calendar.entries, support.faqs, support.notices)
  }

  override suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap =
    publicApi.seatMap(eventId, performanceDateId)

  override suspend fun watchlist(): List<WatchlistItem> = accountApi.watchlist()

  override suspend fun accountOverview(): AccountOverview {
    accountApi.session()
    val tickets = accountApi.tickets()
    val devices = lifecycleApi.trustedDevices()
    val push = lifecycleApi.pushTokens()
    val ticket = tickets.firstOrNull()
    return AccountOverview(
      signedIn = true,
      ticketId = ticket?.id,
      ticketTitle = ticket?.event?.title,
      seatLabel = ticket?.seatLabel,
      ticketEligible = ticket?.let(LifecyclePolicy::canIssueQr) == true,
      minimumResalePrice = ticket?.minPrice ?: 0,
      maximumResalePrice = ticket?.maxPrice ?: 0,
      trustedDevice = devices.any { LifecyclePolicy.canRevoke(it.status) },
      pushSuffix = push.firstOrNull()?.suffix,
      qrState = if (ticket?.virtualQr != null) "가상 티켓 발급됨" else "입장 가능 시간 전",
    )
  }

  override suspend fun book(
    performanceDateId: String,
    seatId: String,
    seatLabel: String,
    amount: Int,
  ): BookingProgress {
    val entry = accountApi.enterQueue(performanceDateId, "android-queue-${UUID.randomUUID()}")
    if (entry.status != LifecycleStatus.ADMITTED) return BookingProgress.Waiting(entry.position)
    val hold = accountApi.createSeatHold(performanceDateId, listOf(seatId), "android-hold-${UUID.randomUUID()}")
    if (hold.status != LifecycleStatus.ACTIVE || hold.ticketIds != listOf(seatId)) {
      throw IllegalStateException("좌석을 안전하게 확보하지 못했습니다.")
    }
    client.payments().config()
    return BookingProgress.Held(seatLabel, amount, tossConfigured = false)
  }

  override suspend fun requestCancellation(ticketId: String, reason: String) {
    lifecycleApi.createCancellationRequest(ticketId, reason, true, "android-cancel-${UUID.randomUUID()}")
  }

  override suspend fun listForResale(ticketId: String, price: Int) {
    lifecycleApi.createResalePool(ticketId, price, null, "android-resale-${UUID.randomUUID()}")
  }
}

fun safeUiMessage(error: Throwable): String = when (error) {
  is ApiError.MissingCredential, is ApiError.Unauthorized -> "로그인이 필요한 기능입니다. 웹 또는 iOS에서 로그인한 계정의 연결을 확인해 주세요."
  is ApiError.Transport, is ApiError.Retryable -> "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
  is ApiError.IncompatibleContract -> "현재 앱과 서버 버전이 맞지 않습니다. 잠시 후 다시 시도해 주세요."
  else -> "요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."
}
