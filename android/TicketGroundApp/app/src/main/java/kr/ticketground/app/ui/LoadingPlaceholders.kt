package kr.ticketground.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage

/**
 * Small shimmering rectangle used to build content-shaped loading skeletons. Kept as a single
 * reusable primitive so every screen's skeleton looks and animates the same way.
 */
@Composable
internal fun ShimmerPlaceholder(
  modifier: Modifier = Modifier,
  shape: Shape = RoundedCornerShape(TicketGroundRadius.small),
) {
  val transition = rememberInfiniteTransition(label = "shimmer")
  val translate by transition.animateFloat(
    initialValue = -400f,
    targetValue = 800f,
    animationSpec = infiniteRepeatable(
      animation = tween(durationMillis = 1100, easing = LinearEasing),
      repeatMode = RepeatMode.Restart,
    ),
    label = "shimmerTranslate",
  )
  val base = MaterialTheme.colorScheme.surfaceVariant
  val brush = Brush.linearGradient(
    colors = listOf(base.copy(alpha = 0.55f), base.copy(alpha = 0.15f), base.copy(alpha = 0.55f)),
    start = Offset(translate, 0f),
    end = Offset(translate + 320f, 320f),
  )
  Box(modifier.clip(shape).background(brush))
}

private enum class PosterLoadPhase { Loading, Loaded, Failed }

/**
 * Poster thumbnail shared by every event list row (home ranking, genre rail, search results,
 * watchlist). Shows a shimmer while the image loads and a gradient + initials fallback when the
 * URL is missing or fails to load -- never a blank box.
 */
@Composable
internal fun EventPosterThumbnail(
  imageUrl: String?,
  title: String,
  modifier: Modifier = Modifier,
  shape: Shape = RoundedCornerShape(TicketGroundRadius.small),
) {
  var phase by remember(imageUrl) {
    mutableStateOf(if (imageUrl.isNullOrBlank()) PosterLoadPhase.Failed else PosterLoadPhase.Loading)
  }
  Box(modifier.clip(shape)) {
    if (!imageUrl.isNullOrBlank()) {
      AsyncImage(
        model = imageUrl,
        imageLoader = seatMapImageLoader(LocalContext.current),
        contentDescription = "$title 포스터",
        contentScale = ContentScale.Crop,
        onLoading = { phase = PosterLoadPhase.Loading },
        onSuccess = { phase = PosterLoadPhase.Loaded },
        onError = { phase = PosterLoadPhase.Failed },
        modifier = Modifier.fillMaxSize(),
      )
    }
    when (phase) {
      PosterLoadPhase.Loading -> ShimmerPlaceholder(Modifier.fillMaxSize(), shape = shape)
      PosterLoadPhase.Failed -> PosterFallback(title, Modifier.fillMaxSize(), shape)
      PosterLoadPhase.Loaded -> Unit
    }
  }
}

@Composable
private fun PosterFallback(title: String, modifier: Modifier = Modifier, shape: Shape) {
  Box(
    modifier.background(
      Brush.linearGradient(listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.tertiary)),
      shape,
    ),
    contentAlignment = Alignment.Center,
  ) {
    Text(posterInitials(title), color = Color.White, style = MaterialTheme.typography.titleMedium)
  }
}

private fun posterInitials(title: String): String {
  val trimmed = title.trim()
  return if (trimmed.isEmpty()) "TG" else trimmed.take(2)
}

/** Small status pill (sale badge, watchlist sale state, ...) shared across event cards. */
@Composable
internal fun StatusBadge(
  text: String,
  modifier: Modifier = Modifier,
  containerColor: Color = MaterialTheme.colorScheme.primary,
  contentColor: Color = Color.White,
) {
  Surface(modifier = modifier, color = containerColor, contentColor = contentColor, shape = RoundedCornerShape(TicketGroundRadius.small)) {
    Text(
      text,
      style = MaterialTheme.typography.labelSmall,
      modifier = Modifier.padding(horizontal = TicketGroundSpacing.sm, vertical = TicketGroundSpacing.xs),
    )
  }
}

/** Optional cast/lineup chip row shown under an event card title when the API provides casts. */
@Composable
internal fun CastChipRow(casts: List<String>, modifier: Modifier = Modifier) {
  Row(modifier, horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs)) {
    casts.take(3).forEach { cast ->
      Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(TicketGroundRadius.small)) {
        Text(
          cast,
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.padding(horizontal = TicketGroundSpacing.sm, vertical = TicketGroundSpacing.xs),
        )
      }
    }
  }
}

/** Card-row shaped skeleton mimicking [EventCard]'s poster + title + venue + badge layout. */
@Composable
internal fun EventCardSkeleton(modifier: Modifier = Modifier) {
  Card(
    modifier = modifier.fillMaxWidth().padding(vertical = TicketGroundSpacing.xs),
    shape = RoundedCornerShape(TicketGroundRadius.medium),
  ) {
    Row(
      Modifier.padding(TicketGroundSpacing.lg),
      horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
    ) {
      ShimmerPlaceholder(Modifier.size(72.dp))
      Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        ShimmerPlaceholder(Modifier.width(160.dp).height(18.dp))
        ShimmerPlaceholder(Modifier.width(110.dp).height(14.dp))
        ShimmerPlaceholder(Modifier.width(70.dp).height(16.dp))
      }
    }
  }
}

/** List-shaped loading skeleton used while event list / search / discovery results load. */
@Composable
internal fun EventListLoadingSkeleton(modifier: Modifier = Modifier) {
  Column(
    modifier.fillMaxSize().padding(TicketGroundSpacing.lg),
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm),
  ) {
    repeat(6) { EventCardSkeleton() }
  }
}

/** Home-feed shaped loading skeleton: search bar + hero + ranking rail + list cards. */
@Composable
internal fun HomeLoadingSkeleton(modifier: Modifier = Modifier) {
  Column(
    modifier.fillMaxSize().padding(TicketGroundSpacing.lg),
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.lg),
  ) {
    ShimmerPlaceholder(Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(24.dp))
    ShimmerPlaceholder(Modifier.fillMaxWidth().height(320.dp), shape = RoundedCornerShape(TicketGroundRadius.medium))
    Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
      repeat(3) { ShimmerPlaceholder(Modifier.weight(1f).height(160.dp), shape = RoundedCornerShape(TicketGroundRadius.medium)) }
    }
    repeat(3) { EventCardSkeleton() }
  }
}

/** Loading skeleton for the seat map's first load: a map-shaped block plus legend placeholders. */
@Composable
internal fun SeatMapLoadingSkeleton(modifier: Modifier = Modifier) {
  Column(
    modifier.fillMaxSize().padding(TicketGroundSpacing.lg),
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
  ) {
    ShimmerPlaceholder(Modifier.width(200.dp).height(24.dp))
    ShimmerPlaceholder(
      Modifier.fillMaxWidth().height(360.dp),
      shape = RoundedCornerShape(TicketGroundRadius.medium),
    )
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
      repeat(5) { ShimmerPlaceholder(Modifier.width(48.dp).height(14.dp)) }
    }
  }
}
