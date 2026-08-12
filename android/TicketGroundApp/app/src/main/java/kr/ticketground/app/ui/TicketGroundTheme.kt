package kr.ticketground.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Accent = Color(0xFFFF2D3F)
private val Success = Color(0xFF1F8A5B)
private val Warning = Color(0xFFC47A00)

object TicketGroundSpacing {
  val xs = 4.dp
  val sm = 8.dp
  val md = 12.dp
  val lg = 16.dp
  val xl = 24.dp
}

object TicketGroundRadius {
  val xs = 2.dp
  val small = 6.dp
  val medium = 12.dp
}

object TicketGroundLayout {
  val expandedBreakpoint = 600.dp
  val detailPaneWidth = 320.dp
  val minimumTouchTarget = 48.dp
  val minimumSeatMarker = 16.dp
  val maximumSeatMarker = 60.dp
  val outlineWidth = 1.dp
  val seatMarkerStrokeWidth = 2.dp
  const val seatMapAspectRatio = 1.35f
  const val zoomStep = 0.25f
  const val panStep = 16f
}

data class TicketGroundSeatStateColors(
  val available: Color,
  val selected: Color,
  val held: Color,
  val sold: Color,
  val unavailable: Color,
)

val LocalTicketGroundSeatStateColors = staticCompositionLocalOf<TicketGroundSeatStateColors> {
  error("TicketGroundTheme is required")
}

private val TicketGroundTypography = Typography(
  headlineMedium = TextStyle(fontSize = 28.sp, lineHeight = 34.sp, fontWeight = FontWeight.Black),
  headlineSmall = TextStyle(fontSize = 24.sp, lineHeight = 30.sp, fontWeight = FontWeight.Black),
  titleLarge = TextStyle(fontSize = 22.sp, lineHeight = 28.sp, fontWeight = FontWeight.Black),
  titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Bold),
  bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
  labelSmall = TextStyle(fontSize = 11.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
)

private val LightColors = lightColorScheme(
  primary = Accent,
  onPrimary = Color.White,
  secondary = Success,
  tertiary = Warning,
  background = Color(0xFFF7F7F8),
  surface = Color.White,
  onSurface = Color(0xFF1A1A1D),
  outline = Color(0xFFD8D8DC),
  error = Accent,
)

private val DarkColors = darkColorScheme(
  primary = Accent,
  onPrimary = Color.White,
  secondary = Color(0xFF55C491),
  tertiary = Color(0xFFF0B34D),
  background = Color(0xFF151517),
  surface = Color(0xFF1D1D1F),
  onSurface = Color(0xFFF5F5F5),
  outline = Color(0xFF49494E),
  error = Color(0xFFFF6875),
)

@Composable
fun TicketGroundTheme(content: @Composable () -> Unit) {
  val dark = isSystemInDarkTheme()
  val colors = if (dark) DarkColors else LightColors
  val stateColors = TicketGroundSeatStateColors(
    available = colors.secondary,
    selected = colors.primary,
    held = colors.tertiary,
    sold = colors.onSurface.copy(alpha = if (dark) 0.38f else 0.25f),
    unavailable = colors.outline,
  )
  CompositionLocalProvider(LocalTicketGroundSeatStateColors provides stateColors) {
    MaterialTheme(
      colorScheme = colors,
      typography = TicketGroundTypography,
      content = content,
    )
  }
}
