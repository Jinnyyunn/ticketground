export function sendPushNotification(token, payload) {
  if (!process.env.TIG_PUSH_DELIVERY_ENABLED) {
    console.info("Push delivery stub: no provider configured", {
      platform: token.platform,
      tokenId: token.id,
      payloadType: payload.type
    });
    return { delivered: false, provider: "STUB" };
  }
  console.info("Push delivery provider is not implemented", {
    platform: token.platform,
    tokenId: token.id,
    payloadType: payload.type
  });
  return { delivered: false, provider: "NOT_IMPLEMENTED" };
}
