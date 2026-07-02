export const TEST_CODES = {
  kakao: "ticketground-kakao-test-code",
  naver: "ticketground-naver-test-code"
};

const PROVIDERS = {
  kakao: {
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    profileUrl: "https://kapi.kakao.com/v2/user/me",
    clientIdEnv: "TIG_KAKAO_REST_API_KEY",
    legacyClientIdEnv: "TIG_KAKAO_CLIENT_ID",
    clientSecretEnv: "TIG_KAKAO_CLIENT_SECRET",
    clientSecretRequiredEnv: "TIG_KAKAO_CLIENT_SECRET_REQUIRED",
    redirectUriEnv: "TIG_KAKAO_REDIRECT_URI",
    requiresClientSecret: true
  },
  naver: {
    authorizeUrl: "https://nid.naver.com/oauth2.0/authorize",
    tokenUrl: "https://nid.naver.com/oauth2.0/token",
    profileUrl: "https://openapi.naver.com/v1/nid/me",
    clientIdEnv: "TIG_NAVER_CLIENT_ID",
    clientSecretEnv: "TIG_NAVER_CLIENT_SECRET",
    redirectUriEnv: "TIG_NAVER_REDIRECT_URI",
    requiresClientSecret: true
  }
};

export function loginRedirect(params, headers = {}) {
  const url = new URL("/login", "http://ticketground.local");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return {
    redirect: `${url.pathname}${url.search}`,
    status: 302,
    headers
  };
}

export function oauthRedirect(location, headers = {}) {
  return {
    redirect: location,
    status: 302,
    headers
  };
}

function requestOrigin(req) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return `${proto || "http"}://${req.headers.host}`;
}

function redirectUri(req, provider, config) {
  return process.env[config.redirectUriEnv] || `${requestOrigin(req)}/api/auth/${provider}/callback`;
}

function clientSecretRequired(config) {
  const envName = config.clientSecretRequiredEnv;
  if (!envName) return config.requiresClientSecret;
  const value = process.env[envName]?.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  return config.requiresClientSecret;
}

export function providerConfig(provider, req, phase = "callback") {
  const config = PROVIDERS[provider];
  if (!config) return null;
  const legacyClientId = config.legacyClientIdEnv ? process.env[config.legacyClientIdEnv]?.trim() : "";
  const clientId = process.env[config.clientIdEnv]?.trim() || legacyClientId;
  const clientSecret = process.env[config.clientSecretEnv]?.trim();
  if (!clientId || (phase === "callback" && clientSecretRequired(config) && !clientSecret)) return null;
  return {
    ...config,
    clientId,
    clientSecret,
    redirectUri: redirectUri(req, provider, config)
  };
}
