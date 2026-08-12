package kr.ticketground.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import java.net.URI
import kr.ticketground.app.BuildConfig
import kr.ticketground.app.data.Seat
import kr.ticketground.app.data.SeatMap
import kr.ticketground.app.data.SeatPosition
import kotlin.math.max
import kotlin.math.min

@Composable
fun GraphicalSeatMapScreen(
  state: AsyncContent<SeatMap>,
  selectedSeatId: String?,
  heldSeatIds: Set<String> = emptySet(),
  pending: Boolean,
  onRetry: () -> Unit,
  onSeatSelected: (String?) -> Unit,
  onBook: () -> Unit,
) {
  AsyncSurface(state, onRetry) { seatMap ->
    val positioned = seatMap.seats.filter { it.mapPosition != null }
    if (positioned.isEmpty()) {
      Box(Modifier.fillMaxSize()) {
        Text("선택 가능한 좌석이 없습니다. 다른 회차를 확인해 주세요.", Modifier.padding(TicketGroundSpacing.xl))
      }
      return@AsyncSurface
    }
    var zoom by remember { mutableFloatStateOf(1f) }
    var panX by remember { mutableFloatStateOf(0f) }
    var panY by remember { mutableFloatStateOf(0f) }
    Column(
      Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(TicketGroundSpacing.lg),
      verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
    ) {
      Text(seatMap.event.title, style = MaterialTheme.typography.titleLarge)
      Text("좌석도에서 구매할 좌석을 직접 선택하세요")
      Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        OutlinedButton(onClick = { zoom = (zoom + TicketGroundLayout.zoomStep).coerceAtMost(2f) }) { Text("확대") }
        OutlinedButton(onClick = { zoom = (zoom - TicketGroundLayout.zoomStep).coerceAtLeast(1f) }) { Text("축소") }
        OutlinedButton(onClick = { zoom = 1f; panX = 0f; panY = 0f }) { Text("초기화") }
        Text("${(zoom * 100).toInt()}%", Modifier.align(Alignment.CenterVertically))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        OutlinedButton(onClick = { panX -= TicketGroundLayout.panStep }) { Text("왼쪽") }
        OutlinedButton(onClick = { panX += TicketGroundLayout.panStep }) { Text("오른쪽") }
        OutlinedButton(onClick = { panY -= TicketGroundLayout.panStep }) { Text("위") }
        OutlinedButton(onClick = { panY += TicketGroundLayout.panStep }) { Text("아래") }
      }
      BoxWithConstraints(
        Modifier.fillMaxWidth().aspectRatio(TicketGroundLayout.seatMapAspectRatio)
          .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(TicketGroundRadius.medium))
          .border(TicketGroundLayout.outlineWidth, MaterialTheme.colorScheme.outline, RoundedCornerShape(TicketGroundRadius.medium))
          .clip(RoundedCornerShape(TicketGroundRadius.medium))
          .testTag("graphical-seat-map"),
      ) {
        val mapWidth = maxWidth
        val mapHeight = maxHeight
        Box(
          Modifier.fillMaxSize().offset(panX.dp, panY.dp).graphicsLayer(scaleX = zoom, scaleY = zoom),
        ) {
          SeatMapImageLayer(seatMap)
          positioned.forEach { seat ->
            val position = requireNotNull(seat.mapPosition)
            val geometry = seatMarkerGeometry(position, mapWidth.value, mapHeight.value)
            val presentation = seatPresentation(seat, selectedSeatId, heldSeatIds)
            Box(
              modifier = Modifier
                .offset(
                  (geometry.centerX - TicketGroundLayout.minimumTouchTarget.value / 2f).dp,
                  (geometry.centerY - TicketGroundLayout.minimumTouchTarget.value / 2f).dp,
                )
                .size(TicketGroundLayout.minimumTouchTarget)
                .semantics {
                  contentDescription = "${seat.displayCode.ifBlank { seat.label }}, ${presentation.label}, ${seat.price.krw()}원"
                  stateDescription = presentation.label
                  role = Role.Button
                }
                .clickable(enabled = presentation.selectable && !pending) {
                  onSeatSelected(if (seat.id == selectedSeatId) null else seat.id)
                }
                .testTag("seat-${seat.id}"),
              contentAlignment = Alignment.Center,
            ) {
              Box(
                Modifier
                  .size(geometry.width.dp, geometry.height.dp)
                  .rotate(position.rotate.toFloat())
                  .background(presentation.color(), seatShape(position.shape))
                  .border(TicketGroundLayout.seatMarkerStrokeWidth, MaterialTheme.colorScheme.surface, seatShape(position.shape))
                  .testTag("seat-marker-${seat.id}"),
              )
            }
          }
        }
      }
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        listOf("선택 가능", "선택됨", "점유됨", "판매 완료", "선택 불가").forEach {
          Text(it, style = MaterialTheme.typography.labelSmall)
        }
      }
      val selected = seatMap.seats.firstOrNull { it.id == selectedSeatId }
      Text(selected?.let { "선택 좌석 ${it.displayCode.ifBlank { it.label }} · ${it.price.krw()}원" } ?: "좌석을 선택해 주세요")
      Button(onClick = onBook, enabled = selected != null && pending.not(), modifier = Modifier.fillMaxWidth()) {
        Text(if (pending) "좌석 확보 중" else "선택한 좌석 예매하기")
      }
    }
  }
}

