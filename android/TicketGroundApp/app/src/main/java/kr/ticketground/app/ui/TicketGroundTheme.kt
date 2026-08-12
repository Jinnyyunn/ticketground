package kr.ticketground.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Accent = Color(0xFFFF2D3F)
private val Success = Color(0xFF1F8A5B)
private val Warning = Color(0xFFC47A00)

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
  MaterialTheme(
    colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
    content = content,
  )
}
