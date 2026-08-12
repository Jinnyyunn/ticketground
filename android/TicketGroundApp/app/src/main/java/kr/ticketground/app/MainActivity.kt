package kr.ticketground.app

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.foundation.KeystoreSessionVault
import kr.ticketground.app.ui.CustomerAppViewModel
import kr.ticketground.app.ui.TicketGroundCustomerApp
import kr.ticketground.app.ui.TicketGroundTheme
import kr.ticketground.app.ui.TypedCustomerRepository

class MainActivity : ComponentActivity() {
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
        return CustomerAppViewModel(
          TypedCustomerRepository(client.public(), client.account(), client.lifecycle(), client),
        ) as T
      }
    }
  }
}
