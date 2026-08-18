package kr.ticketground.app

import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.data.GoogleFirebaseTokenSource
import kr.ticketground.app.data.GooglePlayIntegrityTokenRequester
import kr.ticketground.app.data.AndroidDeviceOwnerAuthenticator
import kr.ticketground.app.data.PlatformProviderFactory
import kr.ticketground.app.data.PersistentCheckoutRetryStore
import kr.ticketground.app.data.SharedPreferencesCheckoutRetryPersistence
import kr.ticketground.app.foundation.KeystoreSessionVault
import kr.ticketground.app.foundation.KeystoreDeviceTokenStore
import kr.ticketground.app.ui.CustomerAppViewModel
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

class MainActivity : AppCompatActivity() {
  private var customerViewModel: CustomerAppViewModel? = null
  private lateinit var gateViewModel: GateScannerViewModel
  private val scannerLauncher = registerForActivityResult(ScanContract()) { result ->
    if (::gateViewModel.isInitialized && result.contents != null) gateViewModel.verify(gateViewModel.gateToken, result.contents)
  }
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
            TicketGroundCustomerApp(viewModel, ::startSocialLogin)
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

  private fun startSocialLogin(provider: String) {
    val uri = Uri.parse("${BuildConfig.API_BASE_URL.trimEnd('/')}/api/auth/$provider/start?client=ios")
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
        val client = TicketGroundApiClient.create(KeystoreSessionVault(applicationContext))
        val checkoutStore = PersistentCheckoutRetryStore(
          SharedPreferencesCheckoutRetryPersistence(
            applicationContext.getSharedPreferences("ticketground_checkout", MODE_PRIVATE),
          ),
        )
        val identity = DeviceIdentity(
          Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID),
          Build.MODEL.ifBlank { "Android" },
        )
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
        ) as T
      }
    }
  }

  private fun gateViewModelFactory(): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
      require(modelClass == GateScannerViewModel::class.java)
      return GateScannerViewModel(TicketGroundApiClient.create(KeystoreSessionVault(applicationContext)).gate()) as T
    }
  }

}
