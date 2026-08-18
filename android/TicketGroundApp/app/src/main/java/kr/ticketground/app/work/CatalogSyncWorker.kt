package kr.ticketground.app.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kr.ticketground.app.data.Catalog
import kr.ticketground.app.data.TicketGroundApiClient
import kr.ticketground.app.foundation.CatalogCacheStore
import kr.ticketground.app.foundation.KeystoreSessionVault

private const val UNIQUE_WORK_NAME = "catalog-sync"
private const val SYNC_INTERVAL_HOURS = 6L

/**
 * Single, narrowly-scoped periodic background sync (Phase 3 item from the Android UI plan):
 * refreshes the public catalog so cached data is fresher the next time the app is opened.
 * Deliberately not a generic sync framework -- one worker, one cache, no chaining.
 */
class CatalogSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val result = runCatching {
      val client = TicketGroundApiClient.create(KeystoreSessionVault(applicationContext))
      val catalog = client.public().catalog()
      CatalogCacheStore(applicationContext).write(
        catalogJson = TicketGroundApiClient.JSON.encodeToString(Catalog.serializer(), catalog),
        syncedAtEpochMs = System.currentTimeMillis(),
      )
    }
    return if (result.isSuccess) Result.success() else Result.retry()
  }

  companion object {
    /** WorkManager enforces a 15-minute floor on periodic work; a ticket catalog does not need
     * to be refreshed anywhere near that aggressively, so this uses a multi-hour interval. */
    fun schedule(context: Context) {
      val request = PeriodicWorkRequestBuilder<CatalogSyncWorker>(SYNC_INTERVAL_HOURS, TimeUnit.HOURS)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        UNIQUE_WORK_NAME,
        ExistingPeriodicWorkPolicy.KEEP,
        request,
      )
    }
  }
}
