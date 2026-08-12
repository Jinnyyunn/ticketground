"use client";

import Script from "next/script";
import { useState } from "react";

type KakaoChannelSdk = { readonly chat: (options: { readonly channelPublicId: string }) => void };
type KakaoSdk = { readonly Channel: KakaoChannelSdk; readonly init: (appKey: string) => void; readonly isInitialized: () => boolean };

declare global { interface Window { readonly Kakao?: KakaoSdk } }

const KAKAO_JAVASCRIPT_KEY = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim() ?? "";
const KAKAO_CHANNEL_PUBLIC_ID = "_xmTniX";
const KAKAO_CHAT_URL = "https://pf.kakao.com/_xmTniX/chat";

export function KakaoChannelChat() {
  const [kakaoReady, setKakaoReady] = useState(false);
  const initializeKakao = () => {
    if (!KAKAO_JAVASCRIPT_KEY || !window.Kakao) return;
    if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JAVASCRIPT_KEY);
    setKakaoReady(true);
  };
  const openKakaoChat = () => {
    if (kakaoReady && window.Kakao) window.Kakao.Channel.chat({ channelPublicId: KAKAO_CHANNEL_PUBLIC_ID });
    else window.open(KAKAO_CHAT_URL, "_blank", "noopener,noreferrer");
  };
  return (
    <section className="rounded-lg border border-line bg-card p-6 sm:p-8" data-testid="kakao-inquiry">
      <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" strategy="afterInteractive" onLoad={initializeKakao} />
      <div className="max-w-2xl">
        <h2 className="text-xl font-black text-ink">카카오톡 채널로 문의해주세요</h2>
        <p className="mt-3 text-sm leading-6 text-ink-3">예매·입장·환불 문의는 카카오톡 채널 1:1 채팅으로 접수하고 답변드립니다.</p>
        <button className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#FEE500] px-5 text-sm font-black text-[#191919] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-link" onClick={openKakaoChat} type="button">카카오톡 1:1 상담</button>
        <p className="mt-3 text-xs font-bold text-ink-4">카카오톡 앱 또는 웹 채팅으로 연결됩니다.</p>
      </div>
    </section>
  );
}
