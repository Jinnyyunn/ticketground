package kr.ticketground.app.foundation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kr.ticketground.app.AppDestination

class AppShellViewModel : ViewModel() {
  private val mutableState = MutableStateFlow<UiState>(UiState.Loading(destination = "홈"))
  val state: StateFlow<UiState> = mutableState.asStateFlow()
}

@Composable
fun TicketGroundAppShell(
  state: UiState,
  onNavigate: (AppDestination) -> Unit,
  content: @Composable () -> Unit,
) {
  NavigationSuiteScaffold(
    navigationSuiteItems = {
      AppDestination.entries.forEach { destination ->
        item(
          selected = destination == AppDestination.Home,
          onClick = { onNavigate(destination) },
          icon = { Text(destination.shortLabel) },
          label = { Text(destination.label) },
        )
      }
    },
  ) {
    AppStateSurface(state = state, content = content)
  }
}

@Composable
fun AppStateSurface(state: UiState, content: @Composable () -> Unit) {
  when (state) {
    is UiState.Loading -> content()
    is UiState.Empty -> StateMessage(title = state.title, message = state.description)
    is UiState.Error -> StateMessage(title = "문제가 발생했어요", message = state.message)
  }
}

@Composable
private fun StateMessage(title: String, message: String) {
  Column(
    modifier = Modifier.fillMaxSize().padding(24.dp),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    Text(text = title)
    Text(text = message)
    Button(onClick = {}) { Text(text = "다시 시도") }
  }
}
