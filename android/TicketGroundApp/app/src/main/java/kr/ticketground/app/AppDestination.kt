package kr.ticketground.app

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

enum class AppDestination(
  val route: String,
  val label: String,
  val shortLabel: String,
) {
  Home(route = "home", label = "홈", shortLabel = "홈"),
  Search(route = "search", label = "검색", shortLabel = "검색"),
  MyPage(route = "mypage", label = "마이", shortLabel = "마이"),
  ;

  @Composable
  fun Content() {
    Text(text = "$label 기능은 다음 작업에서 연결됩니다.")
  }
}
