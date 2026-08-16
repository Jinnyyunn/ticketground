package kr.ticketground.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ChildCare
import androidx.compose.material.icons.filled.LocalActivity
import androidx.compose.material.icons.filled.Museum
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.TheaterComedy
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImage
import kr.ticketground.app.BuildConfig
import kr.ticketground.app.AppDestination
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.AdmissionQr
import kr.ticketground.app.data.WatchlistItem
import kr.ticketground.app.data.TossCheckoutRequest
import kr.ticketground.app.data.TossWidgetResult
import androidx.appcompat.app.AppCompatActivity
import android.content.Context
import android.content.ContextWrapper
import com.tosspayments.paymentsdk.PaymentWidget
import com.tosspayments.paymentsdk.model.PaymentCallback
import com.tosspayments.paymentsdk.model.TossPaymentResult
import com.tosspayments.paymentsdk.view.PaymentMethod

@Composable
fun TicketGroundNavigation(
  selected: AppDestination,
  width: Dp,
  onNavigate: (AppDestination) -> Unit,
  content: @Composable () -> Unit,
) {
  if (width >= TicketGroundLayout.expandedBreakpoint) {
    Row(Modifier.fillMaxSize()) {
      NavigationRail(Modifier.testTag("navigation-rail")) {
        AppDestination.entries.forEach { destination ->
          NavigationRailItem(
            selected = destination == selected,
            onClick = { onNavigate(destination) },
            icon = {
              Icon(
                destination.navigationIcon(),
                contentDescription = null,
                modifier = Modifier.testTag("navigation-icon-${destination.name.lowercase()}"),
              )
            },
            label = { Text(destination.label) },
          )
        }
      }
      Box(Modifier.weight(1f).fillMaxHeight()) { content() }
    }
  } else {
    Scaffold(
      bottomBar = {
        NavigationBar {
          AppDestination.entries.forEach { destination ->
            NavigationBarItem(
              selected = destination == selected,
              onClick = { onNavigate(destination) },
              icon = {
                Icon(
                  destination.navigationIcon(),
                  contentDescription = null,
                  modifier = Modifier.testTag("navigation-icon-${destination.name.lowercase()}"),
                )
              },
              label = { Text(destination.label) },
            )
          }
        }
      },
    ) { padding -> Box(Modifier.padding(padding)) { content() } }
  }
}

@Composable
fun <T> AsyncSurface(
  state: AsyncContent<T>,
  onRetry: () -> Unit,
  content: @Composable (T) -> Unit,
) {
  when (state) {
    AsyncContent.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
      CircularProgressIndicator(Modifier.semantics { contentDescription = "콘텐츠를 불러오는 중" })
    }
    is AsyncContent.Empty -> StateCard(state.title, state.message, null)
    is AsyncContent.Error -> StateCard("문제가 발생했어요", state.message, onRetry)
    is AsyncContent.Ready -> content(state.value)
  }
}

@Composable
private fun StateCard(title: String, message: String, onRetry: (() -> Unit)?) {
  Box(Modifier.fillMaxSize().padding(TicketGroundSpacing.lg), contentAlignment = Alignment.Center) {
    SurfaceCard {
      Text(title, style = MaterialTheme.typography.titleMedium)
      Text(message, Modifier.testTag("state-card-message"), style = MaterialTheme.typography.bodyMedium)
      if (onRetry != null) Button(onClick = onRetry) { Text("다시 시도") }
    }
  }
}

@Composable
private fun SurfaceCard(content: @Composable ColumnScope.() -> Unit) {
  Card(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(TicketGroundRadius.medium),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    content = { Column(Modifier.padding(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm), content = content) },
  )
}

