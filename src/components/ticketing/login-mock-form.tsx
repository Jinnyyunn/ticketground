"use client";

type LoginMode = "login" | "signup";

export function LoginMockForm({
  canLogin,
  canSignup,
  email,
  identityChecked,
  mode,
  name,
  onConfirm,
  onEmailChange,
  onIdentityCheckedChange,
  onNameChange,
  onPasswordChange,
  onTermsCheckedChange,
  password,
  termsChecked,
}: {
  readonly canLogin: boolean;
  readonly canSignup: boolean;
  readonly email: string;
  readonly identityChecked: boolean;
  readonly mode: LoginMode;
  readonly name: string;
  readonly onConfirm: () => void;
  readonly onEmailChange: (value: string) => void;
  readonly onIdentityCheckedChange: (checked: boolean) => void;
  readonly onNameChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onTermsCheckedChange: (checked: boolean) => void;
  readonly password: string;
  readonly termsChecked: boolean;
}) {
  return (
    <>
      <div className="grid gap-4">
        {mode === "signup" && (
          <label className="grid gap-2 text-sm font-black text-ink">
            이름
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              placeholder="홍길동"
            />
          </label>
        )}
        <label className="grid gap-2 text-sm font-black text-ink">
          이메일
          <input
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            placeholder="qa@ticketground.kr"
          />
        </label>
        <label className="grid gap-2 text-sm font-black text-ink">
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            placeholder="mock password"
          />
        </label>
      </div>

      {mode === "signup" && (
        <div className="signup-only mt-5 grid gap-3">
          <label className="flex items-start gap-3 rounded-[10px] border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
            <input
              type="checkbox"
              checked={identityChecked}
              onChange={(event) => onIdentityCheckedChange(event.target.checked)}
              className="mt-1 accent-[#1a47ff]"
            />
            <span>
              <strong className="block text-ink">본인인증 완료</strong>
              휴대폰 본인확인과 기기 확인을 완료한 것으로 처리하는 mock 블록입니다.
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-[10px] border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(event) => onTermsCheckedChange(event.target.checked)}
              className="mt-1 accent-[#1a47ff]"
            />
            <span>
              <strong className="block text-ink">필수 약관 동의</strong>
              이용약관, 개인정보 처리, 클린티켓 정책 안내를 확인했습니다.
            </span>
          </label>
        </div>
      )}

      <button
        type="button"
        disabled={mode === "login" ? !canLogin : !canSignup}
        onClick={onConfirm}
        className="mt-6 h-12 w-full rounded-[8px] bg-ticketground text-[16px] font-black text-white transition enabled:hover:bg-ticketground/90 disabled:bg-surface-3 disabled:text-ink-4"
      >
        {mode === "login" ? "mock 로그인 확인" : "mock 회원가입 완료"}
      </button>
    </>
  );
}
