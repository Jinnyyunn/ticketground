package kr.ticketground.app.foundation

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SessionVaultTest {
  @Test
  fun `Given an empty vault When a bearer is stored Then it can be read`() = runTest {
    val vault = InMemorySessionVault()

    vault.store(BearerSession(accessToken = "issued-bearer"))

    assertEquals(BearerSession(accessToken = "issued-bearer"), vault.read())
  }

  @Test
  fun `Given a stored bearer When the vault is cleared Then it is unavailable`() = runTest {
    val vault = InMemorySessionVault()
    vault.store(BearerSession(accessToken = "issued-bearer"))

    vault.clear()

    assertNull(vault.read())
  }
}