@Composable
fun HomeScreen(
  state: AsyncContent<HomeContent>,
  onRetry: () -> Unit,
  onEvent: (CatalogEvent) -> Unit,
  onSearch: () -> Unit,
  onCategory: (String) -> Unit,
  onCollection: (String, List<CatalogEvent>) -> Unit,
  onOpenCalendar: () -> Unit,
  onOpenResale: () -> Unit,
  onSupport: () -> Unit,
  onLogin: () -> Unit,
  onMenu: () -> Unit = {},
) {
  AsyncSurface(state, onRetry) { content ->
    val presentation = CustomerHomePresentation.from(content)
    LazyColumn(
      modifier = Modifier.fillMaxSize().testTag("home-list"),
      contentPadding = PaddingValues(TicketGroundSpacing.lg),
      verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.lg),
    ) {
      item {
        HomeHeader(onLogin, onMenu)
        HomeSearchButton(onSearch)
      }
      item { CategoryShortcuts(onHome = {}, onCategory = onCategory) }
      item {
        content.events.firstOrNull()?.let { event ->
          HeroEventCard(event, onEvent)
        }
      }
      item { RankingSection(content.events, onEvent, onSearch) }
      item { HomeOpeningSection(presentation.opening, onOpenCalendar, onEvent) }
      item { HomeResaleSection(presentation.resale, onOpenResale) }
      item {
        HomeGenreSection(
          presentation.genres,
          onCollection = { onCollection(it.destination.title, it.events) },
          onEvent = onEvent,
        )
      }
      item {
        HomeEditorialSection(presentation.editorials) {
          onCollection(it.destination.title, it.events)
        }
      }
      item { ShortcutSection(onOpenCalendar, onSearch, onSupport) }
    }
  }
}

@Composable
fun EventListScreen(
  title: String,
  state: AsyncContent<List<CatalogEvent>>,
  expanded: Boolean,
  onRetry: () -> Unit,
  onEvent: (CatalogEvent) -> Unit,
  beforeList: @Composable () -> Unit = {},
  afterList: @Composable () -> Unit = {},
  ranking: Boolean = false,
  onRankingMore: () -> Unit = {},
) {
  AsyncSurface(state, onRetry) { events ->
    if (events.isEmpty()) {
      StateCard("공연이 없습니다", "다른 검색어나 일정을 확인해 주세요.", null)
    } else if (expanded) {
      Row(Modifier.fillMaxSize().testTag("event-list-two-pane")) {
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(TicketGroundSpacing.lg)) {
          item { beforeList() }
          if (ranking) {
            item { RankingSection(events, onEvent, onRankingMore) }
          } else {
            item { SectionTitle(title) }
            items(events, key = { it.id }) { EventCard(it, onEvent) }
          }
          item { afterList() }
        }
        Box(Modifier.width(TicketGroundLayout.detailPaneWidth).padding(TicketGroundSpacing.lg)) {
          SurfaceCard {
            Text(events.first().title, style = MaterialTheme.typography.titleLarge)
            Text(events.first().venue)
            Text(
              events.first().summary ?: "공연 일정과 좌석 현황을 확인하세요.",
              Modifier.testTag("expanded-event-summary"),
            )
          }
        }
      }
    } else {
      LazyColumn(contentPadding = PaddingValues(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        item { beforeList() }
        if (ranking) {
          item { RankingSection(events, onEvent, onRankingMore) }
        } else {
          item { SectionTitle(title) }
          items(events, key = { it.id }) { EventCard(it, onEvent) }
        }
        item { afterList() }
      }
    }
  }
}

