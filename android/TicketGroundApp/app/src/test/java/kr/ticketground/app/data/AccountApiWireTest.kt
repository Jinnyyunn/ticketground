package kr.ticketground.app.data

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class AccountApiWireTest : ApiTestSupport() {
  @Test
  fun `profile mutation uses principal route without a user id`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(sessionJson(name = "새 이름")))
    val api = createHttpsApi()

    val profile = api.account().updateProfile("새 이름", "stable-profile-key")

    assertEquals("새 이름", profile.name)
    server.takeRequest()
    val request = server.takeRequest()
    assertEquals("PATCH", request.method)
    assertEquals("/api/me/profile", request.path)
    assertEquals("stable-profile-key", request.getHeader("X-Idempotency-Key"))
    assertEquals("{\"name\":\"새 이름\"}", request.body.readUtf8())
  }

  @Test
  fun `support mutations use principal paths and deployed bodies`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(supportThreadJson()))
    server.enqueue(success(supportThreadJson()))
    val api = createHttpsApi()

    api.account().createSupportThread("문의", "도와주세요", "support-create-key")
    api.account().addSupportMessage("thread-1", "추가 내용", "support-message-key")

    server.takeRequest()
    val create = server.takeRequest()
    val reply = server.takeRequest()
    assertEquals("/api/me/support/threads", create.path)
    assertEquals("{\"subject\":\"문의\",\"message\":\"도와주세요\"}", create.body.readUtf8())
    assertEquals("support-create-key", create.getHeader("X-Idempotency-Key"))
    assertEquals("/api/me/support/messages", reply.path)
    assertEquals("{\"threadId\":\"thread-1\",\"message\":\"추가 내용\"}", reply.body.readUtf8())
    assertEquals("support-message-key", reply.getHeader("X-Idempotency-Key"))
  }

  @Test
  fun `watchlist mutations encode event in path and preferences in body`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(watchlistJson()))
    server.enqueue(success("""{"deleted":true,"eventId":"event/한"}"""))
    val api = createHttpsApi()

    api.account().upsertWatchlist("event/한", listOf("APP_PUSH"), true, false, "watch-upsert-key")
    api.account().deleteWatchlist("event/한", "watch-delete-key")

    server.takeRequest()
    val upsert = server.takeRequest()
    val delete = server.takeRequest()
    assertEquals("/api/me/watchlist/event%2F%ED%95%9C", upsert.path)
    assertEquals(
      "{\"channels\":[\"APP_PUSH\"],\"calendarEnabled\":true,\"notificationEnabled\":false}",
      upsert.body.readUtf8(),
    )
    assertEquals("watch-upsert-key", upsert.getHeader("X-Idempotency-Key"))
    assertEquals("DELETE", delete.method)
    assertEquals("/api/me/watchlist/event%2F%ED%95%9C", delete.path)
    assertEquals("watch-delete-key", delete.getHeader("X-Idempotency-Key"))
  }

  @Test
  fun `queue mutations use principal resource paths and stable keys`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(queueJson()))
    server.enqueue(success(queueJson()))
    server.enqueue(success("""{"id":"queue-1","status":"LEFT"}"""))
    val api = createHttpsApi()

    api.account().enterQueue("performance-1", "queue-enter-key")
    api.account().queueEntry("queue-1")
    api.account().leaveQueue("queue-1", "queue-leave-key")

    server.takeRequest()
    val enter = server.takeRequest()
    val refresh = server.takeRequest()
    val leave = server.takeRequest()
    assertEquals("/api/me/queue-entries", enter.path)
    assertEquals("{\"performanceDateId\":\"performance-1\"}", enter.body.readUtf8())
    assertEquals("queue-enter-key", enter.getHeader("X-Idempotency-Key"))
    assertEquals("GET", refresh.method)
    assertEquals("/api/me/queue-entries/queue-1", refresh.path)
    assertEquals("DELETE", leave.method)
    assertEquals("/api/me/queue-entries/queue-1", leave.path)
    assertEquals("queue-leave-key", leave.getHeader("X-Idempotency-Key"))
  }

  @Test
  fun `reservation draft mutations use hold body and draft resource path`() = runTest {
    server.enqueue(success(healthWithCapabilities()))
    server.enqueue(success(draftJson()))
    server.enqueue(success(draftJson(status = "CANCELLED")))
    val api = createHttpsApi()

    api.account().createReservationDraft("hold-1", "draft-create-key")
    api.account().cancelReservationDraft("draft-1", "draft-cancel-key")

    server.takeRequest()
    val create = server.takeRequest()
    val cancel = server.takeRequest()
    assertEquals("/api/me/reservation-drafts", create.path)
    assertEquals("{\"holdId\":\"hold-1\"}", create.body.readUtf8())
    assertEquals("draft-create-key", create.getHeader("X-Idempotency-Key"))
    assertEquals("DELETE", cancel.method)
    assertEquals("/api/me/reservation-drafts/draft-1", cancel.path)
    assertEquals("draft-cancel-key", cancel.getHeader("X-Idempotency-Key"))
  }
}
