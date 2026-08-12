package kr.ticketground.app.data

import android.content.SharedPreferences
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString

@Serializable
data class TossConfig(val configured: Boolean, val clientKey: String)

enum class TossPaymentMethod { CREDIT_CARD, SIMPLE_PAY, BANK_TRANSFER, MOBILE }

data class TossCheckoutRequest(
  val ticketId: String,
  val orderName: String,
  val amount: Int,
  val method: TossPaymentMethod,
  val clientKey: String,
  val idempotencyKey: String,
)

sealed class TossWidgetResult {
  data class Success(val paymentKey: String) : TossWidgetResult()
  data class Failed(val code: String) : TossWidgetResult()
  data object Cancelled : TossWidgetResult()
}

sealed class CheckoutOutcome {
  data class Confirmed(val ticket: OwnedTicket) : CheckoutOutcome()
  data class Failed(val code: String) : CheckoutOutcome()
  data object Cancelled : CheckoutOutcome()
}

sealed class CheckoutError(message: String) : Exception(message) {
  data object ProviderUnavailable : CheckoutError("Toss Payments is not configured")
  data object TicketUnavailable : CheckoutError("Owned ticket is unavailable")
}

interface TossCheckoutGateway {
  suspend fun config(): TossConfig
  suspend fun ownedTicket(ticketId: String): OwnedTicket
  suspend fun confirm(request: TossCheckoutRequest, paymentKey: String)
}

data class CheckoutRetryState(val ticketId: String, val idempotencyKey: String, val confirmed: Boolean) {
  val paymentKey: String? get() = null
}

interface CheckoutRetryStore {
  fun read(): CheckoutRetryState?
  fun write(value: CheckoutRetryState)
}

interface CheckoutRetryPersistence {
  fun string(key: String): String?
  fun boolean(key: String): Boolean
  fun putString(key: String, value: String)
  fun putBoolean(key: String, value: Boolean)
}

class PersistentCheckoutRetryStore(private val persistence: CheckoutRetryPersistence) : CheckoutRetryStore {
  override fun read(): CheckoutRetryState? {
    val ticketId = persistence.string(TICKET_ID)?.takeIf(String::isNotBlank) ?: return null
    val key = persistence.string(IDEMPOTENCY_KEY)?.takeIf(String::isNotBlank) ?: return null
    return CheckoutRetryState(ticketId, key, persistence.boolean(CONFIRMED))
  }

  override fun write(value: CheckoutRetryState) {
    persistence.putString(TICKET_ID, value.ticketId)
    persistence.putString(IDEMPOTENCY_KEY, value.idempotencyKey)
    persistence.putBoolean(CONFIRMED, value.confirmed)
  }

  private companion object {
    const val TICKET_ID = "ticketId"
    const val IDEMPOTENCY_KEY = "idempotencyKey"
    const val CONFIRMED = "confirmed"
  }
}

class SharedPreferencesCheckoutRetryPersistence(
  private val preferences: SharedPreferences,
) : CheckoutRetryPersistence {
  override fun string(key: String): String? = preferences.getString(key, null)
  override fun boolean(key: String): Boolean = preferences.getBoolean(key, false)
  override fun putString(key: String, value: String) { preferences.edit().putString(key, value).apply() }
  override fun putBoolean(key: String, value: Boolean) { preferences.edit().putBoolean(key, value).apply() }
}

class InMemoryCheckoutRetryStore : CheckoutRetryStore {
  private var state: CheckoutRetryState? = null
  override fun read(): CheckoutRetryState? = state
  override fun write(value: CheckoutRetryState) { state = value }
}

class TossCheckoutCoordinator(
  private val gateway: TossCheckoutGateway,
  private val retryStore: CheckoutRetryStore,
) {
  private var confirmedTicket: OwnedTicket? = null

  suspend fun prepare(ticketId: String, method: TossPaymentMethod, idempotencyKey: String): TossCheckoutRequest {
    require(idempotencyKey.isNotBlank())
    val config = gateway.config()
    if (!config.configured || config.clientKey.isBlank()) throw CheckoutError.ProviderUnavailable
    val ticket = gateway.ownedTicket(ticketId)
    if (ticket.status != "PENDING_PAYMENT" || ticket.available) throw CheckoutError.TicketUnavailable
    val prior = retryStore.read()
    val stableKey = prior?.takeIf { it.ticketId == ticketId && !it.confirmed }?.idempotencyKey ?: idempotencyKey
    retryStore.write(CheckoutRetryState(ticketId, stableKey, false))
    return TossCheckoutRequest(
      ticket.id, ticket.seatLabel, ticket.faceValue + SERVICE_FEE_KRW, method, config.clientKey, stableKey,
    )
  }

  suspend fun complete(request: TossCheckoutRequest, result: TossWidgetResult): CheckoutOutcome = when (result) {
    TossWidgetResult.Cancelled -> CheckoutOutcome.Cancelled
    is TossWidgetResult.Failed -> CheckoutOutcome.Failed(result.code)
    is TossWidgetResult.Success -> confirm(request, result.paymentKey)
  }

  private suspend fun confirm(request: TossCheckoutRequest, paymentKey: String): CheckoutOutcome {
    val state = retryStore.read()
    if (state?.confirmed == true && state.ticketId == request.ticketId) {
      return CheckoutOutcome.Confirmed(confirmedTicket ?: gateway.ownedTicket(request.ticketId))
    }
    require(paymentKey.isNotBlank())
    gateway.confirm(request, paymentKey)
    retryStore.write(CheckoutRetryState(request.ticketId, request.idempotencyKey, true))
    return CheckoutOutcome.Confirmed(gateway.ownedTicket(request.ticketId).also { confirmedTicket = it })
  }

  private companion object { const val SERVICE_FEE_KRW = 2_000 }
}

class TossPaymentApi internal constructor(
  private val client: TicketGroundApiClient,
  private val account: AccountApi,
) : TossCheckoutGateway {
  override suspend fun config(): TossConfig {
    client.requireAccountPrerequisites()
    return client.execute(ApiRequest(path = "/api/payments/tosspayments/config"), TossConfig.serializer())
  }

  override suspend fun ownedTicket(ticketId: String): OwnedTicket =
    account.tickets().firstOrNull { it.id == ticketId } ?: throw CheckoutError.TicketUnavailable

  override suspend fun confirm(request: TossCheckoutRequest, paymentKey: String) {
    require(paymentKey.isNotBlank())
    val principal = account.session()
    client.execute(
      ApiRequest(
        method = "POST",
        path = "/api/payments/tosspayments/purchase",
        body = TicketGroundApiClient.JSON.encodeToString(
          TossConfirmBody(principal.id, request.ticketId, request.method, paymentKey),
        ),
        idempotencyKey = request.idempotencyKey,
        authenticated = true,
      ),
      TossPurchaseResult.serializer(),
    )
  }
}

@Serializable
private data class TossConfirmBody(
  val userId: String,
  val ticketId: String,
  val paymentMethod: TossPaymentMethod,
  val tossPaymentKey: String,
)

@Serializable private data class TossPurchaseResult(val ticket: TossPurchaseTicket)
@Serializable private data class TossPurchaseTicket(val id: String, val seatLabel: String)