@Composable
fun ExpandedHomeScreen(
  state: AsyncContent<HomeContent>,
  onRetry: () -> Unit,
  onEvent: (CatalogEvent) -> Unit,
  onSearch: () -> Unit,
  onCategory: (String) -> Unit,
  onCollection: (String, List<CatalogEvent>) -> Unit,
  onOpenCalendar: () -> Unit,
  onOpenResale: () -> Unit,
  onSupport: () -> Unit,
  onLogin: () -> Unit,
  onMenu: () -> Unit = {},
) {
  AsyncSurface(state, onRetry) { content ->
    val presentation = CustomerHomePresentation.from(content)
    Row(Modifier.fillMaxSize().testTag("event-list-two-pane")) {
      LazyColumn(
        modifier = Modifier.weight(1f).fillMaxHeight().testTag("home-list"),
        contentPadding = PaddingValues(TicketGroundSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.lg),
      ) {
        item {
          HomeHeader(onLogin, onMenu)
          HomeSearchButton(onSearch)
        }
        item { CategoryShortcuts(onHome = {}, onCategory = onCategory) }
        item { content.events.firstOrNull()?.let { event -> HeroEventCard(event, onEvent) } }
        item { RankingSection(content.events, onEvent, onSearch) }
        item { HomeOpeningSection(presentation.opening, onOpenCalendar, onEvent) }
        item { HomeResaleSection(presentation.resale, onOpenResale) }
        item {
          HomeGenreSection(
            presentation.genres,
            onCollection = { onCollection(it.destination.title, it.events) },
            onEvent = onEvent,
          )
        }
        item {
          HomeEditorialSection(presentation.editorials) {
            onCollection(it.destination.title, it.events)
          }
        }
        item { ShortcutSection(onOpenCalendar, onSearch, onSupport) }
      }
      Box(Modifier.width(TicketGroundLayout.detailPaneWidth).padding(TicketGroundSpacing.lg)) {
        content.events.firstOrNull()?.let { event ->
          SurfaceCard {
            Text(event.title, style = MaterialTheme.typography.titleLarge)
            Text(event.venue)
            Text(
              event.summary ?: "공연 일정과 좌석 현황을 확인하세요.",
              Modifier.testTag("expanded-event-summary"),
            )
          }
        }
      }
    }
  }
}

@Composable
private fun HomeHeader(onLogin: () -> Unit, onMenu: () -> Unit) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      Text("Ticketground", style = MaterialTheme.typography.headlineMedium)
      Text("•", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineMedium)
    }
    Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
      OutlinedButton(onClick = onLogin, modifier = Modifier.testTag("home-login")) { Text("로그인") }
      androidx.compose.material3.IconButton(onClick = onMenu, modifier = Modifier.testTag("home-menu")) {
        Icon(Icons.Default.Menu, contentDescription = "전체 메뉴")
      }
    }
  }
}

@Composable
private fun HomeSearchButton(onSearch: () -> Unit) {
  OutlinedButton(
    onClick = onSearch,
    modifier = Modifier.fillMaxWidth().testTag("home-search"),
    shape = RoundedCornerShape(28.dp),
    contentPadding = PaddingValues(horizontal = TicketGroundSpacing.lg, vertical = TicketGroundSpacing.sm),
  ) {
    Icon(Icons.Default.Search, contentDescription = null)
    Text("공연, 아티스트 또는 공연장 검색", modifier = Modifier.padding(start = TicketGroundSpacing.sm))
  }
}

@Composable
private fun CategoryShortcuts(onHome: () -> Unit, onCategory: (String) -> Unit) {
  val categories = listOf(
    "홈" to Icons.Default.Home,
    "콘서트" to Icons.Default.MusicNote,
    "뮤지컬" to Icons.Default.TheaterComedy,
    "연극" to Icons.Default.LocalActivity,
    "클래식" to Icons.Default.MusicNote,
    "전시" to Icons.Default.Museum,
    "아동" to Icons.Default.ChildCare,
    "스포츠" to Icons.Default.SportsSoccer,
  )
  Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    categories.chunked(5).forEach { row ->
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm),
      ) {
        row.forEach { (label, icon) ->
          Column(
            modifier = Modifier.weight(1f).clickable { if (label == "홈") onHome() else onCategory(label) }
              .testTag("home-category-$label"),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs),
          ) {
            Icon(icon, contentDescription = label)
            Text(label, style = MaterialTheme.typography.labelSmall)
          }
        }
      }
    }
  }
}

