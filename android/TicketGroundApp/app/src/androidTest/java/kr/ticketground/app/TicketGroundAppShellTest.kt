package kr.ticketground.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.material3.MaterialTheme
import kr.ticketground.app.foundation.TicketGroundAppShell
import kr.ticketground.app.foundation.UiState
import org.junit.Rule
import org.junit.Test

class TicketGroundAppShellTest {
  @get:Rule val composeRule = createComposeRule()

  @Test
  fun `Given the foundation shell When it is rendered Then home navigation is visible`() {
    composeRule.setContent {
      MaterialTheme {
        TicketGroundAppShell(
          state = UiState.Loading(destination = "홈"),
          onNavigate = {},
        ) {}
      }
    }

    composeRule.onNodeWithText("홈").assertIsDisplayed()
  }
}
