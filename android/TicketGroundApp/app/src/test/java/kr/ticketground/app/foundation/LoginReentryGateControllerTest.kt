package kr.ticketground.app.foundation

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LoginReentryGateControllerTest {
  @Test
  fun `Given the toggle is off When a session exists Then the gate never locks`() = runTest {
    val vault = InMemorySessionVault().apply { store(BearerSession("issued-bearer")) }
    val controller = LoginReentryGateController(vault, InMemoryBiometricLoginGatePreference(initial = false))

    assertFalse(controller.shouldLock())
  }

  @Test
  fun `Given the toggle is on When no session exists yet Then the gate never locks`() = runTest {
    // A fresh install, or a signed-out user, has nothing to protect -- the gate is login-reentry
    // only and must never interfere with the initial OAuth grant itself.
    val controller = LoginReentryGateController(InMemorySessionVault(), InMemoryBiometricLoginGatePreference(initial = true))

    assertFalse(controller.shouldLock())
  }

  @Test
  fun `Given the toggle is on and a session exists Then the gate locks`() = runTest {
    val vault = InMemorySessionVault().apply { store(BearerSession("issued-bearer")) }
    val controller = LoginReentryGateController(vault, InMemoryBiometricLoginGatePreference(initial = true))

    assertTrue(controller.shouldLock())
  }

  @Test
  fun `Given the toggle is on and a session exists When the session is cleared Then the gate stops locking`() = runTest {
    val vault = InMemorySessionVault().apply { store(BearerSession("issued-bearer")) }
    val controller = LoginReentryGateController(vault, InMemoryBiometricLoginGatePreference(initial = true))
    assertTrue(controller.shouldLock())

    vault.clear()

    assertFalse(controller.shouldLock())
  }
}
