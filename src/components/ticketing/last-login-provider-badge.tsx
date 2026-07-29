import type { LastLoginProvider } from "@/lib/ticketground-api";

const PROVIDER_NAMES = {
  google: "Google",
  kakao: "카카오톡",
  naver: "네이버",
} as const satisfies Record<LastLoginProvider, string>;

export const LAST_LOGIN_PROVIDER_INDICATOR_IDS = {
  google: "last-login-provider-google",
  kakao: "last-login-provider-kakao",
  naver: "last-login-provider-naver",
} as const satisfies Record<LastLoginProvider, string>;

export function LastLoginProviderBadge({ provider }: { readonly provider: LastLoginProvider }) {
  return (
    <span
      id={LAST_LOGIN_PROVIDER_INDICATOR_IDS[provider]}
      aria-label={`최근 로그인한 수단: ${PROVIDER_NAMES[provider]}`}
      className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-black text-on-ink shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
    >
      최근 로그인
    </span>
  );
}
