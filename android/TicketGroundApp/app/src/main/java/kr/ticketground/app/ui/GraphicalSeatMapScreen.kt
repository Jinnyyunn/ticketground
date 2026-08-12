package kr.ticketground.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kr.ticketground.app.data.Seat
import kr.ticketground.app.data.SeatMap

@Composable
fun GraphicalSeatMapScreen(
  state: AsyncContent<SeatMap>,
  selectedSeatId: String?,
  heldSeatId: String?,
  pending: Boolean,
  onRetry: () -> Unit,
  onSeatSelected: (String?) -> Unit,
  onBook: () -> Unit,
) {
  AsyncSurface(state, onRetry) { seatMap ->
    val positioned = seatMap.seats.filter { it.mapPosition != null }
    if (positioned.isEmpty()) {
      Box(Modifier.fillMaxSize()) {
        Text("선택 가능한 좌석이 없습니다. 다른 회차를 확인해 주세요.", Modifier.padding(24.dp))
      }
      return@AsyncSurface
    }
    var zoom by remember { mutableFloatStateOf(1f) }
    var panX by remember { mutableFloatStateOf(0f) }
    var panY by remember { mutableFloatStateOf(0f) }
    Column(
      Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Text(seatMap.event.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black)
      Text("좌석도에서 구매할 좌석을 직접 선택하세요")
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { zoom = (zoom + 0.25f).coerceAtMost(2f) }) { Text("확대") }
        OutlinedButton(onClick = { zoom = (zoom - 0.25f).coerceAtLeast(1f) }) { Text("축소") }
        OutlinedButton(onClick = { zoom = 1f; panX = 0f; panY = 0f }) { Text("초기화") }
        Text("${(zoom * 100).toInt()}%", Modifier.align(Alignment.CenterVertically))
      }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { panX -= 16f }) { Text("왼쪽") }
        OutlinedButton(onClick = { panX += 16f }) { Text("오른쪽") }
        OutlinedButton(onClick = { panY -= 16f }) { Text("위") }
        OutlinedButton(onClick = { panY += 16f }) { Text("아래") }
      }
      BoxWithConstraints(
        Modifier.fillMaxWidth().aspectRatio(1.35f).background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
          .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
          .clip(RoundedCornerShape(12.dp))
          .testTag("graphical-seat-map"),
      ) {
        val mapWidth = maxWidth
        val mapHeight = maxHeight
        Box(
          Modifier.fillMaxSize().offset(panX.dp, panY.dp).graphicsLayer(scaleX = zoom, scaleY = zoom),
        ) {
          Text(
            "STAGE",
            modifier = Modifier.align(Alignment.TopCenter).padding(top = 12.dp)
              .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(8.dp)).padding(horizontal = 28.dp, vertical = 6.dp),
            fontWeight = FontWeight.Black,
          )
          positioned.forEach { seat ->
            val position = requireNotNull(seat.mapPosition)
            val x = (mapWidth - 48.dp) * (position.x.toFloat() / 100f).coerceIn(0f, 1f)
            val y = (mapHeight - 48.dp) * (position.y.toFloat() / 100f).coerceIn(0f, 1f)
            val visualState = seatVisualState(seat, selectedSeatId, heldSeatId)
            Box(
              modifier = Modifier.offset(x, y).size(48.dp)
                .semantics {
                  contentDescription = "${seat.displayCode.ifBlank { seat.label }}, ${visualState.label}, ${seat.price.krw()}원"
                  stateDescription = visualState.label
                }
                .clickable(enabled = visualState.selectable && !pending) {
                  onSeatSelected(if (seat.id == selectedSeatId) null else seat.id)
                }
                .testTag("seat-${seat.id}"),
              contentAlignment = Alignment.Center,
            ) {
              Box(
                Modifier.size(20.dp).rotate(position.rotate.toFloat())
                  .background(visualState.color(), seatShape(position.shape))
                  .border(2.dp, MaterialTheme.colorScheme.surface, seatShape(position.shape)),
              )
            }
          }
        }
      }
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        listOf("선택 가능", "선택됨", "점유됨", "판매 완료", "선택 불가").forEach { Text(it, style = MaterialTheme.typography.labelSmall) }
      }
      val selected = seatMap.seats.firstOrNull { it.id == selectedSeatId }
      Text(selected?.let { "선택 좌석 ${it.displayCode.ifBlank { it.label }} · ${it.price.krw()}원" } ?: "좌석을 선택해 주세요")
      Button(onClick = onBook, enabled = selected != null && !pending, modifier = Modifier.fillMaxWidth()) {
        Text(if (pending) "좌석 확보 중" else "선택한 좌석 예매하기")
      }
    }
  }
}

private data class SeatVisualState(val label: String, val selectable: Boolean, val tone: SeatTone) {
  @Composable fun color(): Color = when (tone) {
    SeatTone.Available -> MaterialTheme.colorScheme.secondary
    SeatTone.Selected -> MaterialTheme.colorScheme.primary
    SeatTone.Held -> MaterialTheme.colorScheme.tertiary
    SeatTone.Sold -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.25f)
    SeatTone.Unavailable -> MaterialTheme.colorScheme.outline
  }
}

private enum class SeatTone { Available, Selected, Held, Sold, Unavailable }

private fun seatVisualState(seat: Seat, selectedSeatId: String?, heldSeatId: String?): SeatVisualState = when {
  seat.id == heldSeatId -> SeatVisualState("점유됨", false, SeatTone.Held)
  seat.id == selectedSeatId -> SeatVisualState("선택됨", true, SeatTone.Selected)
  !seat.available && seat.status.uppercase() in setOf("SOLD", "OWNED") -> SeatVisualState("판매 완료", false, SeatTone.Sold)
  !seat.available -> SeatVisualState("선택 불가", false, SeatTone.Unavailable)
  else -> SeatVisualState("선택 가능", true, SeatTone.Available)
}

private fun seatShape(shape: String): Shape = when (shape.lowercase()) {
  "square", "rect", "rectangle" -> RoundedCornerShape(2.dp)
  "rounded", "rounded-rectangle" -> RoundedCornerShape(6.dp)
  else -> CircleShape
}
