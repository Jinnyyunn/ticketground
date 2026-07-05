const socialProviders = [
  {
    label: "카카오톡 계정으로 로그인하기",
    href: "/api/auth/kakao/start",
    tone: "border-[#F6D900] bg-[#FEE500] text-ink hover:bg-[#F9DC00]",
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
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path
        fill="currentColor"
        d="M12 4C7.03 4 3 7.15 3 11.03c0 2.5 1.68 4.68 4.2 5.93l-.76 2.78a.43.43 0 0 0 .66.47l3.34-2.22c.51.05 1.03.08 1.56.08 4.97 0 9-3.15 9-7.04S16.97 4 12 4Z"
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
