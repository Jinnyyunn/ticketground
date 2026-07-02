const socialProviders = [
  { label: "카카오로 계속하기", tone: "bg-[#FEE500] text-ink" },
  { label: "네이버로 계속하기", tone: "bg-[#03C75A] text-white" },
  { label: "Apple로 계속하기", tone: "bg-ink text-white" },
] as const;

export function SocialLoginButtons() {
  return (
    <>
      {socialProviders.map((provider) => (
        <button key={provider.label} type="button" className={`h-12 rounded-[8px] text-[15px] font-black ${provider.tone}`}>
          {provider.label}
        </button>
      ))}
    </>
  );
}