@Composable
private fun HeroEventCard(event: CatalogEvent, onEvent: (CatalogEvent) -> Unit) {
  val shape = RoundedCornerShape(TicketGroundRadius.medium)
  Card(
    modifier = Modifier.fillMaxWidth().clickable { onEvent(event) }.testTag("home-hero"),
    shape = shape,
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
  ) {
    val imageUrl = event.image?.let { safeSeatMapImageUrl(it, BuildConfig.API_BASE_URL) }
    Box(Modifier.fillMaxWidth().height(420.dp).clip(shape)) {
      if (imageUrl != null) {
        AsyncImage(
          model = imageUrl,
          imageLoader = seatMapImageLoader(LocalContext.current),
          contentDescription = "${event.title} 추천 이미지",
          contentScale = ContentScale.Crop,
          modifier = Modifier.fillMaxSize().testTag("home-hero-image"),
        )
        Box(
          Modifier.fillMaxSize().background(
            Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.88f))),
          ),
        )
      }
      Column(
        Modifier.align(Alignment.BottomStart).padding(TicketGroundSpacing.xl),
        verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs),
      ) {
        Text("오늘의 추천", style = MaterialTheme.typography.labelLarge, color = if (imageUrl != null) Color.White else MaterialTheme.colorScheme.primary)
        Text(event.title, style = MaterialTheme.typography.headlineSmall, color = if (imageUrl != null) Color.White else MaterialTheme.colorScheme.onSurface)
        Text(event.venue, style = MaterialTheme.typography.titleMedium, color = if (imageUrl != null) Color.White.copy(alpha = 0.92f) else MaterialTheme.colorScheme.onSurface)
        Text(event.period ?: displayEventDate(event), color = if (imageUrl != null) Color.White.copy(alpha = 0.82f) else MaterialTheme.colorScheme.onSurfaceVariant)
        Surface(
          shape = RoundedCornerShape(TicketGroundRadius.small),
          color = if (imageUrl != null) Color.White else MaterialTheme.colorScheme.primary,
          modifier = Modifier.clickable { onEvent(event) },
        ) {
          Text(
            "공연 상세 보기  →",
            modifier = Modifier.padding(horizontal = TicketGroundSpacing.md, vertical = TicketGroundSpacing.sm),
            style = MaterialTheme.typography.labelLarge,
            color = if (imageUrl != null) MaterialTheme.colorScheme.onSurface else Color.White,
          )
        }
      }
    }
  }
}

@Composable
private fun RankingSection(events: List<CatalogEvent>, onEvent: (CatalogEvent) -> Unit, onMore: () -> Unit) {
  Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs)) {
    Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth()) {
      Column(Modifier.weight(1f)) {
        Text("실시간 예매 랭킹 TOP10", style = MaterialTheme.typography.headlineSmall)
        Text("지금 가장 빠르게 움직이는 공연입니다.", color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      Text(
        "더보기",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelLarge,
        modifier = Modifier.clickable(onClick = onMore).testTag("home-ranking-more"),
      )
    }
    LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
      val ranked = events.sortedWith(compareBy<CatalogEvent> { it.pinnedRank ?: Int.MAX_VALUE }.thenByDescending { it.soldCount }).take(10)
      items(ranked, key = { it.id }) { event -> RankingCard(event, ranked.indexOf(event) + 1, onEvent) }
    }
  }
}

