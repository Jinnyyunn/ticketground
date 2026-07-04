export const TEST_GOOGLE_CLIENT_ID = "ticketground-test-client.apps.googleusercontent.com";
export const GOOGLE_AUTH_TEST_CREDENTIAL = "ticketground-google-test-credential";

export function configureGoogleEnv(t, testMode) {
  const previousTestMode = process.env.TIG_GOOGLE_AUTH_TEST_MODE;
  const previousServerClientId = process.env.TIG_GOOGLE_CLIENT_ID;
  t.after(() => {
    if (previousTestMode === undefined) {
      delete process.env.TIG_GOOGLE_AUTH_TEST_MODE;
    } else {
      process.env.TIG_GOOGLE_AUTH_TEST_MODE = previousTestMode;
    }
    if (previousServerClientId === undefined) {
      delete process.env.TIG_GOOGLE_CLIENT_ID;
    } else {
      process.env.TIG_GOOGLE_CLIENT_ID = previousServerClientId;
    }
  });

  if (testMode) {
    process.env.TIG_GOOGLE_AUTH_TEST_MODE = "1";
  } else {
    delete process.env.TIG_GOOGLE_AUTH_TEST_MODE;
  }
  process.env.TIG_GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
}
