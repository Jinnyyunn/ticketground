"use client";

import { useState } from "react";

type LoginMode = "login" | "signup";

const socialProviders = [
  { label: "카카오로 계속하기", tone: "bg-[#FEE500] text-ink" },
  { label: "네이버로 계속하기", tone: "bg-[#03C75A] text-white" },
  { label: "Apple로 계속하기", tone: "bg-ink text-white" },
] as const;

const perks = ["공식 재판매 풀", "동적 QR 입장", "예매 내역 통합 관리"] as const;

export function LoginPanel({ initialMode = "login" }: { readonly initialMode?: LoginMode }) {
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [identityChecked, setIdentityChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const canLogin = email.trim().length > 3 && password.length > 3;
  const canSignup = canLogin && name.trim().length > 1 && identityChecked && termsChecked;

  return (
    <section className="ticketground-container py-10">
      <div className="grid overflow-hidden rounded-[20px] border border-line bg-white shadow-ticket-2 lg:grid-cols-[0.92fr_1.08fr]">
        <aside className="flex min-h-[560px] flex-col gap-8 bg-ink p-8 text-white lg:p-10">
          <div>
            <p className="text-sm font-black text-accent-2">Ticketground Members</p>
            <h1 className="mt-4 text-[37px] font-black leading-tight">
              클린 티켓 예매와
              <br />
              환불 관리를 한 계정에서
            </h1>
            <p className="mt-5 max-w-[360px] text-sm leading-loose text-white/70">
              이 화면은 실제 인증을 수행하지 않는 프론트엔드 mock입니다. 입력과 버튼은 SPEC 흐름을 보여주기 위한 시뮬레이션입니다.
            </p>
          </div>

          <div className="grid gap-3 rounded-[12px] bg-white/8 p-5">
            <p className="text-sm font-black text-white">회원 기능 미리보기</p>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[12px] text-white/55">예매번호</dt>
                <dd className="mt-1 text-sm font-black">CTI</dd>
              </div>
              <div>
                <dt className="text-[12px] text-white/55">QR</dt>
                <dd className="mt-1 text-sm font-black">20초</dd>
              </div>
              <div>
                <dt className="text-[12px] text-white/55">재판매</dt>
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

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="grid grid-cols-2 rounded-[10px] bg-surface p-1" role="tablist" aria-label="로그인 회원가입 전환">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`h-11 rounded-[8px] text-sm font-black transition ${mode === "login" ? "bg-white text-ink shadow-ticket-1" : "text-ink-3"}`}
              onClick={() => setMode("login")}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={`h-11 rounded-[8px] text-sm font-black transition ${mode === "signup" ? "bg-white text-ink shadow-ticket-1" : "text-ink-3"}`}
              onClick={() => setMode("signup")}
            >
              회원가입
            </button>
          </div>

          <div className="mt-8">
            <p className="text-sm font-black text-ticketground">{mode === "login" ? "로그인" : "회원가입"}</p>
            <h2 className="mt-2 text-[28px] font-black leading-tight text-ink">
              {mode === "login" ? "예매 내역을 확인해 주세요" : "본인 확인 후 가입을 진행해 주세요"}
            </h2>
            <p className="mt-3 text-sm leading-loose text-ink-3">
              {mode === "login"
                ? "소셜 또는 이메일 입력으로 mock 로그인 상태를 확인합니다. 실제 세션은 생성하지 않습니다."
                : "가입 전용 본인인증과 약관 동의 블록을 포함한 mock 가입 화면입니다."}
            </p>
          </div>

          <div className="mt-7 grid gap-3">
            {socialProviders.map((provider) => (
              <button key={provider.label} type="button" className={`h-12 rounded-[8px] text-[15px] font-black ${provider.tone}`}>
                {provider.label}
              </button>
            ))}
          </div>

          <div className="my-7 flex items-center gap-3 text-xs font-bold text-ink-4">
            <span className="h-px flex-1 bg-line" aria-hidden />
            이메일 mock 입력
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>

          <div className="grid gap-4">
            {mode === "signup" && (
              <label className="grid gap-2 text-sm font-black text-ink">
                이름
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  placeholder="홍길동"
                />
              </label>
            )}
            <label className="grid gap-2 text-sm font-black text-ink">
              이메일
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                placeholder="qa@ticketground.kr"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                  onChange={(event) => setIdentityChecked(event.target.checked)}
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
                  onChange={(event) => setTermsChecked(event.target.checked)}
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
            className="mt-6 h-12 w-full rounded-[8px] bg-ticketground text-[16px] font-black text-white transition enabled:hover:bg-ticketground/90 disabled:bg-surface-3 disabled:text-ink-4"
          >
            {mode === "login" ? "mock 로그인 확인" : "mock 회원가입 완료"}
          </button>
        </div>
      </div>
    </section>
  );
}
