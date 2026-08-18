package kr.ticketground.app.data

import android.content.Context
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.google.android.gms.tasks.Task
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityManager
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.installations.FirebaseInstallations
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

class GooglePlayIntegrityTokenRequester(context: Context) : PlayIntegrityTokenRequester {
  private val manager = IntegrityManagerFactory.createStandard(context.applicationContext)
  private var preparedProject: Long? = null
  private var provider: StandardIntegrityManager.StandardIntegrityTokenProvider? = null

  override suspend fun request(projectNumber: Long, binding: IntegrityChallengeBinding): String {
    val current = if (preparedProject == projectNumber) provider else null
    val tokenProvider = current ?: manager.prepareIntegrityToken(
      StandardIntegrityManager.PrepareIntegrityTokenRequest.builder()
        .setCloudProjectNumber(projectNumber)
        .build(),
    ).await().also {
      preparedProject = projectNumber
      provider = it
    }
    return tokenProvider.request(
      StandardIntegrityManager.StandardIntegrityTokenRequest.builder()
        .setRequestHash(binding.challenge)
        .build(),
    ).await().token()
  }
}

class GoogleFirebaseTokenSource : FirebaseTokenSource {
  override suspend fun fetch(): String {
    FirebaseMessaging.getInstance().register().await()
    return FirebaseInstallations.getInstance().id.await()
  }
}

private fun biometricAuthenticators(): Int = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
  BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL
} else {
  BiometricManager.Authenticators.BIOMETRIC_STRONG
}

/** Whether this device currently has a usable biometric/device-credential enrollment at all. */
fun biometricAuthenticationAvailable(context: Context): Boolean =
  BiometricManager.from(context).canAuthenticate(biometricAuthenticators()) == BiometricManager.BIOMETRIC_SUCCESS

/**
 * Shared BiometricPrompt plumbing behind both [AndroidDeviceOwnerAuthenticator] (trusted-device
 * registration) and [AndroidLoginGateAuthenticator] (login-reentry unlock) -- same API, same
 * authenticator set, only the displayed title/subtitle differ per call site.
 */
private suspend fun promptBiometricAuthentication(
  activity: FragmentActivity,
  title: String,
  subtitle: String,
): Boolean = suspendCancellableCoroutine { continuation ->
  val authenticators = biometricAuthenticators()
  if (BiometricManager.from(activity).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
    continuation.resume(false)
    return@suspendCancellableCoroutine
  }
  val prompt = BiometricPrompt(
    activity,
    ContextCompat.getMainExecutor(activity),
    object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
        if (continuation.isActive) continuation.resume(true)
      }

      override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
        if (continuation.isActive) continuation.resume(false)
      }
    },
  )
  val info = BiometricPrompt.PromptInfo.Builder()
    .setTitle(title)
    .setSubtitle(subtitle)
    .setAllowedAuthenticators(authenticators)
    .apply {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) setNegativeButtonText("취소")
    }
    .build()
  continuation.invokeOnCancellation { prompt.cancelAuthentication() }
  prompt.authenticate(info)
}

class AndroidDeviceOwnerAuthenticator(
  private val activity: FragmentActivity,
) : DeviceOwnerAuthenticator {
  override suspend fun authenticate(): Boolean =
    promptBiometricAuthentication(activity, "기기 소유자 확인", "신뢰 기기 등록을 계속하려면 인증해 주세요")
}

/**
 * Login-reentry unlock prompt (see [kr.ticketground.app.foundation.LoginReentryGateController]) --
 * same BiometricPrompt pattern and authenticator set as [AndroidDeviceOwnerAuthenticator], reused
 * rather than reinvented, just with copy appropriate to unlocking an already-established session
 * instead of registering a trusted device.
 */
class AndroidLoginGateAuthenticator(
  private val activity: FragmentActivity,
) : DeviceOwnerAuthenticator {
  override suspend fun authenticate(): Boolean =
    promptBiometricAuthentication(activity, "잠금 해제", "로그인 정보를 보려면 인증해 주세요")
}

private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
  addOnSuccessListener { value -> continuation.resume(value) }
  addOnFailureListener { error -> continuation.resumeWithException(error) }
  addOnCanceledListener { continuation.cancel() }
}
