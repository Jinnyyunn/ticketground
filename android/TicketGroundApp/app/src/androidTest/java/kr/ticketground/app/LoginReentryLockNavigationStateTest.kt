package kr.ticketground.app

import androidx.activity.ComponentActivity
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.WatchlistItem
import kr.ticketground.app.ui.AccountOverview
import kr.ticketground.app.ui.BookingProgress
import kr.ticketground.app.ui.BookingRequest
import kr.ticketground.app.ui.CustomerAppViewModel
import kr.ticketground.app.ui.CustomerRepository
import kr.ticketground.app.ui.CustomerRoute
import kr.ticketground.app.ui.HomeContent
import kr.ticketground.app.ui.TicketGroundCustomerApp
import kr.ticketground.app.ui.TicketGroundTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Regression coverage for the P0 where MainActivity's login-reentry biometric lock/unlock swap
 * (see MainActivity.kt's setContent) discarded TicketGroundCustomerApp's NavController back
 * stack: a bare if/else fully removes one composable from composition and adds the other, which
 * tears the NavController down and rebuilds it from scratch. CustomerAppViewModel's own back-stack
 * tracking (canGoBack) survives that swap (it's plain ViewModel state), but the rebuilt
 * NavController does not, so the very next back-press pops a NavController with nothing left to
 * pop while the ViewModel's route already moved on -- NavHost's current entry stops matching the
 * ViewModel's route and nothing renders for it.
 *
 * This test cannot exercise the real biometric gate (no biometric enrollment available in CI/
 * sandbox emulators -- see MainActivity's `gate.locked` and LoginReentryGateController), so it
 * reproduces the exact composable shape MainActivity uses instead: a boolean-driven if/else
 * between two branches, both wrapped in the same rememberSaveableStateHolder()/
 * SaveableStateProvider(key) pairing the real fix uses. rememberNavController() is implemented
 * with rememberSaveable(saver = NavControllerSaver(...)), so this reproduces the same underlying
 * save/restore mechanism the real fix relies on without needing a real fingerprint sensor.
 */
class LoginReentryLockNavigationStateTest {
  @get:Rule val composeRule = createAndroidComposeRule<ComponentActivity>()

  @Test
  fun navigationStateSurvivesLockUnlockSwapAndBackPressStillWorksAfterUnlock() {
    val repository = FixtureRepository()
    val viewModel = CustomerAppViewModel(repository)
    val locked = mutableStateOf(false)

    composeRule.setContent {
      TicketGroundTheme {
        // Mirrors MainActivity's setContent exactly: rememberSaveableStateHolder() wraps both
        // branches under stable keys so each branch's rememberSaveable state (most importantly
        // TicketGroundCustomerApp's NavController) survives being fully removed and re-added.
        val stateHolder = rememberSaveableStateHolder()
        if (locked.value) {
          stateHolder.SaveableStateProvider("locked") {
            Text("잠금 해제", modifier = Modifier.testTag("fixture-lock-screen"))
          }
        } else {
          stateHolder.SaveableStateProvider("unlocked") {
            TicketGroundCustomerApp(viewModel)
          }
        }
      }
    }

    // Given: the user is two screens deep (home tab -> event detail), matching a real user who
    // locked the app mid-browse rather than at the home root.
    composeRule.runOnIdle { viewModel.openEvent(repository.event) }
    composeRule.waitUntil(timeoutMillis = 5_000) {
      composeRule.onAllNodesWithTag("event-venue").fetchSemanticsNodes().isNotEmpty()
    }
    assertEquals(CustomerRoute.Event(repository.event), viewModel.route.value)
    assertTrue(viewModel.canGoBack.value)

    // When: the biometric gate locks and unlocks again -- the exact same kind of composable swap
    // MainActivity performs when `gate.locked.value` flips.
    composeRule.runOnIdle { locked.value = true }
    composeRule.onNodeWithTag("fixture-lock-screen").assertIsDisplayed()
    composeRule.runOnIdle { locked.value = false }

    // Then: still on the event detail screen (the ViewModel's own state was never in doubt --
    // this specifically confirms the freshly remounted TicketGroundCustomerApp's NavHost starts
    // on the matching entry rather than resetting to home).
    composeRule.onNodeWithTag("event-venue").assertIsDisplayed()
    assertTrue(viewModel.canGoBack.value)

    // And, the actual regression: a single real back press (through the same
    // OnBackPressedDispatcher CustomerApp.kt's BackHandler registers against) returns to home
    // instead of leaving a blank screen. Before the fix, the rebuilt NavController had nothing
    // left to pop, so NavHost's current entry stayed on "event" while the ViewModel's route had
    // already moved back to Tab/Home -- and the "event" composable's `(route as?
    // CustomerRoute.Event)?.let { ... }` guard rendered nothing for the mismatch.
    composeRule.runOnUiThread { composeRule.activity.onBackPressedDispatcher.onBackPressed() }
    composeRule.waitUntil(timeoutMillis = 5_000) {
      composeRule.onAllNodesWithTag("home-list").fetchSemanticsNodes().isNotEmpty()
    }
    composeRule.onNodeWithTag("home-list").assertIsDisplayed()
    assertEquals(CustomerRoute.Tab, viewModel.route.value)
    assertEquals(AppDestination.Home, viewModel.destination.value)
  }
}

private class FixtureRepository : CustomerRepository {
  val event = CatalogEvent(
    id = "event-1",
    category = "콘서트",
    title = "서울 콘서트",
    venue = "잠실주경기장",
    soldCount = 42,
  )

  override suspend fun home() = HomeContent(
    events = listOf(event),
    calendar = emptyList(),
    faq = emptyList(),
    notices = emptyList(),
  )
  override suspend fun seatMap(eventId: String, performanceDateId: String?): SeatMap = error("not used")
  override suspend fun watchlist(): List<WatchlistItem> = emptyList()
  override suspend fun accountOverview() = AccountOverview(signedIn = false)
  override suspend fun book(request: BookingRequest): BookingProgress = error("not used")
  override suspend fun requestCancellation(ticketId: String, reason: String) = Unit
  override suspend fun listForResale(ticketId: String, price: Int) = Unit
  override suspend fun addToWatchlist(eventId: String) = Unit
}
