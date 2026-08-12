package kr.ticketground.app.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

abstract class SafeEnumSerializer<T : Enum<T>>(
  name: String,
  private val values: Map<String, T>,
  private val unknown: T,
) : KSerializer<T> {
  override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor(name, PrimitiveKind.STRING)

  override fun deserialize(decoder: Decoder): T = values[decoder.decodeString()] ?: unknown

  override fun serialize(encoder: Encoder, value: T) {
    encoder.encodeString(value.name)
  }
}
