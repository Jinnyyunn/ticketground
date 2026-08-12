const KAKAO_CHAT_URL = "https://pf.kakao.com/_xmTniX/chat";

export function KakaoChannelChat() {
  return (
    <section className="rounded-lg border border-line bg-card p-6 sm:p-8" data-testid="kakao-inquiry">
      <div className="max-w-2xl">
        <h2 className="text-xl font-black text-ink">카카오톡 채널로 문의해주세요</h2>
        <p className="mt-3 text-sm leading-6 text-ink-3">예매·입장·환불 문의는 카카오톡 채널 1:1 채팅으로 접수하고 답변드립니다.</p>
        <a className="mt-6 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#FEE500] px-5 text-sm font-black text-[#191919] no-underline transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-link" href={KAKAO_CHAT_URL} rel="noreferrer" target="_blank">카카오톡 1:1 상담</a>
        <p className="mt-3 text-xs font-bold text-ink-4">카카오톡 앱 또는 웹 채팅으로 연결됩니다.</p>
      </div>
    </section>
  );
}
