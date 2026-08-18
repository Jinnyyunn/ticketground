package kr.ticketground.app.ui

import java.util.UUID
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kr.ticketground.app.data.AccountApi
import kr.ticketground.app.data.AccountSession
import kr.ticketground.app.data.ApiError
import kr.ticketground.app.data.BookingApi
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.CatalogSchedule
import kr.ticketground.app.data.LifecycleApi
import kr.ticketground.app.data.LifecyclePolicy
import kr.ticketground.app.data.LifecycleStatus
import kr.ticketground.app.data.OpenCalendarEntry
import kr.ticketground.app.data.PublicApi
import kr.ticketground.app.data.ReservationDraft
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.SupportFaq
import kr.ticketground.app.data.SupportNotice
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.data.CheckoutOutcome
import kr.ticketground.app.data.CheckoutError
import kr.ticketground.app.data.CheckoutRetryStore
import kr.ticketground.app.data.ExternalProviderError
import kr.ticketground.app.data.FirebasePushRegistrationProvider
import kr.ticketground.app.data.InMemoryCheckoutRetryStore
import kr.ticketground.app.data.IntegrityPurpose
import kr.ticketground.app.data.PlayIntegrityProofProvider
import kr.ticketground.app.data.TossCheckoutCoordinator
import kr.ticketground.app.data.TossCheckoutPreparer
import kr.ticketground.app.data.TossCheckoutRequest
import kr.ticketground.app.data.TossPaymentMethod
import kr.ticketground.app.data.TossWidgetResult
import kr.ticketground.app.data.DeviceTokenStore
import kr.ticketground.app.data.DeviceOwnerAuthenticator
import kr.ticketground.app.data.InMemoryDeviceTokenStore
import kr.ticketground.app.data.WatchlistItem
import kr.ticketground.app.data.AdmissionQr
import kr.ticketground.app.data.SupportThread

sealed interface AsyncContent<out T> {
  data object Loading : AsyncContent<Nothing>
  data class Empty(val title: String, val message: String) : AsyncContent<Nothing>
  data class Error(val message: String) : AsyncContent<Nothing>
  data class Ready<T>(val value: T) : AsyncContent<T>
}

/**
 * Performances a customer can actually select to start booking.
 *
 * The catalog API returns two parallel lists per event: `dates` carries the real
 * performance id booking needs (to open the seat map and enter the queue), while
 * `schedules` is a display-only duplicate (label/date/times) that never carries an id.
 * Both lists expose the same `label` text, so preferring `dates` loses no display
 * information; `schedules` is kept only as a fallback for events that omit `dates`.
 * Entries without a usable id are dropped since they cannot be booked.
 */
fun bookablePerformances(event: CatalogEvent): List<CatalogSchedule> =
  (event.dates ?: event.schedules).orEmpty().filter { !it.id.isNullOrBlank() }

data class HomeContent(
  val events: List<CatalogEvent>,
  val calendar: List<OpenCalendarEntry>,
  val faq: List<SupportFaq>,
  val notices: List<SupportNotice>,
)

data class WatchlistOverview(
  val signedIn: Boolean,
  val items: List<WatchlistItem> = emptyList(),
)

data class AccountTicketOverview(
  val id: String,
  val title: String,
  val seatLabel: String,
  val eligible: Boolean,
  val minimumResalePrice: Int,
  val maximumResalePrice: Int,
  val qrState: String,
)

data class AccountOverview(
  val signedIn: Boolean,
  val tickets: List<AccountTicketOverview> = emptyList(),
  val selectedTicketId: String? = tickets.firstOrNull()?.id,
  val trustedDevice: Boolean = false,
  val trustedDeviceId: String? = null,
  val pushSuffix: String? = null,
  val cancellationPending: Boolean = false,
  val resaleState: String? = null,
) {
  val selectedTicket: AccountTicketOverview? get() = tickets.firstOrNull { it.id == selectedTicketId }
  val ticketId: String? get() = selectedTicket?.id
  val ticketTitle: String? get() = selectedTicket?.title
  val seatLabel: String? get() = selectedTicket?.seatLabel
  val ticketEligible: Boolean get() = selectedTicket?.eligible == true
  val minimumResalePrice: Int get() = selectedTicket?.minimumResalePrice ?: 0
  val maximumResalePrice: Int get() = selectedTicket?.maximumResalePrice ?: 0
  val qrState: String get() = selectedTicket?.qrState ?: "입장 QR 준비 전"
}

