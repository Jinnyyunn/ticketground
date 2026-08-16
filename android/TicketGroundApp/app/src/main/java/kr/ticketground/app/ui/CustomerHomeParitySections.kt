package kr.ticketground.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kr.ticketground.app.BuildConfig
import kr.ticketground.app.data.CatalogEvent
import kr.ticketground.app.data.OpenCalendarEntry

@Composable
fun HomeOpeningSection(
  presentation: OpeningPresentation,
  onOpenCalendar: () -> Unit,
  onEvent: (CatalogEvent) -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
    ParitySectionHeader("티켓오픈 예정") {
      TextButton(
        onClick = onOpenCalendar,
        modifier = Modifier.heightIn(min = TicketGroundLayout.minimumTouchTarget)
          .testTag("home-open-more"),
      ) { Text("전체 일정") }
    }
    if (presentation.entries.isEmpty()) {
      Text("예매 오픈 일정이 없습니다.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    } else {
      LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        items(presentation.entries, key = { it.opensAt + it.event.id }) { entry ->
          OpeningCard(entry, onEvent)
        }
      }
    }
  }
}

@Composable
fun HomeResaleSection(
  presentation: ResalePresentation,
  onOpenResale: () -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
    Text("CLEAN 티켓 공식 양도", style = MaterialTheme.typography.headlineSmall)
    Card(
      modifier = Modifier.fillMaxWidth()
        .heightIn(min = TicketGroundLayout.minimumTouchTarget)
        .clickable(onClick = onOpenResale)
        .testTag("home-resale-pool"),
      shape = RoundedCornerShape(TicketGroundRadius.medium),
      colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    ) {
      Column(
        Modifier.padding(TicketGroundSpacing.lg),
        verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm),
      ) {
        Text("안심하고 확인하는 공식 양도", style = MaterialTheme.typography.titleMedium)
        presentation.safetyItems.forEach { item ->
          Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
            Text("${item.order}", color = MaterialTheme.colorScheme.primary)
            Column {
              Text(item.title, style = MaterialTheme.typography.titleMedium)
              Text(
                item.detail,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
              )
            }
          }
        }
        Text("양도 가능 티켓 보기", color = MaterialTheme.colorScheme.primary)
      }
    }
  }
}

