package kr.ticketground.app.foundation

sealed interface UiState {
  data class Loading(val destination: String) : UiState
  data class Empty(val title: String, val description: String) : UiState
  data class Error(val message: String) : UiState
}