@Composable
private fun SeatMapImageLayer(seatMap: SeatMap) {
  val safeImageUrl = remember(seatMap.map.image) {
    safeSeatMapImageUrl(seatMap.map.image, BuildConfig.API_BASE_URL)
  }
  var failed by remember(safeImageUrl) { mutableStateOf(false) }
  if (safeImageUrl != null && !failed) {
    AsyncImage(
      model = safeImageUrl,
      contentDescription = "${seatMap.map.title} 좌석 배치도",
      contentScale = ContentScale.Fit,
      onError = { failed = true },
      modifier = Modifier.fillMaxSize().testTag("seat-map-image"),
    )
  } else {
    Box(
      Modifier.fillMaxSize().testTag("seat-map-image-fallback")
        .semantics { contentDescription = "좌석 배치도 이미지 대체 화면" },
    ) {
      Text(
        "STAGE",
        modifier = Modifier.align(Alignment.TopCenter).padding(top = TicketGroundSpacing.md)
          .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(TicketGroundRadius.small))
          .padding(horizontal = TicketGroundSpacing.xl, vertical = TicketGroundSpacing.sm),
        style = MaterialTheme.typography.labelSmall,
      )
    }
  }
}

internal data class SeatMarkerGeometry(
  val centerX: Float,
  val centerY: Float,
  val width: Float,
  val height: Float,
)

internal fun seatMarkerGeometry(position: SeatPosition, mapWidth: Float, mapHeight: Float): SeatMarkerGeometry {
  val touchInset = TicketGroundLayout.minimumTouchTarget.value / 2f
  return SeatMarkerGeometry(
    centerX = (mapWidth * position.x.toFloat() / 100f).coerceIn(touchInset, mapWidth - touchInset),
    centerY = (mapHeight * position.y.toFloat() / 100f).coerceIn(touchInset, mapHeight - touchInset),
    width = max(TicketGroundLayout.minimumSeatMarker.value, min(mapWidth * position.width.toFloat() / 100f, TicketGroundLayout.maximumSeatMarker.value)),
    height = max(TicketGroundLayout.minimumSeatMarker.value, min(mapHeight * position.height.toFloat() / 100f, TicketGroundLayout.maximumSeatMarker.value)),
  )
}

internal data class SeatPresentation(val label: String, val selectable: Boolean, val tone: SeatTone) {
  @Composable
  fun color(): Color {
    val colors = LocalTicketGroundSeatStateColors.current
    return when (tone) {
      SeatTone.Available -> colors.available
      SeatTone.Selected -> colors.selected
      SeatTone.Held -> colors.held
      SeatTone.Sold -> colors.sold
      SeatTone.Unavailable -> colors.unavailable
    }
  }
}

internal enum class SeatTone { Available, Selected, Held, Sold, Unavailable }

internal fun seatPresentation(seat: Seat, selectedSeatId: String?, heldSeatIds: Set<String>): SeatPresentation = when {
  seat.id in heldSeatIds || seat.status.equals("HELD", ignoreCase = true) -> SeatPresentation("점유됨", false, SeatTone.Held)
  seat.id == selectedSeatId -> SeatPresentation("선택됨", true, SeatTone.Selected)
  !seat.available && seat.status.uppercase() in setOf("SOLD", "OWNED") -> SeatPresentation("판매 완료", false, SeatTone.Sold)
  !seat.available -> SeatPresentation("선택 불가", false, SeatTone.Unavailable)
  else -> SeatPresentation("선택 가능", true, SeatTone.Available)
}

internal fun safeSeatMapImageUrl(image: String, configuredOrigin: String): String? = runCatching {
  if (image.isBlank()) return null
  val origin = URI(configuredOrigin.trim())
  if (!origin.scheme.equals("https", ignoreCase = true) || origin.host.isNullOrBlank()) return null
  val resolved = origin.resolve(image.trim()).normalize()
  val originPort = if (origin.port == -1) 443 else origin.port
  val resolvedPort = if (resolved.port == -1) 443 else resolved.port
  if (
    !resolved.scheme.equals("https", ignoreCase = true) ||
    !resolved.host.equals(origin.host, ignoreCase = true) ||
    resolvedPort != originPort ||
    resolved.userInfo != null
  ) return null
  resolved.toASCIIString()
}.getOrNull()

private fun seatShape(shape: String): Shape = when (shape.lowercase()) {
  "square", "rect", "rectangle" -> RoundedCornerShape(TicketGroundRadius.xs)
  "rounded", "rounded-rectangle" -> RoundedCornerShape(TicketGroundRadius.small)
  else -> CircleShape
}
