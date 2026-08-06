// TossPayments (토스페이먼츠) payment confirmation - mock mode by default, real REST
// verification once TIG_TOSSPAYMENTS_CLIENT_KEY/TIG_TOSSPAYMENTS_SECRET_KEY are set.
//
// "paymentKey" below always means the payment METHOD selector (CREDIT_CARD/SIMPLE_PAY/...),
// matching bootpay.js's convention - the actual TossPayments transaction identifier
// (also confusingly called "paymentKey" in their API) is named tossPaymentKey here to
// keep the two concepts from colliding.
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

  return { tosspaymentsConfig, confirmTosspaymentsPayment, isTosspaymentsConfigured };
}
