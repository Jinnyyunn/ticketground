package kr.ticketground.app.data

import java.io.IOException
import java.net.URLEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import kr.ticketground.app.BuildConfig
import kr.ticketground.app.foundation.ApiBaseUrl
import kr.ticketground.app.foundation.SessionVault

sealed class ApiError(message: String, cause: Throwable? = null) : Exception(message, cause) {
  class Transport(cause: Throwable) : ApiError("API transport failed", cause)
  class MalformedResponse : ApiError("Malformed API response")
  class MissingCredential : ApiError("Bearer credential is required")
  class InsecureOrigin : ApiError("Bearer credentials require the configured HTTPS origin")
  class IncompatibleContract(val expected: String, val observed: String?) :
    ApiError("Incompatible API contract")
  class Unauthorized(val code: String, message: String) : ApiError(message)
  class Forbidden(val code: String, message: String) : ApiError(message)
  class NotFound(val code: String, message: String) : ApiError(message)
  class Conflict(
    val code: String,
    message: String,
    val idempotencyConflict: Boolean,
  ) : ApiError(message)
  class Retryable(val status: Int, val code: String, message: String) : ApiError(message)
  class Server(val status: Int, val code: String, message: String) : ApiError(message)
}

class TicketGroundApiClient private constructor(
  private val baseUrl: HttpUrl,
  private val sessionVault: SessionVault,
  suppliedHttpClient: OkHttpClient,
) {
  private val httpClient = suppliedHttpClient.newBuilder()
    .followRedirects(false)
    .followSslRedirects(false)
    .build()
  private val publicApi = PublicApi(this)
  private val accountApi = AccountApi(this)
  private var compatibleHealth: ApiHealth? = null

  fun public(): PublicApi = publicApi

  fun account(): AccountApi = accountApi

  suspend fun health(): ApiHealth = execute(ApiRequest(path = "/api/health"), ApiHealth.serializer())

  internal suspend fun requireContract(capability: String? = null) {
    val health = compatibleHealth ?: health().also {
      if (it.version != API_VERSION) throw ApiError.IncompatibleContract(API_VERSION, it.version)
      compatibleHealth = it
    }
    if (capability != null && health.capabilities?.contains(capability) != true) {
      throw ApiError.IncompatibleContract(capability, health.capabilities?.joinToString(","))
    }
  }

  internal suspend fun requireAccountPrerequisites() {
    if (!baseUrl.isHttps) throw ApiError.InsecureOrigin()
    if (sessionVault.read()?.accessToken.isNullOrBlank()) throw ApiError.MissingCredential()
  }

  internal suspend fun <T> execute(request: ApiRequest, serializer: KSerializer<T>): T {
    val httpRequest = buildRequest(request)
    val responseBody = try {
      withContext(Dispatchers.IO) {
        httpClient.newCall(httpRequest).execute().use { response ->
          val body = response.body.string()
          if (!response.isSuccessful) throw mapFailure(response.code, body)
          body
        }
      }
    } catch (error: ApiError) {
      throw error
    } catch (error: IOException) {
      throw ApiError.Transport(error)
    }
    return decodeEnvelope(responseBody, serializer)
  }

  private suspend fun buildRequest(apiRequest: ApiRequest): Request {
    require(apiRequest.path.startsWith("/") && !apiRequest.path.startsWith("//"))
    val urlBuilder = baseUrl.newBuilder().encodedPath(apiRequest.path)
    apiRequest.query.forEach { (name, value) -> urlBuilder.addQueryParameter(name, value) }
    val url = urlBuilder.build()
    if (url.scheme != baseUrl.scheme || url.host != baseUrl.host || url.port != baseUrl.port) {
      throw ApiError.InsecureOrigin()
    }
    val builder = Request.Builder().url(url).header("Accept", "application/json")
    val body = apiRequest.body?.toRequestBody(JSON_MEDIA_TYPE)
      ?: if (apiRequest.method in METHODS_REQUIRING_BODY) ByteArray(0).toRequestBody(null) else null
    builder.method(apiRequest.method, body)
    if (body != null) builder.header("Content-Type", "application/json")
    apiRequest.idempotencyKey?.let { key ->
      require(key.isNotBlank())
      builder.header("X-Idempotency-Key", key)
    }
    if (apiRequest.authenticated) {
      if (!baseUrl.isHttps) throw ApiError.InsecureOrigin()
      val token = sessionVault.read()?.accessToken?.takeIf(String::isNotBlank)
        ?: throw ApiError.MissingCredential()
      builder.header("Authorization", "Bearer $token")
    }
    return builder.build()
  }

  private fun <T> decodeEnvelope(body: String, serializer: KSerializer<T>): T {
    val objectValue = try {
      JSON.parseToJsonElement(body).jsonObject
    } catch (_: Exception) {
      throw ApiError.MalformedResponse()
    }
    val ok = objectValue["ok"]?.jsonPrimitive?.booleanOrNull ?: throw ApiError.MalformedResponse()
    if (!ok) throw mapFailure(200, body)
    val data = objectValue["data"] ?: throw ApiError.MalformedResponse()
    return try {
      JSON.decodeFromJsonElement(serializer, data)
    } catch (_: Exception) {
      throw ApiError.MalformedResponse()
    }
  }

  private fun mapFailure(status: Int, body: String): ApiError {
    val errorObject = runCatching { JSON.parseToJsonElement(body).jsonObject["error"]?.jsonObject }.getOrNull()
    val code = errorObject.string("code") ?: "API_ERROR"
    val message = errorObject.string("message") ?: "Server request failed"
    return when {
      status == 401 -> ApiError.Unauthorized(code, message)
      status == 403 -> ApiError.Forbidden(code, message)
      status == 404 -> ApiError.NotFound(code, message)
      status == 409 || code.contains("CONFLICT") || code.contains("IDEMPOTENCY") ->
        ApiError.Conflict(code, message, code.contains("IDEMPOTENCY"))
      status == 429 || status in 500..599 -> ApiError.Retryable(status, code, message)
      else -> ApiError.Server(status, code, message)
    }
  }

  companion object {
    private const val API_VERSION = "78b3c7c"
    private val METHODS_REQUIRING_BODY = setOf("PATCH", "POST", "PUT")
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    internal val JSON = Json { ignoreUnknownKeys = true; isLenient = false; explicitNulls = false }

    fun create(sessionVault: SessionVault): TicketGroundApiClient = TicketGroundApiClient(
      ApiBaseUrl.parse(BuildConfig.API_BASE_URL).value.toHttpUrl(), sessionVault, OkHttpClient(),
    )

    internal fun forTesting(
      baseUrl: HttpUrl,
      sessionVault: SessionVault,
      httpClient: OkHttpClient = OkHttpClient(),
    ): TicketGroundApiClient = TicketGroundApiClient(baseUrl, sessionVault, httpClient)

    internal inline fun <reified T> decodeForTesting(body: String): T = JSON.decodeFromString(body)
  }
}

internal data class ApiRequest(
  val method: String = "GET",
  val path: String,
  val query: List<Pair<String, String>> = emptyList(),
  val body: String? = null,
  val idempotencyKey: String? = null,
  val authenticated: Boolean = false,
)

private fun JsonObject?.string(name: String): String? = this?.get(name)?.jsonPrimitive?.content

internal fun pathSegment(value: String): String {
  require(value.isNotBlank())
  return URLEncoder.encode(value, Charsets.UTF_8.name()).replace("+", "%20")
}
