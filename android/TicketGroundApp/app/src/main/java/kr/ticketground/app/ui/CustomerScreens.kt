package kr.ticketground.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.graphics.vector.ImageVector
import kr.ticketground.app.AppDestination
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.WatchlistItem

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
            icon = { Icon(destination.navigationIcon(), contentDescription = null) },
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
              icon = { Icon(destination.navigationIcon(), contentDescription = null) },
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
      Text(message, style = MaterialTheme.typography.bodyMedium)
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
  expanded: Boolean,
  onRetry: () -> Unit,
  onEvent: (CatalogEvent) -> Unit,
  onSearch: () -> Unit,
  onSupport: () -> Unit,
) {
  AsyncSurface(state, onRetry) { content ->
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      contentPadding = PaddingValues(TicketGroundSpacing.lg),
      verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.lg),
    ) {
      item {
        Text("Ticketground", style = MaterialTheme.typography.headlineMedium)
        Text("공연을 찾고 좌석도에서 바로 예매하세요", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = onSearch, modifier = Modifier.fillMaxWidth()) { Text("공연, 아티스트 또는 공연장 검색") }
      }
      item { SectionTitle("티켓 랭킹") }
      items(content.events.take(if (expanded) 8 else 5), key = { it.id }) { EventCard(it, onEvent) }
      item { SectionTitle("오픈 캘린더") }
      if (content.calendar.isEmpty()) item { Text("예매 오픈 일정이 없습니다.") }
      items(content.calendar, key = { it.opensAt + it.event.id }) { entry ->
        SurfaceCard {
          Text(entry.event.title, style = MaterialTheme.typography.titleMedium)
          Text(entry.opensAt, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      item {
        OutlinedButton(onClick = onSupport, modifier = Modifier.fillMaxWidth()) { Text("공지·자주 묻는 질문") }
      }
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
) {
  AsyncSurface(state, onRetry) { events ->
    if (events.isEmpty()) {
      StateCard("공연이 없습니다", "다른 검색어나 일정을 확인해 주세요.", null)
    } else if (expanded) {
      Row(Modifier.fillMaxSize().testTag("event-list-two-pane")) {
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(TicketGroundSpacing.lg)) {
          item { beforeList() }
          item { SectionTitle(title) }
          items(events, key = { it.id }) { EventCard(it, onEvent) }
          item { afterList() }
        }
        Box(Modifier.width(TicketGroundLayout.detailPaneWidth).padding(TicketGroundSpacing.lg)) {
          SurfaceCard {
            Text(events.first().title, style = MaterialTheme.typography.titleLarge)
            Text(events.first().venue)
            KeepLastWordTogether(
              events.first().summary ?: "공연 상세에서 일정과 좌석 현황을 확인하세요.",
            )
          }
        }
      }
    } else {
      LazyColumn(contentPadding = PaddingValues(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        item { beforeList() }
        item { SectionTitle(title) }
        items(events, key = { it.id }) { EventCard(it, onEvent) }
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
  onSupport: () -> Unit,
) {
  AsyncSurface(state, onRetry) { content ->
    EventListScreen(
      title = "티켓 랭킹",
      state = AsyncContent.Ready(content.events),
      expanded = true,
      onRetry = onRetry,
      onEvent = onEvent,
      beforeList = {
        Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
          Text("Ticketground", style = MaterialTheme.typography.headlineMedium)
          Text("공연을 찾고 좌석도에서 바로 예매하세요", color = MaterialTheme.colorScheme.onSurfaceVariant)
          OutlinedButton(onClick = onSearch, modifier = Modifier.fillMaxWidth()) {
            Text("공연, 아티스트 또는 공연장 검색")
          }
        }
      },
      afterList = {
        Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
          SectionTitle("오픈 캘린더")
          if (content.calendar.isEmpty()) {
            Text("예매 오픈 일정이 없습니다.")
          } else {
            content.calendar.forEach { entry ->
              SurfaceCard {
                Text(entry.event.title, style = MaterialTheme.typography.titleMedium)
                Text(entry.opensAt, color = MaterialTheme.colorScheme.onSurfaceVariant)
              }
            }
          }
          OutlinedButton(onClick = onSupport, modifier = Modifier.fillMaxWidth()) {
            Text("공지·자주 묻는 질문")
          }
        }
      },
    )
  }
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
fun EventDetailScreen(event: CatalogEvent, onSeatMap: (String?) -> Unit) {
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
    item {
      Button(onClick = { onSeatMap(event.schedules?.firstOrNull()?.id ?: event.dates?.firstOrNull()?.id) }, modifier = Modifier.fillMaxWidth()) {
        Text("좌석도에서 예매하기")
      }
    }
  }
}

@Composable
fun SearchScreen(events: List<CatalogEvent>, onEvent: (CatalogEvent) -> Unit) {
  var query by remember { mutableStateOf("") }
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
  LazyColumn(contentPadding = PaddingValues(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    item { SectionTitle("고객센터") }
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
) {
  AsyncSurface(state, onRetry) { account ->
    if (!account.signedIn) {
      StateCard("로그인이 필요합니다", "보유 티켓과 계정 기능은 로그인 후 이용할 수 있습니다.", null)
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
            Text("원본 자격 정보는 화면에 표시하거나 저장하지 않습니다.")
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
  configured: Boolean,
  pending: Boolean,
  seatLabel: String,
  amount: Int,
  onOpenProvider: () -> Unit,
) {
  Column(Modifier.fillMaxSize().padding(TicketGroundSpacing.lg), verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    SectionTitle("결제 확인")
    SurfaceCard {
      Text(seatLabel, style = MaterialTheme.typography.titleMedium)
      Text("결제 예정 금액 ${amount.krw()}원")
      if (!configured) Text("Toss Payments 연결이 필요합니다", color = MaterialTheme.colorScheme.error)
      Text(
        "결제 승인 확인 후 결과를 반영합니다.",
        Modifier.testTag("toss-confirmation-policy"),
      )
      Button(
        onClick = onOpenProvider,
        enabled = configured && !pending,
        modifier = Modifier.fillMaxWidth(),
      ) { Text(if (pending) "결제 준비 중" else "결제창 열기") }
    }
  }
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

@Composable
private fun KeepLastWordTogether(value: String) {
  val breakAt = value.lastIndexOf(' ')
  if (breakAt <= 0) {
    Text(value, Modifier.testTag("expanded-event-summary"))
    return
  }
  Column(
    Modifier.clearAndSetSemantics { text = AnnotatedString(value) },
  ) {
    Text(value.substring(0, breakAt), Modifier.clearAndSetSemantics {})
    Text(
      value.substring(breakAt + 1),
      Modifier.clearAndSetSemantics {}.testTag("expanded-event-summary"),
    )
  }
}
