package kr.ticketground.app.foundation

import android.content.Context
import androidx.core.content.edit

/**
 * Local, device-only toggle for the login-reentry biometric gate (see [LoginReentryGateController]).
 * Deliberately NOT stored through [KeystoreSessionVault]'s Keystore-backed path -- this preference
 * holds no credential, just a UI on/off flag, so plain app-private SharedPreferences is
 * proportionate and keeps this feature from touching the session encryption boundary at all.
 */
interface BiometricLoginGatePreference {
  suspend fun isEnabled(): Boolean
  suspend fun setEnabled(enabled: Boolean)
}

class InMemoryBiometricLoginGatePreference(initial: Boolean = false) : BiometricLoginGatePreference {
  private var enabled = initial
  override suspend fun isEnabled(): Boolean = enabled
  override suspend fun setEnabled(enabled: Boolean) {
    this.enabled = enabled
  }
}

class SharedPreferencesBiometricLoginGatePreference(context: Context) : BiometricLoginGatePreference {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  override suspend fun isEnabled(): Boolean = preferences.getBoolean(KEY_ENABLED, false)

  override suspend fun setEnabled(enabled: Boolean) {
    preferences.edit { putBoolean(KEY_ENABLED, enabled) }
  }

  private companion object {
    const val PREFERENCES_NAME = "ticketground_security_settings"
    const val KEY_ENABLED = "biometric_login_gate_enabled"
  }
}

/**
 * Pure decision logic for the login-reentry biometric gate: whether returning to the app should
 * require re-authentication before revealing an already-established session. This gates
 * *unlocking access to an existing session* only -- it never runs during the OAuth grant itself
 * (there is nothing in [SessionVault] yet at that point, so [shouldLock] is always false while a
 * login is in progress).
 *
 * Framework-free (no Context/BiometricPrompt) so it can be exercised directly in JVM unit tests,
 * following the same interface+fake pattern as [SessionVault]/[InMemorySessionVault] elsewhere in
 * this module. The BiometricPrompt call itself lives in the Activity layer (see
 * AndroidProviderSources.kt's AndroidLoginGateAuthenticator), which is what actually clears the
 * lock on success.
 */
class LoginReentryGateController(
  private val sessionVault: SessionVault,
  private val preference: BiometricLoginGatePreference,
) {
  /**
   * Call at cold start (Activity#onCreate) and whenever the app returns to the foreground after
   * being backgrounded (Activity#onStop -> onResume). Locks only when the user opted in AND a
   * session already exists to protect -- a fresh install or a signed-out user never sees the gate.
   */
  suspend fun shouldLock(): Boolean = preference.isEnabled() && sessionVault.read() != null
}
