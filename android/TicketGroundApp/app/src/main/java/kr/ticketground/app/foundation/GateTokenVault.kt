package kr.ticketground.app.foundation

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.core.content.edit
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// The gate device token is a completely separate credential namespace from
// the consumer Bearer session in SessionVault.kt (see "게이트 운영자 인증
// 경계" in 애플리케이션 QR 검증 및 스캐너 계획서.md) - a gate token grants
// "mark this ticket admitted" authority, not account access, so it gets its
// own vault rather than being folded into KeystoreSessionVault. Without any
// persistence at all, an operator had to retype the password-masked token
// after every process death (routine under memory pressure during a
// multi-hour event, not just an explicit app kill), which is the actual bug
// this file fixes - see GateScannerViewModel's restoredToken wiring.
interface GateTokenVault {
  suspend fun read(): String?
  suspend fun store(token: String)
  suspend fun clear()
}

class InMemoryGateTokenVault : GateTokenVault {
  private var token: String? = null

  override suspend fun read(): String? = token

  override suspend fun store(token: String) {
    this.token = token
  }

  override suspend fun clear() {
    token = null
  }
}

class KeystoreGateTokenVault(context: Context) : GateTokenVault {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  override suspend fun read(): String? {
    val encrypted = preferences.getString(ENCRYPTED_TOKEN_KEY, null) ?: return null
    val initializationVector = preferences.getString(INITIALIZATION_VECTOR_KEY, null) ?: return null
    return runCatching { decrypt(encrypted, initializationVector) }.getOrNull()
  }

  override suspend fun store(token: String) {
    val encryption = encrypt(token)
    preferences.edit {
      putString(ENCRYPTED_TOKEN_KEY, encryption.ciphertext)
      putString(INITIALIZATION_VECTOR_KEY, encryption.initializationVector)
    }
  }

  override suspend fun clear() {
    preferences.edit { clear() }
  }

  private fun encrypt(value: String): EncryptedValue {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
    return EncryptedValue(
      ciphertext = android.util.Base64.encodeToString(cipher.doFinal(value.toByteArray(Charsets.UTF_8)), android.util.Base64.NO_WRAP),
      initializationVector = android.util.Base64.encodeToString(cipher.iv, android.util.Base64.NO_WRAP),
    )
  }

  private fun decrypt(ciphertext: String, initializationVector: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(
      Cipher.DECRYPT_MODE,
      getOrCreateKey(),
      GCMParameterSpec(
        GCM_TAG_LENGTH_BITS,
        android.util.Base64.decode(initializationVector, android.util.Base64.NO_WRAP),
      ),
    )
    return cipher.doFinal(android.util.Base64.decode(ciphertext, android.util.Base64.NO_WRAP)).toString(Charsets.UTF_8)
  }

  private fun getOrCreateKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
    generator.init(
      KeyGenParameterSpec.Builder(
        KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setRandomizedEncryptionRequired(true)
        .build(),
    )
    return generator.generateKey()
  }

  private data class EncryptedValue(val ciphertext: String, val initializationVector: String)

  private companion object {
    const val ANDROID_KEYSTORE = "AndroidKeyStore"
    const val ENCRYPTED_TOKEN_KEY = "encrypted_gate_token"
    const val GCM_TAG_LENGTH_BITS = 128
    const val INITIALIZATION_VECTOR_KEY = "gate_token_iv"
    const val KEY_ALIAS = "ticketground.gate_token.v1"
    const val PREFERENCES_NAME = "ticketground_gate_session"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
  }
}
