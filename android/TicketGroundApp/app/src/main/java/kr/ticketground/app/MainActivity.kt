package kr.ticketground.app

import android.os.Bundle
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
    setContent {
      TicketGroundTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
          if (BuildConfig.GATE_APP) {
            TicketGroundGateApp(gateViewModel) {
              scannerLauncher.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("고객의 입장 QR을 비춰주세요"))
            }
          } else {
            val viewModel = ViewModelProvider(this@MainActivity, customerViewModelFactory())[CustomerAppViewModel::class.java]
            TicketGroundCustomerApp(viewModel)
          }
        }
      }
    }
  }

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
