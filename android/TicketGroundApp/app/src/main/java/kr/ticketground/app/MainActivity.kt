package kr.ticketground.app

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import kr.ticketground.app.foundation.AppShellViewModel
import kr.ticketground.app.foundation.TicketGroundAppShell

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE,
    )
    setContent {
      TicketGroundTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
          TicketGroundRoot()
        }
      }
    }
  }
}

@Composable
private fun TicketGroundRoot(viewModel: AppShellViewModel = viewModel()) {
  val state by viewModel.state.collectAsStateWithLifecycle()
  val navController = rememberNavController()
  TicketGroundAppShell(
    state = state,
    onNavigate = { destination -> navController.navigate(destination.route) },
  ) {
    NavHost(navController = navController, startDestination = AppDestination.Home.route) {
      AppDestination.entries.forEach { destination ->
        composable(destination.route) { destination.Content() }
      }
    }
  }
}

@Composable
private fun TicketGroundTheme(content: @Composable () -> Unit) {
  MaterialTheme(content = content)
}
