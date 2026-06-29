export function ReviewCta() {
  return (
    <section className="ticketground-container mt-[60px]">
      <div className="relative flex h-[150px] items-center justify-center overflow-hidden rounded-2xl bg-[#6742d8]">
        <div className="text-center text-white">
          <p className="text-[16px] text-white/85">관람후기/기대평 작성하고</p>
          <p className="mt-1.5 text-[26px] font-bold">공연 초대권 받아가세요!</p>
        </div>
        {/* decorative ticket envelope */}
        <div className="absolute right-[20%] top-1/2 hidden -translate-y-1/2 -rotate-6 lg:block">
          <div className="relative h-[78px] w-[120px] rounded-lg bg-white/90 shadow-lg">
            <div className="absolute -top-3 left-1/2 h-6 w-[88px] -translate-x-1/2 rounded-md bg-[#b9a8f0]" />
            <div className="absolute inset-x-3 top-5 space-y-1.5">
              <div className="h-1.5 rounded-full bg-[#d9cffb]" />
              <div className="h-1.5 w-3/4 rounded-full bg-[#d9cffb]" />
              <div className="h-1.5 w-1/2 rounded-full bg-[#d9cffb]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
