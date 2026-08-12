package kr.ticketground.app.foundation

import android.content.Context
import androidx.core.content.edit
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class BearerSession(val accessToken: String)

interface SessionVault {
  suspend fun read(): BearerSession?
  suspend fun store(session: BearerSession)
  suspend fun clear()
}

class InMemorySessionVault : SessionVault {
  private var session: BearerSession? = null

  override suspend fun read(): BearerSession? = session

  override suspend fun store(session: BearerSession) {
    this.session = session
  }

  override suspend fun clear() {
    session = null
  }
}

class KeystoreSessionVault(context: Context) : SessionVault {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  override suspend fun read(): BearerSession? {
    val encrypted = preferences.getString(ENCRYPTED_TOKEN_KEY, null) ?: return null
    val initializationVector = preferences.getString(INITIALIZATION_VECTOR_KEY, null) ?: return null
    return runCatching {
      BearerSession(decrypt(encrypted, initializationVector))
    }.getOrNull()
  }

  override suspend fun store(session: BearerSession) {
    val encryption = encrypt(session.accessToken)
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
    const val ENCRYPTED_TOKEN_KEY = "encrypted_bearer"
    const val GCM_TAG_LENGTH_BITS = 128
    const val INITIALIZATION_VECTOR_KEY = "bearer_iv"
    const val KEY_ALIAS = "ticketground.bearer.v1"
    const val PREFERENCES_NAME = "ticketground_session"
    const val TRANSFORMATION = "AES/GCM/NoPadding"
  }
}