sealed interface BookingProgress {
  data class Waiting(val entryId: String, val position: Int) : BookingProgress
  data class Held(val seatId: String, val seatLabel: String, val amount: Int, val checkout: TossCheckoutRequest) : BookingProgress
  data class Expired(val message: String) : BookingProgress
  data class Conflict(val message: String) : BookingProgress
  data class Error(val message: String) : BookingProgress
}

internal class BookingPreparationFailure(val progress: BookingProgress) : Exception(
  when (progress) {
    is BookingProgress.Expired -> progress.message
    is BookingProgress.Conflict -> progress.message
    else -> "Booking preparation failed"
  },
)

data class BookingProgressState(val progress: BookingProgress, val pending: Boolean)

data class DeviceIdentity(val id: String, val name: String)

internal class BookingOperationKeys private constructor(
  val queue: String,
  val hold: String,
  val draft: String,
  val payment: String,
  val draftCancel: String,
  val holdRelease: String,
) {
  companion object {
    fun create() = BookingOperationKeys(
      queue = "android-queue-${UUID.randomUUID()}",
      hold = "android-hold-${UUID.randomUUID()}",
      draft = "android-draft-${UUID.randomUUID()}",
      payment = "android-payment-${UUID.randomUUID()}",
      draftCancel = "android-draft-cancel-${UUID.randomUUID()}",
      holdRelease = "android-hold-release-${UUID.randomUUID()}",
    )
  }
}

class BookingRequest internal constructor(
  val performanceDateId: String,
  val seatId: String,
  val seatLabel: String,
  val amount: Int,
  internal val operationKeys: BookingOperationKeys,
) {
  companion object {
    fun create(performanceDateId: String, seatId: String, seatLabel: String, amount: Int) = BookingRequest(
      performanceDateId,
      seatId,
      seatLabel,
      amount,
      BookingOperationKeys.create(),
    )
  }
}

interface CustomerRepository {
  suspend fun home(): HomeContent
  suspend fun ranking(): List<CatalogEvent> = home().events.sortedByDescending(CatalogEvent::soldCount)
  suspend fun region(name: String): List<CatalogEvent> = home().events
  suspend fun venue(venueId: String?, venueName: String): List<CatalogEvent> = home().events.filter {
    (venueId != null && it.venueId == venueId) || it.venue == venueName
  }
  suspend fun artist(artistSlug: String?, artistNames: List<String>): List<CatalogEvent> = home().events.filter {
    (artistSlug != null && it.artistSlug == artistSlug) || it.casts.orEmpty().any(artistNames::contains)
  }
  suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap
  suspend fun watchlist(): List<WatchlistItem>
  suspend fun accountOverview(): AccountOverview
  suspend fun book(request: BookingRequest): BookingProgress
  suspend fun refreshBooking(request: BookingRequest, entryId: String): BookingProgress =
    throw ApiError.Transport(IllegalStateException("Native queue refresh is unavailable"))
  suspend fun requestCancellation(ticketId: String, reason: String)
  suspend fun listForResale(ticketId: String, price: Int)
  suspend fun addToWatchlist(eventId: String)
  suspend fun supportThreads(): List<SupportThread> = throw ApiError.Transport(
    IllegalStateException("Native inquiry history is unavailable"),
  )
  suspend fun createSupportThread(subject: String, message: String): SupportThread = throw ApiError.Transport(
    IllegalStateException("Native inquiry submission is unavailable"),
  )
  suspend fun completeCheckout(request: TossCheckoutRequest, result: TossWidgetResult): CheckoutOutcome =
    throw ExternalProviderError.TossUnavailable
  suspend fun trustThisDevice(): Unit = throw ExternalProviderError.PlayIntegrityUnavailable
  suspend fun registerPush(): Unit = throw ExternalProviderError.PushUnavailable
  suspend fun issueAdmissionQr(ticketId: String): AdmissionQr = throw ExternalProviderError.PlayIntegrityUnavailable
  suspend fun completeNativeLogin(provider: String, code: String): AccountSession =
    throw ApiError.Transport(IllegalStateException("Native login is unavailable"))
}

