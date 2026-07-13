// BootPay (부트페이) payment confirmation - mock mode by default, real REST
// verification once TIG_BOOTPAY_APPLICATION_ID/TIG_BOOTPAY_PRIVATE_KEY are set.
const bootpayMethodByPaymentKey = {
  CREDIT_CARD: "card",
  SIMPLE_PAY: "kakaopay",
  BANK_TRANSFER: "banktransfer",
  BANK_DEPOSIT: "vbank",
  MOBILE: "phone"
};

export function createBootpayBackend({ hash, httpError, now }) {
  const applicationId = process.env.TIG_BOOTPAY_APPLICATION_ID || "";
  const privateKey = process.env.TIG_BOOTPAY_PRIVATE_KEY || "";

  function isBootpayConfigured() {
    return Boolean(applicationId && privateKey);
  }

  function bootpayConfig() {
    return {
      configured: isBootpayConfigured(),
      applicationId: isBootpayConfigured() ? applicationId : ""
    };
  }

  async function bootpayAccessToken() {
    const response = await fetch("https://api.bootpay.co.kr/request/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: applicationId, private_key: privateKey })
    });
    const payload = await response.json();
    if (!response.ok || !payload?.data?.token) {
      throw httpError(502, "BOOTPAY_TOKEN_FAILED", "BootPay 인증 토큰 발급에 실패했습니다.");
    }
    return payload.data.token;
  }

  async function verifyBootpayReceipt(receiptId) {
    const token = await bootpayAccessToken();
    const response = await fetch(`https://api.bootpay.co.kr/receipt/${encodeURIComponent(receiptId)}`, {
      headers: { Authorization: token }
    });
    const payload = await response.json();
    if (!response.ok || payload?.data?.status !== 1) {
      throw httpError(402, "BOOTPAY_PAYMENT_NOT_CONFIRMED", "BootPay 결제 승인 상태를 확인할 수 없습니다.");
    }
    return { receiptId, amount: payload.data.price, method: payload.data.method };
  }

  function mockBootpayReceipt({ ticketId, userId, paymentKey }) {
    return {
      receiptId: `bootpay_mock_${hash(`${ticketId}:${userId}:${paymentKey}:${now()}`).slice(0, 16)}`,
      method: bootpayMethodByPaymentKey[paymentKey] || "card"
    };
  }

  async function confirmBootpayPayment(db, { ticketId, userId, paymentKey, receiptId }) {
    if (isBootpayConfigured() && receiptId) {
      const verified = await verifyBootpayReceipt(receiptId);
      return { receiptId: verified.receiptId, method: verified.method, mock: false };
    }
    const receipt = mockBootpayReceipt({ ticketId, userId, paymentKey });
    return { receiptId: receipt.receiptId, method: receipt.method, mock: true };
  }

  return { bootpayConfig, confirmBootpayPayment, isBootpayConfigured };
}
