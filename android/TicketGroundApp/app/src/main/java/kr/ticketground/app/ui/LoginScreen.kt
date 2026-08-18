package kr.ticketground.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.QrCode2
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kr.ticketground.app.BuildConfig

private val KakaoYellow = Color(0xFFFFDE32)
private val KakaoInk = Color(0xFF2D1B1B)
private val NaverGreen = Color(0xFF03C75A)

/**
 * Full-screen native login, replacing the bare two-button AlertDialog. Reuses the exact same
 * Kakao/Naver native-handoff flow (testTags "login-kakao"/"login-naver" preserved so the choice
 * itself is unchanged) -- only Kakao and Naver are offered here. Unlike iOS, this app has no
 * Google Sign-In SDK dependency and no verified Android-facing Google credential contract on the
 * backend; adding one would be new native-provider work, not verification/polish of what already
 * ships, so it's deliberately left out rather than half-wired.
 *
 * Visual structure mirrors iOS's Phase 1 login screen (DiscoveryLoginView) for cross-platform
 * design parity: brand hero art, provider buttons in their official brand colors, three trust-
 * signal bullets, and a footer with legal links + app version -- built entirely from this app's
 * existing Material 3 tokens (TicketGroundSpacing/TicketGroundRadius/TicketGroundTheme colors),
 * no new visual language introduced.
 */
@Composable
fun LoginScreen(
  onProviderSelected: (String) -> Unit,
  onClose: () -> Unit,
) {
  Column(
    Modifier
      .fillMaxSize()
      .verticalScroll(rememberScrollState())
      .padding(horizontal = TicketGroundSpacing.lg, vertical = TicketGroundSpacing.sm),
  ) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
      IconButton(onClick = onClose, modifier = Modifier.testTag("login-close")) {
        Icon(Icons.Default.Close, contentDescription = "닫기")
      }
    }
    Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xl)) {
      LoginHeroBanner()
      Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.xs)) {
        Text(
          "로그인",
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier.testTag("login-screen-title"),
        )
        Text("간편 로그인으로 시작해 주세요", style = MaterialTheme.typography.titleLarge)
        Text(
          "카카오톡 또는 네이버 계정으로 안전하게 연결합니다.",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      Column(verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
        ProviderButton(
          label = "카카오톡으로 계속하기",
          background = KakaoYellow,
          foreground = KakaoInk,
          testTag = "login-kakao",
          onClick = { onProviderSelected("kakao") },
        )
        ProviderButton(
          label = "네이버로 계속하기",
          background = NaverGreen,
          foreground = Color.White,
          testTag = "login-naver",
          onClick = { onProviderSelected("naver") },
        )
      }
      LoginBenefitsCard()
      Spacer(Modifier.height(TicketGroundSpacing.xl))
      LoginFooter()
    }
  }
}

@Composable
private fun ProviderButton(
  label: String,
  background: Color,
  foreground: Color,
  testTag: String,
  onClick: () -> Unit,
) {
  Button(
    onClick = onClick,
    colors = ButtonDefaults.buttonColors(containerColor = background, contentColor = foreground),
    shape = RoundedCornerShape(TicketGroundRadius.medium),
    modifier = Modifier.fillMaxWidth().height(52.dp).testTag(testTag),
  ) {
    Text(label, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
  }
}

/**
 * Brand hero art at the top of the login screen, matching the tone of iOS's LoginHeroBanner (dark
 * gradient, wordmark, short tagline) rather than depending on any specific event image.
 */
@Composable
private fun LoginHeroBanner() {
  Box(
    Modifier
      .fillMaxWidth()
      .height(132.dp)
      .clip(RoundedCornerShape(TicketGroundRadius.medium))
      .background(
        Brush.linearGradient(
          listOf(
            MaterialTheme.colorScheme.onSurface,
            MaterialTheme.colorScheme.primary.copy(alpha = 0.82f),
          ),
        ),
      )
      .testTag("login-hero-banner"),
    contentAlignment = Alignment.BottomStart,
  ) {
    Column(Modifier.padding(TicketGroundSpacing.lg)) {
      Text(
        "Ticketground",
        color = Color.White,
        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Black),
      )
      Text(
        "공연을 발견하고, 예매하고, 안전하게 관리하세요.",
        color = Color.White.copy(alpha = 0.88f),
        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
      )
    }
  }
}

