package kr.ticketground.app.ui

import java.util.UUID
import kr.ticketground.app.data.AccountApi
import kr.ticketground.app.data.AccountSession
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
import kr.ticketground.app.data.CheckoutOutcome
import kr.ticketground.app.data.CheckoutError
import kr.ticketground.app.data.CheckoutRetryStore
import kr.ticketground.app.data.ExternalProviderError
import kr.ticketground.app.data.FirebasePushRegistrationProvider
import kr.ticketground.app.data.InMemoryCheckoutRetryStore
import kr.ticketground.app.data.IntegrityPurpose
import kr.ticketground.app.data.PlayIntegrityProofProvider
import kr.ticketground.app.data.TossCheckoutCoordinator
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

data class HomeContent(
  val events: List<CatalogEvent>,
  val calendar: List<OpenCalendarEntry>,
  val faq: List<SupportFaq>,
  val notices: List<SupportNotice>,
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
  val pushSuffix: String? = null,
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
  data class Waiting(val position: Int) : BookingProgress
  data class Held(val seatId: String, val seatLabel: String, val amount: Int, val checkout: TossCheckoutRequest) : BookingProgress
}

data class DeviceIdentity(val id: String, val name: String)

interface CustomerRepository {
  suspend fun home(): HomeContent
  suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap
  suspend fun watchlist(): List<WatchlistItem>
  suspend fun accountOverview(): AccountOverview
  suspend fun book(performanceDateId: String, seatId: String, seatLabel: String, amount: Int): BookingProgress
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
) : CustomerRepository {
  private val checkout = TossCheckoutCoordinator(client.payments(), checkoutRetryStore)

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

  override suspend fun watchlist(): List<WatchlistItem> = accountApi.watchlist()

  override suspend fun accountOverview(): AccountOverview {
    accountApi.session()
    val tickets = accountApi.tickets()
    val devices = lifecycleApi.trustedDevices()
    val push = lifecycleApi.pushTokens()
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
      pushSuffix = push.firstOrNull()?.suffix,
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
    val draft = accountApi.createReservationDraft(hold.id, "android-draft-${UUID.randomUUID()}")
    if (draft.status != LifecycleStatus.PENDING_PAYMENT || draft.ticketIds != listOf(seatId)) {
      throw IllegalStateException("결제 대상을 안전하게 준비하지 못했습니다.")
    }
    val request = checkout.prepare(
      draft,
      seatLabel,
      TossPaymentMethod.CREDIT_CARD,
      "android-payment-${UUID.randomUUID()}",
    )
    return BookingProgress.Held(seatId, seatLabel, amount, request)
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

fun safeUiMessage(error: Throwable): String = when (error) {
  is ApiError.MissingCredential, is ApiError.Unauthorized -> "로그인이 필요한 기능입니다. 웹 또는 iOS에서 로그인한 계정의 연결을 확인해 주세요."
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
