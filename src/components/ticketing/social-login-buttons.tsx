const socialProviders = [
  {
    label: "카카오톡 계정으로 로그인하기",
    href: "/api/auth/kakao/start",
    tone: "border-[#FFDE32] bg-[#FFDE32] text-[#2D1B1B] hover:bg-[#F7D51F]",
    icon: "kakao",
  },
  {
    label: "네이버 계정으로 로그인하기",
    href: "/api/auth/naver/start",
    tone: "border-[#03C75A] bg-[#03C75A] text-white hover:bg-[#02B351]",
    icon: "naver",
  },
] as const;

function KakaoLogo() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" className="size-6 shrink-0">
      <circle cx="16" cy="16" r="15" fill="#FFDE32" />
      <path
        fill="#3A2929"
        d="M16 8.2c-5.38 0-9.75 3.42-9.75 7.64 0 2.64 1.73 4.97 4.35 6.34l-.86 3.04a.46.46 0 0 0 .7.5l3.42-2.25c.7.13 1.42.2 2.14.2 5.38 0 9.75-3.42 9.75-7.64S21.38 8.2 16 8.2Z"
      />
    </svg>
  );
}

function NaverLogo() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5 shrink-0">
      <rect width="24" height="24" rx="3" fill="#03C75A" />
      <path fill="#fff" d="M14.64 12.3 9.16 4.8H4.62v14.4h4.74v-7.5l5.48 7.5h4.54V4.8h-4.74v7.5Z" />
    </svg>
  );
}

export function SocialLoginButtons() {
  return (
    <>
      {socialProviders.map((provider) => (
        <a
          key={provider.label}
          href={provider.href}
          className={`flex h-12 items-center justify-center gap-2 rounded-sm border px-4 text-base font-black transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${provider.tone}`}
        >
          {provider.icon === "kakao" ? <KakaoLogo /> : <NaverLogo />}
          {provider.label}
        </a>
      ))}
    </>
  );
}
