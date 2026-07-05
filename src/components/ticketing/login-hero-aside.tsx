"use client";

const perks = ["공식 재판매 풀", "동적 QR 입장", "예매 내역 통합 관리"] as const;

export function LoginHeroAside() {
  return (
    <aside className="flex min-h-[560px] flex-col gap-8 bg-ink p-8 text-white lg:p-10">
      <div>
        <p className="text-sm font-black text-accent-2">Ticketground Members</p>
        <h1 className="balanced-title mt-4 text-[31px] font-black leading-tight sm:text-5xl">
          클린 티켓 예매와
          <br />
          환불 관리를 한 계정에서
        </h1>
        <p className="mt-5 max-w-[360px] text-sm leading-loose text-white/70">
          Google 인증 또는 데모 계정으로 계정 상태와 프로필 갱신을 확인합니다. Tailscale 미리보기는 유지하되 Google 승인 출처는 localhost:5501을
          사용합니다.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg bg-background/8 p-5">
        <p className="text-sm font-black text-white">회원 기능 미리보기</p>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-white/55">예매번호</dt>
            <dd className="mt-1 text-sm font-black">CTI</dd>
          </div>
          <div>
            <dt className="text-xs text-white/55">QR</dt>
            <dd className="mt-1 text-sm font-black">20초</dd>
          </div>
          <div>
            <dt className="text-xs text-white/55">재판매</dt>
            <dd className="mt-1 text-sm font-black">공식</dd>
          </div>
        </dl>
      </div>

      <ul className="mt-auto grid gap-3 text-sm font-bold text-white/80">
        {perks.map((perk) => (
          <li key={perk} className="flex items-center gap-3">
            <span className="h-px w-6 bg-accent-2" aria-hidden />
            {perk}
          </li>
        ))}
      </ul>
    </aside>
  );
}
