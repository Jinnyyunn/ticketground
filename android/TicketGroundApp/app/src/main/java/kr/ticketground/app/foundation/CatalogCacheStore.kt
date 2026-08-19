package kr.ticketground.app.foundation

import android.content.Context

private const val PREFS_NAME = "ticketground_catalog_cache"
private const val KEY_CATALOG_JSON = "catalog_json"
private const val KEY_SYNCED_AT = "synced_at_epoch_ms"

/**
 * Minimal on-disk snapshot of the last background-synced public catalog (see
 * [kr.ticketground.app.work.CatalogSyncWorker]). Plain SharedPreferences, not a database --
 * intentionally small since this is a single bounded background-sync addition, not a caching
 * subsystem. Read at cold start by MainActivity's CustomerAppViewModel factory (decoded there,
 * not inside the ViewModel itself, so CustomerAppViewModel.loadHome()'s own init path stays
 * exercisable directly by CustomerAppViewModelTest with no Android Context available) and passed
 * in as a seed for an instant cold-start home paint instead of a blank Loading skeleton.
 */
class CatalogCacheStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun write(catalogJson: String, syncedAtEpochMs: Long) {
    prefs.edit()
      .putString(KEY_CATALOG_JSON, catalogJson)
      .putLong(KEY_SYNCED_AT, syncedAtEpochMs)
      .apply()
  }

  fun readCatalogJson(): String? = prefs.getString(KEY_CATALOG_JSON, null)

  fun syncedAtEpochMs(): Long = prefs.getLong(KEY_SYNCED_AT, 0L)
}
