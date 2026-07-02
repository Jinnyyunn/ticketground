const socialProviders = [
  { label: "카카오톡 계정으로 로그인하기", href: "/api/auth/kakao/start", tone: "border-[#F6D900] bg-[#FEE500] text-ink hover:bg-[#F9DC00]" },
  { label: "네이버 계정으로 로그인하기", href: "/api/auth/naver/start", tone: "border-[#03C75A] bg-[#03C75A] text-white hover:bg-[#02B351]" },
] as const;

export function SocialLoginButtons() {
  return (
    <>
      {socialProviders.map((provider) => (
        <a
          key={provider.label}
          href={provider.href}
          className={`flex h-12 items-center justify-center rounded-[8px] border px-4 text-[15px] font-black transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${provider.tone}`}
        >
          {provider.label}
        </a>
      ))}
    </>
  );
}