/**
 * Short trust-signal bullets below the provider buttons -- the same three reasons-to-sign-in used
 * on iOS's login screen, not an onboarding carousel (explicitly out of scope per the improvement
 * plan).
 */
@Composable
private fun LoginBenefitsCard() {
  val benefits: List<Pair<ImageVector, String>> = listOf(
    Icons.Default.Bolt to "실시간 좌석 확보",
    Icons.Default.Lock to "안전한 결제",
    Icons.Default.QrCode2 to "빠른 티켓 확인",
  )
  Surface(
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = RoundedCornerShape(TicketGroundRadius.medium),
    modifier = Modifier.fillMaxWidth().testTag("login-benefits"),
  ) {
    Column(
      Modifier.padding(TicketGroundSpacing.lg),
      verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
    ) {
      benefits.forEach { (icon, title) ->
        Row(
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
        ) {
          Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
          Text(title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
        }
      }
    }
  }
}

@Composable
private fun LoginFooter() {
  val uriHandler = LocalUriHandler.current
  val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')
  Column(
    Modifier.fillMaxWidth().testTag("login-footer"),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm),
  ) {
    Row(horizontalArrangement = Arrangement.spacedBy(TicketGroundSpacing.sm)) {
      Text(
        "이용약관",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
          .testTag("login-footer-terms")
          .clickable { uriHandler.openUri("$baseUrl/terms") },
      )
      Text("·", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Text(
        "개인정보처리방침",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
          .testTag("login-footer-privacy")
          .clickable { uriHandler.openUri("$baseUrl/privacy") },
      )
    }
    Text(
      "버전 ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      modifier = Modifier.testTag("login-footer-version"),
    )
  }
}

/**
 * Shown instead of the app's normal content when the login-reentry biometric gate is locked (see
 * kr.ticketground.app.foundation.LoginReentryGateController) -- an already-established session
 * exists and the user opted into protecting it, so unlocking is required before revealing it.
 * Never shown during the initial OAuth grant itself: there is nothing to protect until a session
 * is stored, so the gate only ever engages on reentry.
 *
 * [onLogout] is this screen's escape hatch: a user who opted into the gate and then loses
 * biometric enrollment (an ordinary Settings action, with no DEVICE_CREDENTIAL fallback wired up)
 * would otherwise be locked out on every future launch with no in-app recovery. It deliberately
 * requires no successful biometric confirmation first -- logging out doesn't need proof of
 * identity, only *staying* logged in behind the gate does -- and stays available in every state
 * (including mid-unlock or after a failed attempt) so it is never itself the thing blocking escape.
 */
@Composable
fun LoginReentryLockScreen(
  onUnlock: () -> Unit,
  unlocking: Boolean,
  failed: Boolean,
  onLogout: () -> Unit = {},
) {
  Box(Modifier.fillMaxSize().testTag("login-gate-lock-screen"), contentAlignment = Alignment.Center) {
    Column(
      Modifier.padding(TicketGroundSpacing.xl),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(TicketGroundSpacing.md),
    ) {
      Icon(
        Icons.Default.Fingerprint,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(48.dp),
      )
      Text("잠금 해제", style = MaterialTheme.typography.titleLarge)
      Text(
        "로그인 정보를 보호하기 위해 생체 인증이 필요합니다.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      if (failed) {
        Text(
          "인증에 실패했습니다. 다시 시도해 주세요.",
          color = MaterialTheme.colorScheme.error,
          modifier = Modifier.testTag("login-gate-failed"),
        )
      }
      if (unlocking) {
        CircularProgressIndicator(modifier = Modifier.testTag("login-gate-unlocking"))
      } else {
        Button(onClick = onUnlock, modifier = Modifier.fillMaxWidth().testTag("login-gate-unlock")) {
          Text("잠금 해제")
        }
      }
      TextButton(onClick = onLogout, modifier = Modifier.fillMaxWidth().testTag("login-gate-logout")) {
        Text("로그아웃", color = MaterialTheme.colorScheme.error)
      }
    }
  }
}
