package kr.ticketground.app

enum class AppDestination(
  val route: String,
  val label: String,
  val shortLabel: String,
) {
  Home(route = "home", label = "홈", shortLabel = "홈"),
  Search(route = "search", label = "검색", shortLabel = "검색"),
  Watchlist(route = "watchlist", label = "찜", shortLabel = "찜"),
  MyPage(route = "mypage", label = "마이페이지", shortLabel = "마이"),
  ;
}
