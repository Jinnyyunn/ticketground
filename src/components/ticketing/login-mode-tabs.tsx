type LoginMode = "login" | "signup";

type LoginModeTabsProps = {
  readonly mode: LoginMode;
  readonly onChange: (mode: LoginMode) => void;
};

export function LoginModeTabs({ mode, onChange }: LoginModeTabsProps) {
  return (
    <div className="grid grid-cols-2 rounded-[10px] bg-surface p-1" role="tablist" aria-label="로그인 회원가입 전환">
      {(["login", "signup"] as const).map((nextMode) => (
        <button
          key={nextMode}
          type="button"
          role="tab"
          aria-selected={mode === nextMode}
          className={`h-11 rounded-[8px] text-sm font-black transition ${mode === nextMode ? "bg-white text-ink shadow-ticket-1" : "text-ink-3"}`}
          onClick={() => onChange(nextMode)}
        >
          {nextMode === "login" ? "로그인" : "회원가입"}
        </button>
      ))}
    </div>
  );
}
