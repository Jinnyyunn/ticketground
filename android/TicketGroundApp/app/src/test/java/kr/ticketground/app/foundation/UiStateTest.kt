package kr.ticketground.app.foundation

import org.junit.Assert.assertEquals
import org.junit.Test

class UiStateTest {
  @Test
  fun `Given a loading state When rendering destination Then it keeps the destination label`() {
    val state = UiState.Loading(destination = "홈")

    assertEquals("홈", state.destination)
  }

  @Test
  fun `Given an error state When retry is available Then it preserves a safe message`() {
    val state = UiState.Error(message = "네트워크 연결을 확인해 주세요")

    assertEquals("네트워크 연결을 확인해 주세요", state.message)
  }
}