@Composable
fun HomeGenreSection(
  groups: List<GenreRecommendation>,
  onCollection: (GenreRecommendation) -> Unit,
  onEvent: (CatalogEvent) -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md)) {
    Text("장르별 추천", style = MaterialTheme.typography.headlineSmall)
    if (groups.isEmpty()) {
      Text("추천 공연을 준비하고 있습니다.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    groups.forEach { group ->
      Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        Surface(
          modifier = Modifier.heightIn(min = TicketGroundLayout.minimumTouchTarget)
            .clickable { onCollection(group) }
            .testTag("home-genre-${group.label}"),
          color = MaterialTheme.colorScheme.background,
        ) {
          Row(
            Modifier.fillMaxWidth().padding(vertical = TicketGroundSpacing.sm),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text(group.label, style = MaterialTheme.typography.titleMedium)
            Text("더보기", color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
          items(group.events, key = { it.id }) { event ->
            ParityEventCard(event, onEvent)
          }
        }
      }
    }
  }
}

@Composable
fun HomeEditorialSection(
  cards: List<EditorialCard>,
  onCollection: (EditorialCard) -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
    Text("기획전", style = MaterialTheme.typography.headlineSmall)
    if (cards.isEmpty()) {
      Text("새 기획전을 준비하고 있습니다.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    } else {
      LazyRow(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        items(cards, key = { it.slug }) { card ->
          Card(
            modifier = Modifier.width(260.dp)
              .heightIn(min = TicketGroundLayout.minimumTouchTarget)
              .clickable { onCollection(card) }
              .testTag("home-editorial-${card.order}"),
            shape = RoundedCornerShape(TicketGroundRadius.medium),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
          ) {
            Column(
              Modifier.padding(TicketGroundSpacing.lg),
              verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm),
            ) {
              Text("EDITORIAL ${card.order}", color = MaterialTheme.colorScheme.primary)
              Text(card.title, style = MaterialTheme.typography.titleLarge)
              Text("공연 ${card.events.size}개 보기", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
          }
        }
      }
    }
  }
}

@Composable
fun OpenCalendarScreen(
  entries: List<OpenCalendarEntry>,
  onEvent: (CatalogEvent) -> Unit,
) {
  LazyColumn(
    modifier = Modifier.fillMaxSize().testTag("open-calendar-screen"),
    contentPadding = PaddingValues(TicketGroundSpacing.lg),
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm),
  ) {
    item { Text("티켓오픈 예정", style = MaterialTheme.typography.headlineSmall) }
    if (entries.isEmpty()) {
      item { Text("예매 오픈 일정이 없습니다.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    } else {
      items(entries, key = { it.opensAt + it.event.id }) { entry ->
        OpeningCard(entry, onEvent, Modifier.fillMaxWidth())
      }
    }
  }
}

@Composable
fun PublicResaleScreen(onMyPage: () -> Unit) {
  LazyColumn(
    modifier = Modifier.fillMaxSize().testTag("resale-screen"),
    contentPadding = PaddingValues(TicketGroundSpacing.lg),
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
  ) {
    item { Text("CLEAN 티켓 공식 양도", style = MaterialTheme.typography.headlineSmall) }
    item {
      Text(
        "공개 화면에서는 안전 정책만 확인할 수 있습니다. 등록과 구매 상태는 실제 처리 결과가 확인된 뒤에만 반영됩니다.",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
    items(
      listOf(
        "보유 티켓 확인" to "예매 내역과 본인 소유 티켓을 먼저 확인합니다.",
        "정책 자동 판별" to "정가 범위와 구매 이력을 기준으로 가능 여부를 판별합니다.",
        "QR 보호" to "입장 직전에 보호된 QR을 발급합니다.",
      ),
    ) { (title, detail) ->
      Card(shape = RoundedCornerShape(TicketGroundRadius.medium)) {
        Column(
          Modifier.fillMaxWidth().padding(TicketGroundSpacing.lg),
          verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs),
        ) {
          Text(title, style = MaterialTheme.typography.titleMedium)
          Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
    }
    item {
      Button(
        onClick = onMyPage,
        modifier = Modifier.fillMaxWidth().heightIn(min = TicketGroundLayout.minimumTouchTarget),
      ) { Text("마이페이지에서 내 티켓 확인") }
    }
  }
}

@Composable
private fun ParitySectionHeader(title: String, action: @Composable () -> Unit) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.SpaceBetween,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(title, style = MaterialTheme.typography.headlineSmall)
    action()
  }
}

@Composable
private fun OpeningCard(
  entry: OpenCalendarEntry,
  onEvent: (CatalogEvent) -> Unit,
  modifier: Modifier = Modifier.width(230.dp),
) {
  Card(
    modifier = modifier
      .heightIn(min = TicketGroundLayout.minimumTouchTarget)
      .clickable { onEvent(entry.event) }
      .testTag("home-opening-${entry.event.id}"),
    shape = RoundedCornerShape(TicketGroundRadius.medium),
  ) {
    Column(
      Modifier.padding(TicketGroundSpacing.lg),
      verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs),
    ) {
      Text(formatOpeningDate(entry.opensAt), color = MaterialTheme.colorScheme.primary)
      Text(entry.event.title, style = MaterialTheme.typography.titleMedium)
      Text(entry.event.venue, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
  }
}

private val openingDateFormatter = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm")

private fun formatOpeningDate(value: String): String = runCatching {
  OffsetDateTime.parse(value)
    .atZoneSameInstant(ZoneId.systemDefault())
    .format(openingDateFormatter)
}.getOrDefault(value)

@Composable
private fun ParityEventCard(event: CatalogEvent, onEvent: (CatalogEvent) -> Unit) {
  Column(
    modifier = Modifier.width(148.dp)
      .heightIn(min = TicketGroundLayout.minimumTouchTarget)
      .clickable { onEvent(event) }
      .testTag("home-genre-event-${event.id}"),
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs),
  ) {
    val imageUrl = event.image?.let { safeSeatMapImageUrl(it, BuildConfig.API_BASE_URL) }
    Box(
      Modifier.fillMaxWidth().height(176.dp).clip(RoundedCornerShape(TicketGroundRadius.medium))
        .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
      if (imageUrl != null) {
        AsyncImage(
          model = imageUrl,
          imageLoader = seatMapImageLoader(LocalContext.current),
          contentDescription = "${event.title} 포스터",
          contentScale = ContentScale.Crop,
          modifier = Modifier.fillMaxSize(),
        )
      }
    }
    Text(event.title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
    Text(event.venue, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
  }
}
