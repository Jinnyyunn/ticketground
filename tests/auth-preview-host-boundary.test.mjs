import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startServer } from "./backend-test-utils.mjs";

const AUTH_ENV_KEYS = [
  "NODE_ENV",
  "TIG_AUTH_FORCE_PROVIDER",
  "TIG_GOOGLE_AUTH_TEST_MODE",
  "TIG_GOOGLE_QA_MOCK_ENABLED",
  "NEXT_PUBLIC_GOOGLE_QA_MOCK_ENABLED",
  "TIG_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS",
  "TIG_SOCIAL_QA_MOCK_ENABLED",
  "NEXT_PUBLIC_SOCIAL_QA_MOCK_ENABLED",
  "TIG_KAKAO_REST_API_KEY",
  "TIG_KAKAO_CLIENT_ID",
  "TIG_NAVER_CLIENT_ID",
];

function replaceAuthEnv(t, nextValues) {
  const previousValues = new Map(AUTH_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of AUTH_ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(nextValues)) process.env[key] = value;
  t.after(() => {
    for (const key of AUTH_ENV_KEYS) {
      const value = previousValues.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

async function configJson(baseUrl, path, headers) {
  const url = new URL(path, baseUrl);
  return await new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "GET",
        headers,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            assert.equal(response.statusCode, 200);
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

test("auth config QA mock mode trusts Host rather than spoofable forwarded host headers", async (t) => {
  replaceAuthEnv(t, {
    NODE_ENV: "production",
    TIG_GOOGLE_CLIENT_ID: "ticketground-test-client.apps.googleusercontent.com",
    NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS: "http://localhost:5501",
    TIG_KAKAO_REST_API_KEY: "ticketground-kakao-test-client",
    TIG_NAVER_CLIENT_ID: "ticketground-naver-test-client",
  });
  const { baseUrl } = await startServer(t);
  const port = new URL(baseUrl).port;

  const publicHostWithPrivateForward = {
    host: `public.ticketground.test:${port}`,
    "x-forwarded-host": `127.0.0.1:${port}`,
  };
  const googlePublicSpoof = await configJson(baseUrl, "/auth/google-config", publicHostWithPrivateForward);
  const socialPublicSpoof = await configJson(baseUrl, "/auth/social-config", publicHostWithPrivateForward);
  assert.equal(googlePublicSpoof.preferMock, false);
  assert.equal(socialPublicSpoof.preferMock, false);

  const privateHost = { host: `127.0.0.1:${port}` };
  const googlePrivate = await configJson(baseUrl, "/auth/google-config", privateHost);
  const socialPrivate = await configJson(baseUrl, "/auth/social-config", privateHost);
  assert.equal(googlePrivate.preferMock, true);
  assert.equal(socialPrivate.preferMock, true);

  const ipv6LocalHost = { host: `[::1]:${port}` };
  const googleIpv6Local = await configJson(baseUrl, "/auth/google-config", ipv6LocalHost);
  const socialIpv6Local = await configJson(baseUrl, "/auth/social-config", ipv6LocalHost);
  assert.equal(googleIpv6Local.preferMock, true);
  assert.equal(socialIpv6Local.preferMock, true);
});
