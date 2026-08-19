package kr.ticketground.app

import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kr.ticketground.app.data.Catalog
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.data.GoogleFirebaseTokenSource
import kr.ticketground.app.data.GooglePlayIntegrityTokenRequester
import kr.ticketground.app.data.AndroidDeviceOwnerAuthenticator
import kr.ticketground.app.data.AndroidLoginGateAuthenticator
import kr.ticketground.app.data.PlatformProviderFactory
import kr.ticketground.app.data.PersistentCheckoutRetryStore
import kr.ticketground.app.data.SharedPreferencesCheckoutRetryPersistence
import kr.ticketground.app.data.biometricAuthenticationAvailable
import kr.ticketground.app.foundation.CatalogCacheStore
import kr.ticketground.app.foundation.KeystoreSessionVault
import kr.ticketground.app.foundation.KeystoreDeviceTokenStore
import kr.ticketground.app.foundation.LoginReentryGateController
import kr.ticketground.app.foundation.SharedPreferencesBiometricLoginGatePreference
import kr.ticketground.app.ui.CustomerAppViewModel
import kr.ticketground.app.ui.LoginReentryLockScreen
import kr.ticketground.app.ui.TicketGroundCustomerApp
import kr.ticketground.app.ui.TicketGroundTheme
import kr.ticketground.app.ui.TypedCustomerRepository
import kr.ticketground.app.ui.DeviceIdentity
import android.os.Build
import android.provider.Settings
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kr.ticketground.app.gate.GateScannerViewModel
import kr.ticketground.app.gate.TicketGroundGateApp

/**
 * Rotation-survivable holder for the login-reentry biometric gate's UI state (see
 * [LoginReentryGateController] for the framework-free decision logic this wraps). A plain
 * Activity field would reset every time the Activity is recreated for a configuration change
 * (e.g. rotation), which would re-lock the screen on every rotation even though the user never
 * left the app -- an AndroidX ViewModel is the standard tool for state that must survive
 * recreation-for-config-change but not a fresh process, matching this feature's intended scope
 * exactly (see MainActivity#onStop's isChangingConfigurations guard for the other half of this).
 */
class LoginGateViewModel : ViewModel() {
  var initialized: Boolean = false
  val locked = mutableStateOf(false)
  val unlocking = mutableStateOf(false)
  val unlockFailed = mutableStateOf(false)
  val biometricGateEnabled = mutableStateOf(false)
}