class TypedCustomerRepository(
  private val publicApi: PublicApi,
  private val accountApi: AccountApi,
  private val lifecycleApi: LifecycleApi,
  private val client: TicketGroundApiClient,
  private val checkoutRetryStore: CheckoutRetryStore = InMemoryCheckoutRetryStore(),
  private val integrityProvider: PlayIntegrityProofProvider? = null,
  private val pushProvider: FirebasePushRegistrationProvider? = null,
  private val deviceIdentity: DeviceIdentity? = null,
  private val deviceTokenStore: DeviceTokenStore = InMemoryDeviceTokenStore(),
  private val ownerAuthenticator: DeviceOwnerAuthenticator? = null,
  private val bookingApi: BookingApi = accountApi,
  private val checkout: TossCheckoutCoordinator = TossCheckoutCoordinator(client.payments(), checkoutRetryStore),
  private val checkoutPreparer: TossCheckoutPreparer = checkout,
) : CustomerRepository {
  override suspend fun completeNativeLogin(provider: String, code: String): AccountSession =
    client.completeNativeLogin(provider, code)
  override suspend fun home(): HomeContent {
    val catalog = publicApi.catalog()
    val calendar = publicApi.openCalendar()
    val support = publicApi.publicSupport()
    return HomeContent(catalog.events, calendar.entries, support.faqs, support.notices)
  }

  override suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap =
    publicApi.seatMap(eventId, performanceDateId)

  override suspend fun ranking(): List<CatalogEvent> =
    publicApi.catalog().events.sortedByDescending(CatalogEvent::soldCount)

  override suspend fun region(name: String): List<CatalogEvent> {
    val groups = publicApi.regions().regions
    return if (name == "전체 지역") groups.flatMap { it.events }.distinctBy { it.id }
    else groups.firstOrNull { it.name == name || it.slug == name }?.events.orEmpty()
  }

  override suspend fun venue(venueId: String?, venueName: String): List<CatalogEvent> =
    publicApi.catalog().events.filter { (venueId != null && it.venueId == venueId) || it.venue == venueName }

  override suspend fun artist(artistSlug: String?, artistNames: List<String>): List<CatalogEvent> =
    artistSlug?.let { publicApi.artist(it).events }
      ?: publicApi.catalog().events.filter { event -> event.casts.orEmpty().any(artistNames::contains) }

  override suspend fun watchlist(): List<WatchlistItem> = accountApi.watchlist()

  override suspend fun accountOverview(): AccountOverview {
    accountApi.session()
    val tickets = accountApi.tickets()
    val devices = lifecycleApi.trustedDevices()
    val push = lifecycleApi.pushTokens()
    val cancellations = lifecycleApi.cancellationRequests()
    val resalePools = lifecycleApi.resalePools()
    return AccountOverview(
      signedIn = true,
      tickets = tickets.map { ticket ->
        AccountTicketOverview(
          id = ticket.id,
          title = ticket.event?.title ?: "공연 정보 확인 중",
          seatLabel = ticket.seatLabel,
          eligible = LifecyclePolicy.canIssueQr(ticket),
          minimumResalePrice = ticket.minPrice,
          maximumResalePrice = ticket.maxPrice,
          qrState = if (ticket.virtualQr != null) "가상 티켓 발급됨" else "입장 가능 시간 전",
        )
      },
      trustedDevice = devices.any { LifecyclePolicy.canRevoke(it.status) },
      trustedDeviceId = devices.firstOrNull { LifecyclePolicy.canRevoke(it.status) }?.id,
      pushSuffix = push.firstOrNull()?.suffix,
      cancellationPending = cancellations.isNotEmpty(),
      resaleState = resalePools.firstOrNull()?.status?.name,
    )
  }

  override suspend fun book(request: BookingRequest): BookingProgress {
    val entry = bookingApi.enterQueue(request.performanceDateId, request.operationKeys.queue)
    return continueBookingAfterQueue(request, entry)
  }

  override suspend fun refreshBooking(request: BookingRequest, entryId: String): BookingProgress {
    if (entryId.isBlank()) return BookingProgress.Conflict("대기 상태를 확인할 수 없습니다. 다시 시도해 주세요.")
    val entry = bookingApi.queueEntry(entryId)
    if (entry.id != entryId) return BookingProgress.Conflict("대기 상태가 변경되었습니다. 다시 시도해 주세요.")
    return continueBookingAfterQueue(request, entry)
  }

  private suspend fun continueBookingAfterQueue(request: BookingRequest, entry: kr.ticketground.app.data.QueueEntry): BookingProgress {
    if (entry.id.isBlank() || entry.performanceDateId != request.performanceDateId) {
      return BookingProgress.Conflict("대기 상태가 변경되었습니다. 다시 시도해 주세요.")
    }
    when (entry.status) {
      LifecycleStatus.WAITING -> return BookingProgress.Waiting(entry.id, entry.position)
      LifecycleStatus.EXPIRED, LifecycleStatus.LEFT -> return BookingProgress.Expired("대기 입장 시간이 만료되었습니다. 다시 시도해 주세요.")
      LifecycleStatus.ADMITTED -> Unit
      else -> return BookingProgress.Conflict("대기 상태가 변경되었습니다. 좌석 상태를 다시 확인해 주세요.")
    }
    val hold = bookingApi.createSeatHold(
      request.performanceDateId,
      listOf(request.seatId),
      request.operationKeys.hold,
    )
    if (hold.status != LifecycleStatus.ACTIVE) {
      return if (hold.status == LifecycleStatus.EXPIRED || hold.status == LifecycleStatus.RELEASED) {
        BookingProgress.Expired("좌석 확보 시간이 만료되었습니다. 다시 선택해 주세요.")
      } else BookingProgress.Conflict("좌석 상태가 변경되어 확보하지 않았습니다. 다시 확인해 주세요.")
    }
    if (hold.ticketIds != listOf(request.seatId)) {
      val progress = BookingProgress.Conflict("좌석 상태가 변경되어 확보하지 않았습니다. 다시 확인해 주세요.")
      val error = BookingPreparationFailure(progress)
      compensateBooking(hold.id, null, request.operationKeys, error)
      if (error.suppressed.isNotEmpty()) throw error
      return progress
    }
    val draft = try {
      bookingApi.createReservationDraft(hold.id, request.operationKeys.draft)
    } catch (error: Throwable) {
      compensateBooking(hold.id, null, request.operationKeys, error)
      throw error
    }
    if (draft.status != LifecycleStatus.PENDING_PAYMENT || draft.ticketIds != listOf(request.seatId)) {
      val progress = if (draft.status == LifecycleStatus.EXPIRED || draft.status == LifecycleStatus.CANCELLED) {
        BookingProgress.Expired("예매 초안이 만료되었습니다. 다시 시도해 주세요.")
      } else BookingProgress.Conflict("예매 초안 상태가 변경되어 결제를 시작하지 않았습니다.")
      val error = BookingPreparationFailure(progress)
      compensateBooking(hold.id, draft, request.operationKeys, error)
      if (error.suppressed.isNotEmpty()) throw error
      return progress
    }
    val checkoutRequest = try {
      checkoutPreparer.prepare(
        draft,
        request.seatLabel,
        TossPaymentMethod.CREDIT_CARD,
        request.operationKeys.payment,
      )
    } catch (error: Throwable) {
      compensateBooking(hold.id, draft, request.operationKeys, error)
      throw error
    }
    if (!checkoutRequest.matches(draft, request)) {
      val progress = BookingProgress.Conflict("결제 준비 상태가 변경되어 결제를 시작하지 않았습니다.")
      val error = BookingPreparationFailure(progress)
      compensateBooking(hold.id, draft, request.operationKeys, error)
      if (error.suppressed.isNotEmpty()) throw error
      return progress
    }
    return BookingProgress.Held(request.seatId, request.seatLabel, request.amount, checkoutRequest)
  }

  private suspend fun compensateBooking(
    holdId: String,
    draft: ReservationDraft?,
    keys: BookingOperationKeys,
    primary: Throwable,
  ) = withContext(NonCancellable) {
    if (draft?.canCancel == true && draft.id.isNotBlank()) {
      try {
        bookingApi.cancelReservationDraft(draft.id, keys.draftCancel)
      } catch (cleanup: Throwable) {
        if (cleanup !== primary) primary.addSuppressed(cleanup)
      }
    }
    try {
      bookingApi.releaseSeatHold(holdId, keys.holdRelease)
    } catch (cleanup: Throwable) {
      if (cleanup !== primary) primary.addSuppressed(cleanup)
    }
  }

  override suspend fun requestCancellation(ticketId: String, reason: String) {
    lifecycleApi.createCancellationRequest(ticketId, reason, true, "android-cancel-${UUID.randomUUID()}")
  }

  override suspend fun listForResale(ticketId: String, price: Int) {
    lifecycleApi.createResalePool(ticketId, price, null, "android-resale-${UUID.randomUUID()}")
  }

  override suspend fun addToWatchlist(eventId: String) {
    accountApi.upsertWatchlist(eventId, listOf("PUSH"), true, true, "android-watch-${UUID.randomUUID()}")
  }

  override suspend fun supportThreads(): List<SupportThread> = accountApi.supportThreads()

  override suspend fun createSupportThread(subject: String, message: String): SupportThread =
    accountApi.createSupportThread(subject, message, "android-support-${UUID.randomUUID()}")

  override suspend fun completeCheckout(request: TossCheckoutRequest, result: TossWidgetResult): CheckoutOutcome =
    checkout.complete(request, result)

  override suspend fun trustThisDevice() {
    val identity = deviceIdentity ?: throw ExternalProviderError.PlayIntegrityUnavailable
    val provider = integrityProvider ?: throw ExternalProviderError.PlayIntegrityUnavailable
    val authenticated = ownerAuthenticator?.authenticate() == true
    if (!authenticated) throw ExternalProviderError.DeviceAuthenticationRequired
    val binding = lifecycleApi.integrityChallenge(IntegrityPurpose.TRUST_DEVICE, identity.id)
    deviceTokenStore.write(lifecycleApi.trustDevice(identity.name, true, provider.prove(binding)).deviceToken)
  }

  override suspend fun registerPush() {
    val provider = pushProvider ?: throw ExternalProviderError.PushUnavailable
    lifecycleApi.registerPushToken(provider.token(), "android-push-${UUID.randomUUID()}")
  }

  override suspend fun issueAdmissionQr(ticketId: String): AdmissionQr {
    val identity = deviceIdentity ?: throw ExternalProviderError.PlayIntegrityUnavailable
    val provider = integrityProvider ?: throw ExternalProviderError.PlayIntegrityUnavailable
    val token = deviceTokenStore.read()?.takeIf(String::isNotBlank) ?: throw ExternalProviderError.DeviceTrustRequired
    lifecycleApi.virtualTicketQr(ticketId)
    val binding = lifecycleApi.integrityChallenge(IntegrityPurpose.ISSUE_QR, identity.id, ticketId)
    return lifecycleApi.admissionQr(ticketId, identity.id, token, provider.prove(binding))
  }
}

