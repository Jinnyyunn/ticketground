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

class MainActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE,
    )
    val viewModel = ViewModelProvider(this, customerViewModelFactory())[CustomerAppViewModel::class.java]
    setContent {
      TicketGroundTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
          TicketGroundCustomerApp(viewModel)
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
}
