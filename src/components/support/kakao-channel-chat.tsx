"use client";

import Script from "next/script";

type KakaoChannelApi = {
  addChannel: (options: { readonly channelPublicId: string }) => void;
  chat: (options: { readonly channelPublicId: string }) => void;
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
export const KAKAO_CHAT_URL = `${KAKAO_CHANNEL_URL}/chat`;

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
        <h2 className="text-xl font-black text-ink">카카오톡으로 문의해주세요</h2>
        <p className="mt-3 break-keep text-sm leading-6 text-ink-3">예매·입장·환불 문의는 카카오톡 채팅으로 보내주세요. 채널 추가는 선택사항입니다.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#fee500] px-5 text-sm font-black text-[#191919] no-underline transition hover:bg-[#f5d900] focus-visible:outline-2 focus-visible:outline-link"
            href={KAKAO_CHAT_URL}
            onClick={(event) => {
              if (kakaoJavascriptKey && window.Kakao?.Channel?.chat) {
                event.preventDefault();
                window.Kakao.Channel.chat({ channelPublicId: KAKAO_CHANNEL_PUBLIC_ID });
              }
            }}
            rel="noreferrer"
            target="_blank"
          >카카오톡으로 1:1 문의하기</a>
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center rounded-lg border border-line px-5 text-sm font-black text-ink no-underline transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-link"
            onClick={() => {
              if (kakaoJavascriptKey && window.Kakao?.Channel?.addChannel) {
                window.Kakao.Channel.addChannel({ channelPublicId: KAKAO_CHANNEL_PUBLIC_ID });
                return;
              }
              window.open(KAKAO_CHANNEL_URL, "_blank", "noopener,noreferrer");
            }}
            data-channel-public-id={KAKAO_CHANNEL_PUBLIC_ID}
          >채널 추가하기</button>
        </div>
        <p className="mt-3 break-keep text-xs font-bold text-ink-4">카카오톡 로그인 후 이용할 수 있습니다.</p>
      </div>
    </section>
  );
}
