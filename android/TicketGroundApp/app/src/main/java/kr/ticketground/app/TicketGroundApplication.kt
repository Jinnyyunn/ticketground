package kr.ticketground.app

import android.app.ActivityManager
import android.app.Application
import android.os.Build
import kr.ticketground.app.push.ensureDefaultNotificationChannel
import kr.ticketground.app.work.CatalogSyncWorker

class TicketGroundApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    ensureDefaultNotificationChannel(this)
    // Instrumented UI tests (androidTest) share this Application instance -- scheduling real
    // periodic background work here would let it compete with the test's own compose/UI thread
    // work for CPU during the run. isRunningInTestHarness() is the standard signal for exactly
    // this case (also true under Firebase Test Lab, monkey, etc).
    val underTestHarness = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && ActivityManager.isRunningInTestHarness()
    if (!BuildConfig.GATE_APP && !underTestHarness) CatalogSyncWorker.schedule(this)
  }
}
