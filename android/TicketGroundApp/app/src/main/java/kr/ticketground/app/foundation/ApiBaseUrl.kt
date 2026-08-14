package kr.ticketground.app.foundation

import java.net.URI

@JvmInline
value class ApiBaseUrl private constructor(val value: String) {
  companion object {
    fun parse(rawValue: String): ApiBaseUrl {
      val uri = URI(rawValue)
      require(uri.scheme == "https") { "API base URL must use HTTPS" }
      require(!uri.host.isNullOrBlank()) { "API base URL must include a host" }
      require(uri.query == null && uri.fragment == null) { "API base URL must be an origin" }
      return ApiBaseUrl("https://${uri.host}${uri.port.takeIf { it != -1 }?.let { ":$it" } ?: ""}")
    }
  }
}