@Composable
private fun RankingCard(event: CatalogEvent, rank: Int, onEvent: (CatalogEvent) -> Unit) {
  Column(Modifier.width(156.dp).clickable { onEvent(event) }.testTag("home-ranking-$rank"), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs)) {
    Box(Modifier.fillMaxWidth().height(202.dp).clip(RoundedCornerShape(TicketGroundRadius.medium))) {
      val imageUrl = event.image?.let { safeSeatMapImageUrl(it, BuildConfig.API_BASE_URL) }
      if (imageUrl != null) {
        AsyncImage(model = imageUrl, imageLoader = seatMapImageLoader(LocalContext.current), contentDescription = "${event.title} 포스터", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
      } else {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant))
      }
      Text("$rank", style = MaterialTheme.typography.headlineSmall, color = Color.White, modifier = Modifier.padding(TicketGroundSpacing.sm).background(MaterialTheme.colorScheme.primary, RoundedCornerShape(TicketGroundRadius.small)).padding(horizontal = TicketGroundSpacing.sm, vertical = TicketGroundSpacing.xs))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
      Text(displayCategory(event.category), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
      Text("— —", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
    }
    Text(event.title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
    Text(event.venue, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
    Text(displayEventDate(event), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
  }
}

@Composable
private fun ShortcutSection(onCalendar: () -> Unit, onSearch: () -> Unit, onSupport: () -> Unit) {
  Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
    Text("바로가기", style = MaterialTheme.typography.headlineSmall)
    Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
      ShortcutCard("오픈캘린더", "오픈 일정", onCalendar, Modifier.weight(1f))
      ShortcutCard("공연 검색", "공연을 찾아보세요", onSearch, Modifier.weight(1f))
    }
    ShortcutCard("공지·자주 묻는 질문", "고객센터", onSupport, Modifier.fillMaxWidth())
  }
}

@Composable
private fun ShortcutCard(title: String, helper: String, onClick: () -> Unit, modifier: Modifier) {
  Surface(modifier = modifier.clickable { onClick() }, color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(TicketGroundRadius.medium)) {
    Column(Modifier.padding(TicketGroundSpacing.md), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs)) {
      Text(title, style = MaterialTheme.typography.titleMedium)
      Text(helper, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
  }
}

private fun displayCategory(category: String?): String = when (category?.lowercase()) {
  "concert" -> "콘서트"
  "musical" -> "뮤지컬"
  "play", "theater" -> "연극"
  "classic" -> "클래식"
  "exhibition" -> "전시"
  "child", "children", "family" -> "아동"
  "sports" -> "스포츠"
  else -> category ?: "공연"
}

private fun displayEventDate(event: CatalogEvent): String {
  val raw = event.date ?: return "일정 미정"
  val date = raw.substringBefore('T').replace('-', '.')
  val time = raw.substringAfter('T', "").take(5)
  return if (time.isBlank()) date else "$date $time"
}

@Composable
private fun EventCard(event: CatalogEvent, onEvent: (CatalogEvent) -> Unit) {
  Card(
    modifier = Modifier.fillMaxWidth().padding(vertical = TicketGroundSpacing.xs).clickable { onEvent(event) },
    shape = RoundedCornerShape(TicketGroundRadius.medium),
  ) {
    Column(Modifier.padding(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs)) {
      Text(event.title, style = MaterialTheme.typography.titleMedium)
      Text(event.venue, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(event.sale?.label ?: event.saleState ?: "판매 일정 확인", color = MaterialTheme.colorScheme.primary)
    }
  }
}

@Composable
fun EventDetailScreen(
  event: CatalogEvent,
  onSeatMap: (String?) -> Unit,
  onWatchlist: () -> Unit = {},
  actionMessage: String? = null,
) {
  val performances = (event.schedules ?: event.dates).orEmpty().filter { !it.id.isNullOrBlank() }
  var selectedPerformanceId by remember(event.id, performances) {
    mutableStateOf(performances.singleOrNull()?.id)
  }
  LazyColumn(contentPadding = PaddingValues(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    item {
      Text(event.title, style = MaterialTheme.typography.headlineSmall)
      Text(event.venue, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(event.period ?: event.date ?: "공연 일정을 확인해 주세요.")
    }
    item {
      SurfaceCard {
        Text("공연 안내", style = MaterialTheme.typography.titleMedium)
        Text(event.summary ?: "공연 상세 정보는 서버에서 제공되는 내용만 표시합니다.")
        event.notices.orEmpty().forEach { Text("· $it") }
      }
    }
    if (performances.isNotEmpty()) {
      item { Text("공연 회차 선택", style = MaterialTheme.typography.titleMedium) }
      items(performances, key = { requireNotNull(it.id) }) { performance ->
        val id = requireNotNull(performance.id)
        Row(
          modifier = Modifier.fillMaxWidth().clickable { selectedPerformanceId = id },
          verticalAlignment = Alignment.CenterVertically,
        ) {
          RadioButton(selected = selectedPerformanceId == id, onClick = { selectedPerformanceId = id })
          Text(performance.label ?: performance.startsAt ?: performance.date ?: "공연 회차")
        }
      }
    }
    item {
      OutlinedButton(onClick = onWatchlist, modifier = Modifier.fillMaxWidth()) { Text("관심공연에 추가") }
      actionMessage?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
      Button(
        onClick = { onSeatMap(selectedPerformanceId) },
        enabled = selectedPerformanceId != null,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("좌석도에서 예매하기")
      }
    }
  }
}

@Composable
fun SearchScreen(events: List<CatalogEvent>, onEvent: (CatalogEvent) -> Unit, initialQuery: String = "") {
  var query by remember(initialQuery) { mutableStateOf(initialQuery) }
  val filtered = events.filter { event ->
    query.isBlank() || listOf(event.title, event.venue, event.category.orEmpty()).any { it.contains(query, ignoreCase = true) }
  }
  Column(Modifier.fillMaxSize().padding(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    Text("공연 검색", style = MaterialTheme.typography.headlineSmall)
    OutlinedTextField(
      value = query,
      onValueChange = { query = it },
      label = { Text("공연명, 아티스트, 공연장") },
      modifier = Modifier.fillMaxWidth(),
      singleLine = true,
    )
    if (filtered.isEmpty()) Text("검색 결과가 없습니다. 다른 검색어를 입력해 주세요.")
    LazyColumn(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) { items(filtered, key = { it.id }) { EventCard(it, onEvent) } }
  }
}

@Composable
fun WatchlistScreen(state: AsyncContent<List<WatchlistItem>>, onRetry: () -> Unit) {
  AsyncSurface(state, onRetry) { entries ->
    if (entries.isEmpty()) StateCard("관심공연이 없습니다", "공연 상세에서 찜하기를 눌러보세요.", null)
    else LazyColumn(contentPadding = PaddingValues(TicketGroundSpacing.xl), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
      item { SectionTitle("관심공연·알림") }
      items(entries, key = { it.id }) { entry ->
        SurfaceCard {
          Text(entry.event?.title ?: "공연 정보 확인 중", style = MaterialTheme.typography.titleMedium)
          Text(if (entry.notificationEnabled) "예매 알림 사용 중" else "알림 꺼짐")
        }
      }
    }
  }
}

@Composable
fun SupportScreen(content: HomeContent?) {
  val uriHandler = LocalUriHandler.current
  LazyColumn(contentPadding = PaddingValues(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    item { SectionTitle("고객센터") }
    item {
      SurfaceCard {
        Text("티켓그라운드 1:1 문의", style = MaterialTheme.typography.titleMedium)
        Text("예매·입장·환불 문의는 카카오톡 채널에서 빠르게 접수해 주세요.")
        Button(
          onClick = { uriHandler.openUri("https://pf.kakao.com/_xmTniX/chat") },
          modifier = Modifier.testTag("kakao-channel-chat"),
        ) { Text("카카오톡 채널 1:1 문의") }
        OutlinedButton(
          onClick = { uriHandler.openUri("https://pf.kakao.com/_xmTniX") },
          modifier = Modifier.testTag("kakao-channel-add"),
        ) { Text("카카오톡 채널 추가") }
      }
    }
    if (content == null || content.faq.isEmpty()) item { Text("도움말을 불러오지 못했습니다. 다시 시도해 주세요.") }
    items(content?.notices.orEmpty(), key = { it.id }) { SurfaceCard { Text(it.title, style = MaterialTheme.typography.titleMedium); Text(it.body) } }
    items(content?.faq.orEmpty(), key = { it.id }) { SurfaceCard { Text(it.question, style = MaterialTheme.typography.titleMedium); Text(it.answer) } }
  }
}

@Composable
fun LifecycleOverviewScreen(
  state: AsyncContent<AccountOverview>,
  onRetry: () -> Unit,
  pending: Boolean = false,
  actionMessage: String? = null,
  onCancellation: (String) -> Unit = {},
  onResale: (Int) -> Unit = {},
  onDevice: () -> Unit = {},
  onPush: () -> Unit = {},
  onQr: () -> Unit = {},
  onTicketSelected: (String) -> Unit = {},
  admissionQr: AdmissionQr? = null,
  onLogin: () -> Unit = {},
) {
  AsyncSurface(state, onRetry) { account ->
    if (!account.signedIn) {
      Box(Modifier.fillMaxSize().padding(TicketGroundSpacing.lg), contentAlignment = Alignment.Center) {
        SurfaceCard {
          Text("로그인이 필요합니다", style = MaterialTheme.typography.titleMedium)
          Text("보유 티켓과 계정 기능은 로그인 후 이용할 수 있습니다.")
          Button(onClick = onLogin, modifier = Modifier.fillMaxWidth().testTag("mypage-login")) {
            Text("로그인")
          }
        }
      }
    } else {
      var cancellationReason by remember { mutableStateOf("") }
      var refundAcknowledged by remember { mutableStateOf(false) }
      var resalePrice by remember { mutableStateOf("") }
      val parsedPrice = resalePrice.toIntOrNull()
      LazyColumn(
        modifier = Modifier.testTag("lifecycle-overview-list"),
        contentPadding = PaddingValues(TicketGroundSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
      ) {
        item { SectionTitle("마이페이지") }
        actionMessage?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.primary) } }
        if (account.tickets.isNotEmpty()) {
          item { Text("보유 티켓 선택", style = MaterialTheme.typography.titleMedium) }
          items(account.tickets, key = { it.id }) { ticket ->
            OutlinedButton(
              onClick = { onTicketSelected(ticket.id) },
              modifier = Modifier.fillMaxWidth().testTag("owned-ticket-${ticket.id}"),
              enabled = !pending,
            ) {
              RadioButton(
                selected = ticket.id == account.selectedTicketId,
                onClick = null,
              )
              Text("${ticket.title} · ${ticket.seatLabel}")
            }
          }
        }
        item {
          SurfaceCard {
            Text(account.ticketTitle ?: "보유 티켓이 없습니다", style = MaterialTheme.typography.titleMedium)
            account.seatLabel?.let { Text(it) }
            Text(account.qrState, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
        item {
          SurfaceCard {
            Text("티켓 관리", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
              value = cancellationReason,
              onValueChange = { cancellationReason = it },
              label = { Text("취소 사유") },
              modifier = Modifier.fillMaxWidth(),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
              Checkbox(checked = refundAcknowledged, onCheckedChange = { refundAcknowledged = it })
              Text("환불 정책과 예상 금액을 확인했습니다")
            }
            Button(
              onClick = { onCancellation(cancellationReason.trim()) },
              enabled = account.ticketEligible && cancellationReason.isNotBlank() && refundAcknowledged && !pending,
              modifier = Modifier.fillMaxWidth(),
            ) { Text("취소 요청") }
            OutlinedTextField(
              value = resalePrice,
              onValueChange = { resalePrice = it.filter(Char::isDigit) },
              label = { Text("공식 재판매 가격") },
              supportingText = { Text("허용 범위 ${account.minimumResalePrice.krw()}원~${account.maximumResalePrice.krw()}원") },
              keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
              modifier = Modifier.fillMaxWidth(),
            )
            Button(
              onClick = { parsedPrice?.let(onResale) },
              enabled = account.ticketEligible && parsedPrice in account.minimumResalePrice..account.maximumResalePrice && !pending,
              modifier = Modifier.fillMaxWidth(),
            ) { Text("공식 재판매 등록") }
          }
        }
        item {
          SurfaceCard {
            Text("신뢰 기기·알림", style = MaterialTheme.typography.titleMedium)
            Text(if (account.trustedDevice) "신뢰 기기 등록됨" else "신뢰 기기가 필요합니다")
            Text(account.pushSuffix?.let { "푸시 등록됨 · 끝자리 $it" } ?: "푸시 알림 미등록")
            OutlinedButton(onClick = onDevice, enabled = !pending, modifier = Modifier.fillMaxWidth()) { Text("이 기기 등록") }
            OutlinedButton(onClick = onPush, enabled = !pending, modifier = Modifier.fillMaxWidth()) { Text("알림 등록 요청") }
          }
        }
        item {
          SurfaceCard {
            Text("입장 QR", style = MaterialTheme.typography.titleMedium)
            if (admissionQr != null && admissionQr.ticketId == account.ticketId) {
              AdmissionQrCode(admissionQr)
              Text("유효 기한 ${admissionQr.expiresAt}", color = MaterialTheme.colorScheme.onSurfaceVariant)
              Text("확인 코드 ${admissionQr.traceCode}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
              Text("QR 원본 자격 정보는 코드 외부에 표시하거나 저장하지 않습니다.")
            }
            Button(
              onClick = onQr,
              enabled = account.ticketEligible && account.trustedDevice && !pending,
              modifier = Modifier.fillMaxWidth(),
            ) { Text("입장 QR 발급") }
          }
        }
      }
    }
  }
}

@Composable
fun CheckoutHandoffScreen(
  request: TossCheckoutRequest,
  pending: Boolean,
  seatLabel: String,
  amount: Int,
  onResult: (TossWidgetResult) -> Unit,
) {
  val activity = LocalContext.current.findAppCompatActivity()
  val widget = remember(request.ticketId, request.clientKey) {
    activity?.let { PaymentWidget(it, request.clientKey, "@@ANONYMOUS") }
  }
  Column(Modifier.fillMaxSize().padding(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    SectionTitle("결제 확인")
    SurfaceCard {
      Text(seatLabel, style = MaterialTheme.typography.titleMedium)
      Text("결제 예정 금액 ${amount.krw()}원")
      Text(
        "결제 승인 확인 후 결과를 반영합니다.",
        Modifier.testTag("toss-confirmation-policy"),
      )
      if (widget != null) {
        AndroidView(
          factory = { context ->
            PaymentMethod(context).also { widget.renderPaymentMethods(it, request.amount) }
          },
          modifier = Modifier.fillMaxWidth().height(360.dp).testTag("toss-payment-widget"),
        )
      } else {
        Text("현재 화면에서는 결제창을 열 수 없습니다.", color = MaterialTheme.colorScheme.error)
      }
      Button(
        onClick = {
          widget?.requestPayment(
            PaymentMethod.PaymentInfo(request.ticketId, request.orderName),
            object : PaymentCallback {
              override fun onPaymentSuccess(success: TossPaymentResult.Success) {
                if (success.orderId == request.ticketId && success.amount.toInt() == request.amount) {
                  onResult(TossWidgetResult.Success(success.paymentKey))
                } else {
                  onResult(TossWidgetResult.Failed("INVALID_PAYMENT_RESULT"))
                }
              }

              override fun onPaymentFailed(fail: TossPaymentResult.Fail) {
                if (fail.errorCode == "PAY_PROCESS_CANCELED") onResult(TossWidgetResult.Cancelled)
                else onResult(TossWidgetResult.Failed(fail.errorCode))
              }
            },
          )
        },
        enabled = widget != null && !pending,
        modifier = Modifier.fillMaxWidth(),
      ) { Text(if (pending) "결제 준비 중" else "결제창 열기") }
    }
  }
}

private tailrec fun Context.findAppCompatActivity(): AppCompatActivity? = when (this) {
  is AppCompatActivity -> this
  is ContextWrapper -> baseContext.findAppCompatActivity()
  else -> null
}

@Composable
private fun SectionTitle(title: String) {
  Text(title, style = MaterialTheme.typography.titleLarge)
}

internal fun Int.krw(): String = String.format("%,d", this)

private fun AppDestination.navigationIcon(): ImageVector = when (this) {
  AppDestination.Home -> Icons.Default.Home
  AppDestination.Search -> Icons.Default.Search
  AppDestination.Watchlist -> Icons.Default.Favorite
  AppDestination.MyPage -> Icons.Default.Person
}
