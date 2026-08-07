import { headers } from "next/headers";
import { defaultLocale, isLocale, LOCALE_HEADER, type Locale } from "./config";

// Reads the locale proxy.ts already validated and attached to the request.
// Never trusts a raw client-controlled header value beyond the isLocale()
// check, and always falls back to Korean rather than guessing.
export async function requestLocale(): Promise<Locale> {
  const headerList = await headers();
  const value = headerList.get(LOCALE_HEADER);
  return value && isLocale(value) ? value : defaultLocale;
}
