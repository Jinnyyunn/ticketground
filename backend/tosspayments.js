// TossPayments (토스페이먼츠) payment confirmation - mock mode by default, real REST
// verification once TIG_TOSSPAYMENTS_CLIENT_KEY/TIG_TOSSPAYMENTS_SECRET_KEY are set.
//
// "paymentKey" below always means the payment METHOD selector (CREDIT_CARD/SIMPLE_PAY/...).
// The actual TossPayments transaction identifier (also confusingly called
// "paymentKey" in their API) is named tossPaymentKey here to keep the two
// concepts from colliding.
import crypto from "node:crypto";

const tosspaymentsMethodByPaymentKey = {
  CREDIT_CARD: "카드",
  SIMPLE_PAY: "간편결제",
  BANK_TRANSFER: "계좌이체",
  BANK_DEPOSIT: "가상계좌",
  MOBILE: "휴대폰결제"
};

export function createTosspaymentsBackend({ hash, httpError, now }) {
  const clientKey = process.env.TIG_TOSSPAYMENTS_CLIENT_KEY || "";
  const secretKey = process.env.TIG_TOSSPAYMENTS_SECRET_KEY || "";
  const webhookSecret = process.env.TIG_TOSSPAYMENTS_WEBHOOK_SECRET || "";
  const mockConfirmDelayMs = Math.max(0, Number.parseInt(process.env.TIG_TOSSPAYMENTS_MOCK_CONFIRM_DELAY_MS || "0", 10) || 0);

  function isTosspaymentsConfigured() {
    return Boolean(clientKey && secretKey);
  }

  function tosspaymentsConfig() {
    return {
      configured: isTosspaymentsConfigured(),
      clientKey: isTosspaymentsConfigured() ? clientKey : ""
    };
  }

  async function verifyTosspaymentsPayment({ tossPaymentKey, orderId, expectedAmount }) {
    const auth = Buffer.from(`${secretKey}:`).toString("base64");
    const response = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey: tossPaymentKey, orderId, amount: expectedAmount })
    });
    const payload = await response.json();
    if (!response.ok || payload?.status !== "DONE") {
      throw httpError(402, "TOSSPAYMENTS_PAYMENT_NOT_CONFIRMED", "토스페이먼츠 결제 승인 상태를 확인할 수 없습니다.", {
        code: payload?.code,
        message: payload?.message
      });
    }
    return payload;
  }

  function mockTosspaymentsReceipt({ ticketId, userId, paymentKey, orderId }) {
    return {
      tossPaymentKey: `toss_mock_${hash(`${ticketId}:${userId}:${paymentKey}:${orderId}:${now()}`).slice(0, 16)}`,
      method: tosspaymentsMethodByPaymentKey[paymentKey] || "카드"
    };
  }

  async function confirmTosspaymentsPayment(db, { ticketId, userId, paymentKey, tossPaymentKey, orderId, expectedAmount }) {
    if (isTosspaymentsConfigured()) {
      if (!tossPaymentKey) {
        throw httpError(400, "TOSSPAYMENTS_PAYMENT_KEY_REQUIRED", "토스페이먼츠 결제 승인 정보가 필요합니다.");
      }
      const verified = await verifyTosspaymentsPayment({ tossPaymentKey, orderId, expectedAmount });
      const verifiedAmount = Number(verified.totalAmount);
      const requiredAmount = Number(expectedAmount);
      if (Number.isFinite(requiredAmount) && (!Number.isFinite(verifiedAmount) || verifiedAmount !== requiredAmount)) {
        throw httpError(409, "TOSSPAYMENTS_AMOUNT_MISMATCH", "토스페이먼츠 승인 금액이 티켓 금액과 일치하지 않습니다.", {
          tossPaymentKey: verified.paymentKey,
          expectedAmount: requiredAmount,
          actualAmount: Number.isFinite(verifiedAmount) ? verifiedAmount : null
        });
      }
      return { tossPaymentKey: verified.paymentKey, method: verified.method, approvedAt: verified.approvedAt, amount: verifiedAmount, mock: false };
    }
    await new Promise((resolve) => setTimeout(resolve, mockConfirmDelayMs));
    const receipt = mockTosspaymentsReceipt({ ticketId, userId, paymentKey, orderId });
    return { tossPaymentKey: receipt.tossPaymentKey, method: receipt.method, mock: true };
  }

  async function cancelTosspaymentsPayment({ tossPaymentKey, cancelReason, cancelAmount, refundReceiveAccount, taxFreeAmount }) {
    if (!cancelReason) {
      throw httpError(400, "TOSSPAYMENTS_CANCEL_REASON_REQUIRED", "취소 사유가 필요합니다.");
    }
    if (!isTosspaymentsConfigured()) {
      // No real transaction exists to cancel without live credentials - this
      // mock branch exists purely so the admin flow (and its tests) can be
      // exercised end-to-end without a live TossPayments account, matching
      // confirmTosspaymentsPayment's own mock fallback.
      return {
        paymentKey: tossPaymentKey,
        status: "CANCELED",
        cancels: [{
          cancelReason,
          canceledAt: now(),
          transactionKey: `toss_mock_cancel_${hash(`${tossPaymentKey}:${cancelReason}:${now()}`).slice(0, 16)}`
        }],
        mock: true
      };
    }
    const auth = Buffer.from(`${secretKey}:`).toString("base64");
    const response = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(tossPaymentKey)}/cancel`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        cancelReason,
        ...(cancelAmount !== undefined ? { cancelAmount } : {}),
        ...(refundReceiveAccount ? { refundReceiveAccount } : {}),
        ...(taxFreeAmount !== undefined ? { taxFreeAmount } : {})
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw httpError(502, "TOSSPAYMENTS_CANCEL_FAILED", "토스페이먼츠 결제 취소에 실패했습니다.", {
        code: payload?.code,
        message: payload?.message
      });
    }
    return { ...payload, mock: false };
  }

  // Only payout.changed/seller.changed webhooks carry this signature per
  // TossPayments' own docs - PAYMENT_STATUS_CHANGED (the event this repo
  // actually cares about) is NOT signed at all. This function still exists
  // for the event types that do sign, and as a real defense if TossPayments
  // ever adds signing to more event types - but callers must never treat an
  // absent-by-design signature as a reason to trust an unsigned payload.
  function isWebhookSignatureValid(signatureHeader, { payload, transmissionTime }) {
    if (!webhookSecret || !signatureHeader || !transmissionTime) return false;
    const candidates = signatureHeader
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.startsWith("v1:"))
      .map((part) => part.slice(3));
    if (!candidates.length) return false;
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${payload}:${transmissionTime}`)
      .digest();
    return candidates.some((candidate) => {
      let decoded;
      try {
        decoded = Buffer.from(candidate, "base64");
      } catch {
        return false;
      }
      return decoded.length === expected.length && crypto.timingSafeEqual(decoded, expected);
    });
  }

  return {
    tosspaymentsConfig,
    confirmTosspaymentsPayment,
    cancelTosspaymentsPayment,
    isWebhookSignatureValid,
    isTosspaymentsConfigured
  };
}
