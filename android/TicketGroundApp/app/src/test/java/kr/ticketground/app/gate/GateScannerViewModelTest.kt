package kr.ticketground.app.gate

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.runBlocking
import kr.ticketground.app.data.GateApi
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.foundation.InMemoryGateTokenVault
import kr.ticketground.app.foundation.InMemorySessionVault
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

// Covers the persistence gap fixed alongside the result-tone UX work: an
// operator's gate device token used to live only in Compose `remember`
// state, so it vanished on every process death (routine under memory
// pressure across a multi-hour event) and had to be retyped from a
// password-masked field. GateScannerViewModel now restores it from
// GateTokenVault on init and persists it the moment a scan is attempted.
@OptIn(ExperimentalCoroutinesApi::class)
class GateScannerViewModelTest {
  private val dispatcher = StandardTestDispatcher()
  private lateinit var server: MockWebServer

  @Before
  fun setUp() {
    Dispatchers.setMain(dispatcher)
    server = MockWebServer()
    server.start()
  }

  @After
  fun tearDown() {
    server.shutdown()
    Dispatchers.resetMain()
  }

  private fun gateApi(): GateApi =
    TicketGroundApiClient.forTesting(server.url("/"), InMemorySessionVault()).gate()

  @Test
  fun `a token previously stored in the vault is restored on startup`() = runTest(dispatcher) {
    val vault = InMemoryGateTokenVault()
    vault.store("previously-saved-token")

    val viewModel = GateScannerViewModel(gateApi(), vault)
    advanceUntilIdle()

    assertEquals("previously-saved-token", viewModel.restoredToken.value)
  }

  @Test
  fun `no stored token restores as null rather than an empty placeholder`() = runTest(dispatcher) {
    val viewModel = GateScannerViewModel(gateApi(), InMemoryGateTokenVault())
    advanceUntilIdle()

    assertNull(viewModel.restoredToken.value)
  }

  @Test
  fun `verifying persists the gate token so the next launch does not require retyping it`() = runTest(dispatcher) {
    server.enqueue(MockResponse().setBody("""{"ok":true,"data":{"valid":true}}""").setResponseCode(200))
    val vault = InMemoryGateTokenVault()
    val viewModel = GateScannerViewModel(gateApi(), vault)
    advanceUntilIdle()

    viewModel.verify(
      "device-gate-token",
      """{"ticketId":"t","ownerId":"u","expiresAt":"2026-09-30T10:00:20Z","nonce":"n","signature":"s"}""",
    )
    advanceUntilIdle()

    assertEquals("device-gate-token", runBlocking { vault.read() })
  }

  @Test
  fun `a malformed QR still persists the token - a misread scan is the common case, not the exception`() = runTest(dispatcher) {
    val vault = InMemoryGateTokenVault()
    val viewModel = GateScannerViewModel(gateApi(), vault)
    advanceUntilIdle()

    viewModel.verify("device-gate-token", "not a ticket at all")
    advanceUntilIdle()

    assertEquals(GateScanState.Status.ERROR, viewModel.state.value.status)
    assertEquals("device-gate-token", runBlocking { vault.read() })
    assertEquals("a malformed QR must not reach the network at all", 0, server.requestCount)
  }
}
