export function LoginHeroAside() {
  return (
    <aside className="flex min-h-[280px] flex-col justify-center bg-ink p-8 text-on-ink sm:min-h-[320px] lg:min-h-full lg:p-10">
      <div>
        <p className="text-sm font-black text-accent-2">Ticketground Members</p>
        <h1 className="balanced-title mt-4 text-[24px] font-black leading-[1.28] sm:text-[38px] lg:text-[42px]">
          <span className="inline-block whitespace-nowrap">클린 티켓 예매와 Tig 공식 양도 티켓을</span>
          <br />
          <span className="inline-block whitespace-nowrap">한 계정에서 이용해보세요.</span>
        </h1>
      </div>
    </aside>
  );
}