class MainActivity : AppCompatActivity() {
  private var customerViewModel: CustomerAppViewModel? = null
  private var loginGateViewModel: LoginGateViewModel? = null
  private lateinit var gateViewModel: GateScannerViewModel
  private val scannerLauncher = registerForActivityResult(ScanContract()) { result ->
    if (::gateViewModel.isInitialized && result.contents != null) gateViewModel.verify(gateViewModel.gateToken, result.contents)
  }
  private val sessionVault by lazy { KeystoreSessionVault(applicationContext) }
  private val biometricGatePreference by lazy { SharedPreferencesBiometricLoginGatePreference(applicationContext) }
  private val loginGateController by lazy { LoginReentryGateController(sessionVault, biometricGatePreference) }
  private val biometricGateAvailable by lazy { biometricAuthenticationAvailable(applicationContext) }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE,
    )
    if (BuildConfig.GATE_APP) {
      gateViewModel = ViewModelProvider(this, gateViewModelFactory())[GateScannerViewModel::class.java]
    }
    if (!BuildConfig.GATE_APP) {
      customerViewModel = ViewModelProvider(this, customerViewModelFactory())[CustomerAppViewModel::class.java]
      val gate = ViewModelProvider(this)[LoginGateViewModel::class.java]
      loginGateViewModel = gate
      // Only ever compute the starting lock state once per ViewModel instance (i.e. once per
      // process, not once per onCreate call) -- onCreate also runs after a rotation recreates the
      // Activity, and re-deriving from "does a session exist" at that point would re-lock a
      // screen the user never actually left.
      if (!gate.initialized) {
        gate.initialized = true
        lifecycleScope.launch {
          gate.biometricGateEnabled.value = biometricGatePreference.isEnabled()
          gate.locked.value = loginGateController.shouldLock()
        }
      }
    }
    setContent {
      TicketGroundTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
          if (BuildConfig.GATE_APP) {
            TicketGroundGateApp(gateViewModel) {
              scannerLauncher.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("고객의 입장 QR을 비춰주세요"))
            }
          } else {
            val viewModel = requireNotNull(customerViewModel)
            val gate = requireNotNull(loginGateViewModel)
            // The lock/unlock branch below fully removes one composable from composition and
            // adds the other -- TicketGroundCustomerApp's rememberNavController() is NOT hoisted
            // above this if/else, so a bare if/else would tear the NavController down and rebuild
            // it from scratch on every lock<->unlock swap, discarding its back stack. That leaves
            // the NavController with a single entry while CustomerAppViewModel's own back-stack
            // tracking (canGoBack) still remembers the real depth, so the very next back-press
            // pops a NavController that has nothing left to pop -- the screen goes blank because
            // NavHost's current entry no longer matches the ViewModel's route.
            //
            // rememberSaveableStateHolder() is the standard Compose fix for exactly this shape
            // (mutually-exclusive branches that must each preserve their own rememberSaveable
            // state across being fully removed and re-added, the same pattern used for
            // bottom-navigation tab content). rememberNavController() itself is implemented with
            // rememberSaveable(saver = NavControllerSaver(...)), so keyed SaveableStateProvider
            // blocks are enough to restore the NavController's back stack on unlock without
            // hoisting the controller out of TicketGroundCustomerApp or changing its signature.
            val lockStateHolder = rememberSaveableStateHolder()
            if (gate.locked.value) {
              lockStateHolder.SaveableStateProvider("login-reentry-locked") {
                LoginReentryLockScreen(
                  onUnlock = { attemptLoginGateUnlock(gate) },
                  unlocking = gate.unlocking.value,
                  failed = gate.unlockFailed.value,
                  onLogout = { logOut(gate) },
                )
              }
            } else {
              lockStateHolder.SaveableStateProvider("customer-app") {
                TicketGroundCustomerApp(
                  viewModel,
                  ::startSocialLogin,
                  biometricLoginGateAvailable = biometricGateAvailable,
                  biometricLoginGateEnabled = gate.biometricGateEnabled.value,
                  onToggleBiometricLoginGate = { enable -> toggleBiometricLoginGate(gate, enable) },
                )
              }
            }
          }
        }
      }
    }
    handleNativeCallback(intent)
    handleDeepLink(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleNativeCallback(intent)
    handleDeepLink(intent)
  }

  /**
   * Login re-entry gate only -- never the initial OAuth grant. Re-checks whenever the app leaves
   * the foreground for a real reason (backgrounded, not a rotation): if the user opted in and a
   * session already exists, the next time this Activity becomes visible it shows the lock screen
   * instead of the app's normal content. `isChangingConfigurations` excludes the
   * destroy-then-immediately-recreate cycle a rotation triggers -- without that guard, every
   * rotation would relock the screen even though the user never actually left the app.
   */
  override fun onStop() {
    super.onStop()
    if (BuildConfig.GATE_APP || isChangingConfigurations) return
    val gate = loginGateViewModel ?: return
    lifecycleScope.launch {
      if (loginGateController.shouldLock()) gate.locked.value = true
    }
  }

  /**
   * Logs the user out, callable both from mypage (normal in-app entry point) and directly from
   * [LoginReentryLockScreen]'s escape hatch with no biometric confirmation required first --
   * logging out doesn't need proof-of-identity, only *staying* logged in behind the gate does. A
   * user who loses biometric enrollment (an ordinary Settings action) with no DEVICE_CREDENTIAL
   * fallback would otherwise be locked out permanently with no in-app recovery.
   *
   * [CustomerAppViewModel.logOut] clears the persisted session (SessionVault.clear(), already
   * implemented but unused before this) and all signed-in-scoped in-memory state; this function
   * additionally drops the lock screen immediately rather than waiting for the next onStop/resume
   * cycle to notice there is no session left to protect.
   */
  private fun logOut(gate: LoginGateViewModel) {
    customerViewModel?.logOut()
    gate.locked.value = false
    gate.unlocking.value = false
    gate.unlockFailed.value = false
  }

  private fun attemptLoginGateUnlock(gate: LoginGateViewModel) {
    if (gate.unlocking.value) return
    gate.unlocking.value = true
    gate.unlockFailed.value = false
    lifecycleScope.launch {
      val confirmed = AndroidLoginGateAuthenticator(this@MainActivity).authenticate()
      gate.unlocking.value = false
      if (confirmed) gate.locked.value = false else gate.unlockFailed.value = true
    }
  }

  /**
   * Togglable setting living next to "trust this device" (TrustedDeviceScreen) -- not forced on
   * for everyone. Turning it ON requires a successful biometric confirmation first (proves the
   * enrollment actually works before relying on it); turning it OFF is a plain settings flip with
   * no extra friction, consistent with how a settings toggle reads elsewhere.
   */
  private fun toggleBiometricLoginGate(gate: LoginGateViewModel, enable: Boolean) {
    if (!enable) {
      lifecycleScope.launch {
        biometricGatePreference.setEnabled(false)
        gate.biometricGateEnabled.value = false
      }
      return
    }
    lifecycleScope.launch {
      val confirmed = AndroidLoginGateAuthenticator(this@MainActivity).authenticate()
      if (confirmed) {
        biometricGatePreference.setEnabled(true)
        gate.biometricGateEnabled.value = true
      }
    }
  }

  private fun startSocialLogin(provider: String) {
    // "android" is an honest client label the backend treats identically to "ios" -- both select
    // the native ticketground:// deep-link handoff branch in backend/social-oauth.js rather than
    // the browser cookie-session branch built for the website. This used to hardcode "ios" (a
    // landmine for anyone "fixing" it without also updating the backend); see social-oauth.js's
    // NATIVE_CLIENTS set for the other side of this contract.
    val uri = Uri.parse("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/auth/$provider/start?client=android")
    startActivity(Intent(Intent.ACTION_VIEW, uri))
  }

  private fun handleNativeCallback(intent: Intent?) {
    val data = intent?.data ?: return
    if (data.scheme != "ticketground" || data.host != "auth" || data.path != "/social/callback") return
    val provider = data.getQueryParameter("provider") ?: return
    val code = data.getQueryParameter("code")
    val error = data.getQueryParameter("error")
    if (code.isNullOrBlank()) {
      customerViewModel?.nativeLoginFailed(
        when (error) {
          "denied" -> "로그인을 취소했습니다."
          "not_configured" -> "로그인 서비스를 사용할 수 없습니다."
          "state_invalid" -> "로그인 연결 정보가 만료되었습니다. 다시 시도해 주세요."
          else -> "로그인에 실패했습니다. 다시 시도해 주세요."
        },
      )
      return
    }
    customerViewModel?.completeNativeLogin(provider, code)
  }

  /**
   * Android App Links entry point (see AndroidManifest's `prodCustomer`/`devCustomer` intent
   * filters and `assetlinks.json` at the web app's `/.well-known/` route). Only a couple of
   * routes are mapped — the home route is a no-op (the app already opens to home) and the event
   * detail / watchlist routes hand off to the ViewModel, which resolves an event slug against
   * whatever catalog is cached (or fetches it) and falls back to the home tab rather than
   * failing closed if a route can't be resolved.
   */
  private fun handleDeepLink(intent: Intent?) {
    if (BuildConfig.GATE_APP) return
    val data = intent?.data ?: return
    if (data.scheme != "https") return
    val path = data.path.orEmpty()
    when {
      path.isBlank() || path == "/" -> Unit
      path == "/watchlist" || path.startsWith("/watchlist/") -> customerViewModel?.openWatchlistDeepLink()
      path.startsWith("/booking/") -> deepLinkSlug(path, "/booking/")?.let { customerViewModel?.openEventDeepLink(it) }
      path.startsWith("/goods/") -> deepLinkSlug(path, "/goods/")?.let { customerViewModel?.openEventDeepLink(it) }
    }
  }

  private fun deepLinkSlug(path: String, prefix: String): String? =
    path.removePrefix(prefix).substringBefore('/').takeIf { it.isNotBlank() }

  private fun customerViewModelFactory(): ViewModelProvider.Factory {
    return object : ViewModelProvider.Factory {
      @Suppress("UNCHECKED_CAST")
      override fun <T : ViewModel> create(modelClass: Class<T>): T {
        require(modelClass == CustomerAppViewModel::class.java)
        val client = TicketGroundApiClient.create(sessionVault)
        val checkoutStore = PersistentCheckoutRetryStore(
          SharedPreferencesCheckoutRetryPersistence(
            applicationContext.getSharedPreferences("ticketground_checkout", MODE_PRIVATE),
          ),
        )
        val identity = DeviceIdentity(
          Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID),
          Build.MODEL.ifBlank { "Android" },
        )
        // Best-effort only: a missing cache (fresh install, never synced yet) or a corrupt/
        // schema-mismatched blob just falls back to null -- exactly what CustomerAppViewModel
        // already treats as "no seed, start on the Loading skeleton like before."
        val cachedHomeEvents = runCatching {
          CatalogCacheStore(applicationContext).readCatalogJson()
            ?.let { TicketGroundApiClient.JSON.decodeFromString(Catalog.serializer(), it).events }
        }.getOrNull()
        return CustomerAppViewModel(
          TypedCustomerRepository(
            client.public(), client.account(), client.lifecycle(), client,
            checkoutStore,
            PlatformProviderFactory.playIntegrity(GooglePlayIntegrityTokenRequester(applicationContext)),
            PlatformProviderFactory.push(GoogleFirebaseTokenSource()),
            identity,
            KeystoreDeviceTokenStore(applicationContext),
            AndroidDeviceOwnerAuthenticator(this@MainActivity),
          ),
          cachedHomeEvents = cachedHomeEvents,
        ) as T
      }
    }
  }

  private fun gateViewModelFactory(): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
      require(modelClass == GateScannerViewModel::class.java)
      return GateScannerViewModel(TicketGroundApiClient.create(sessionVault).gate()) as T
    }
  }

}
