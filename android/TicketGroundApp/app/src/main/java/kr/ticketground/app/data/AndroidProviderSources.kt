package kr.ticketground.app.data

import android.content.Context
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

private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
  addOnSuccessListener { value -> continuation.resume(value) }
  addOnFailureListener { error -> continuation.resumeWithException(error) }
  addOnCanceledListener { continuation.cancel() }
}
