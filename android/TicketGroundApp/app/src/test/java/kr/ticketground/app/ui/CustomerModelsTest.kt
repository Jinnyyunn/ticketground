package kr.ticketground.app.ui

import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.CatalogSchedule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CustomerModelsTest {

  @Test
  fun `bookablePerformances prefers dates over schedules when both are present`() {
    // Matches live catalog shape (https://dev.ticketground.co.kr/api/catalog): every
    // event ships both `dates` (carries the booking id) and `schedules` (display-only,
    // never carries an id). Regression test for the P0 where `schedules` was always
    // picked first, so the id filter dropped every entry and booking was dead.
    val event = eventFixture(
      dates = listOf(
        CatalogSchedule(id = "perf_da546ded3406", startsAt = "2026-09-12T19:00:00+09:00", label = "9월 12일"),
        CatalogSchedule(id = "perf_958d01b9687e", startsAt = "2026-09-13T18:00:00+09:00", label = "9월 13일"),
      ),
      schedules = listOf(
        CatalogSchedule(label = "9월 12일", date = "2026.09.12", times = listOf("19:00")),
        CatalogSchedule(label = "9월 13일", date = "2026.09.13", times = listOf("18:00")),
      ),
    )

    val performances = bookablePerformances(event)

    assertEquals(listOf("perf_da546ded3406", "perf_958d01b9687e"), performances.map { it.id })
    assertEquals(listOf("9월 12일", "9월 13일"), performances.map { it.label })
  }

  @Test
  fun `bookablePerformances falls back to schedules when dates is absent`() {
    val event = eventFixture(
      dates = null,
      schedules = listOf(CatalogSchedule(id = "sched_1", label = "회차 1")),
    )

    val performances = bookablePerformances(event)

    assertEquals(listOf("sched_1"), performances.map { it.id })
  }

  @Test
  fun `bookablePerformances drops entries without a usable id`() {
    val event = eventFixture(
      dates = listOf(
        CatalogSchedule(id = "perf_ok", label = "정상"),
        CatalogSchedule(id = null, label = "id 없음"),
        CatalogSchedule(id = "  ", label = "공백 id"),
      ),
    )

    val performances = bookablePerformances(event)

    assertEquals(listOf("perf_ok"), performances.map { it.id })
  }

  @Test
  fun `bookablePerformances is empty when neither dates nor schedules carry an id`() {
    val event = eventFixture(
      dates = null,
      schedules = listOf(CatalogSchedule(label = "9월 12일", date = "2026.09.12", times = listOf("19:00"))),
    )

    assertTrue(bookablePerformances(event).isEmpty())
  }

  @Test
  fun `bookablePerformances is empty when both lists are absent`() {
    val event = eventFixture(dates = null, schedules = null)

    assertTrue(bookablePerformances(event).isEmpty())
  }

  private fun eventFixture(
    dates: List<CatalogSchedule>? = null,
    schedules: List<CatalogSchedule>? = null,
  ) = CatalogEvent(
    id = "event_ca5eae7ab951",
    title = "IU 2026 WORLD TOUR",
    venue = "잠실종합운동장 주경기장",
    dates = dates,
    schedules = schedules,
    soldCount = 0,
  )
}
