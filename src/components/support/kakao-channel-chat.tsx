"use client";

import Script from "next/script";

type KakaoChannelApi = {
  addChannel: (options: { readonly channelPublicId: string }) => void;
};

type KakaoSdk = {
  init: (javascriptKey: string) => void;
  isInitialized?: () => boolean;
  Channel?: KakaoChannelApi;
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

export const KAKAO_CHANNEL_PUBLIC_ID = "_xmTniX";
export const KAKAO_CHANNEL_URL = `https://pf.kakao.com/${KAKAO_CHANNEL_PUBLIC_ID}`;

const KAKAO_JS_SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
const kakaoJavascriptKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY ?? "";

function initializeKakaoSdk() {
  if (!kakaoJavascriptKey || !window.Kakao) return;
  if (window.Kakao.isInitialized?.()) return;
  window.Kakao.init(kakaoJavascriptKey);
}

export function KakaoChannelChat() {
  return (
    <section className="rounded-lg border border-line bg-card p-6 sm:p-8" data-testid="kakao-inquiry">
      {kakaoJavascriptKey ? <Script src={KAKAO_JS_SDK_URL} strategy="afterInteractive" onLoad={initializeKakaoSdk} /> : null}
      <div className="max-w-2xl">
        <h2 className="text-xl font-black text-ink">카카오톡 채널로 문의해주세요</h2>
        <p className="mt-3 text-sm leading-6 text-ink-3">채널을 추가하면 카카오톡에서 예매·입장·환불 1:1 문의를 보낼 수 있습니다.</p>
        <button
          type="button"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg border border-line px-5 text-sm font-black text-ink no-underline transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-link"
          onClick={() => {
            if (kakaoJavascriptKey && window.Kakao?.Channel?.addChannel) {
              window.Kakao.Channel.addChannel({ channelPublicId: KAKAO_CHANNEL_PUBLIC_ID });
              return;
            }
            window.open(KAKAO_CHANNEL_URL, "_blank", "noopener,noreferrer");
          }}
          data-channel-public-id={KAKAO_CHANNEL_PUBLIC_ID}
        >카카오톡 채널 추가 후 문의하기</button>
        <p className="mt-3 text-xs font-bold text-ink-4">카카오톡 앱 또는 웹 채팅으로 연결됩니다.</p>
      </div>
    </section>
  );
}
