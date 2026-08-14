package kr.ticketground.app.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.size
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import kr.ticketground.app.data.AdmissionQr

internal fun admissionQrPayload(qr: AdmissionQr): String = "${qr.nonce}.${qr.signature}"

@Composable
fun AdmissionQrCode(qr: AdmissionQr) {
  val bitmap = remember(qr.nonce, qr.signature) { createQrBitmap(admissionQrPayload(qr)) }
  Image(
    bitmap = bitmap.asImageBitmap(),
    contentDescription = null,
    modifier = Modifier
      .size(220.dp)
      .semantics { contentDescription = "입장 QR 코드" },
  )
}

private fun createQrBitmap(payload: String): Bitmap {
  val matrix = QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, QR_SIZE, QR_SIZE)
  val pixels = IntArray(QR_SIZE * QR_SIZE)
  for (y in 0 until QR_SIZE) {
    for (x in 0 until QR_SIZE) {
      pixels[y * QR_SIZE + x] = if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE
    }
  }
  return Bitmap.createBitmap(QR_SIZE, QR_SIZE, Bitmap.Config.ARGB_8888).apply {
    setPixels(pixels, 0, QR_SIZE, 0, 0, QR_SIZE, QR_SIZE)
  }
}

private const val QR_SIZE = 512