/**
 * True for the two [ApiError] variants that mean "sign in to use this" -- callers that need to
 * branch on that condition (e.g. loadAccount()/loadWatchlist() switching to a calm signed-out
 * card instead of a generic error card) should check this directly rather than pattern-matching
 * [safeUiMessage]'s translated Korean copy: that string is UI-facing and free to reword, and
 * coupling control flow to its exact prefix is exactly what silently broke this detection the
 * last time the copy changed.
 */
fun isSignInRequired(error: Throwable): Boolean =
  error is ApiError.MissingCredential || error is ApiError.Unauthorized

fun safeUiMessage(error: Throwable): String = when (error) {
  is BookingPreparationFailure -> when (val progress = error.progress) {
    is BookingProgress.Expired -> progress.message
    is BookingProgress.Conflict -> progress.message
    else -> "요청을 완료하지 못했습니다. 다시 시도해 주세요."
  }
  // Previously presumed a pre-existing web/iOS session ("웹 또는 iOS에서 로그인한 계정의 연결을
  // 확인해 주세요") -- most Android users hitting this path have no such session, especially now
  // that Android has its own real native login. Plain "sign in" copy, no cross-platform assumption.
  is ApiError.MissingCredential, is ApiError.Unauthorized -> "로그인이 필요합니다. 로그인 후 다시 이용해 주세요."
  is ApiError.Transport, is ApiError.Retryable -> "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
  is ApiError.IncompatibleContract -> "현재 앱과 서버 버전이 맞지 않습니다. 잠시 후 다시 시도해 주세요."
  ExternalProviderError.PlayIntegrityUnavailable -> "이 기기에서는 Play Integrity 확인을 완료할 수 없습니다. 설정을 확인해 주세요."
  ExternalProviderError.PushUnavailable -> "Firebase 알림 설정을 확인할 수 없어 등록하지 않았습니다."
  ExternalProviderError.TossUnavailable -> "Toss Payments 설정을 확인할 수 없어 결제를 시작하지 않았습니다."
  ExternalProviderError.DeviceTrustRequired -> "입장 QR을 발급하려면 먼저 이 기기를 등록해 주세요."
  ExternalProviderError.DeviceAuthenticationRequired -> "기기 등록을 위해 화면 잠금 또는 생체 인증을 완료해 주세요."
  CheckoutError.ProviderUnavailable -> "Toss Payments 설정을 확인할 수 없어 결제를 시작하지 않았습니다."
  CheckoutError.TicketUnavailable -> "결제할 티켓 상태를 확인할 수 없습니다. 좌석을 다시 선택해 주세요."
  else -> "요청을 완료하지 못했습니다. 다시 시도해 주세요."
}

private fun TossCheckoutRequest.matches(draft: ReservationDraft, request: BookingRequest): Boolean =
  draftId == draft.id &&
    ticketId == request.seatId &&
    orderName == request.seatLabel &&
    amount == draft.amount.total &&
    method == TossPaymentMethod.CREDIT_CARD &&
    clientKey.isNotBlank() &&
    idempotencyKey == request.operationKeys.payment
